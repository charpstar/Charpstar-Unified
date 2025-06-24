"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import { Input } from "@/components/ui/inputs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/containers";
import {
  Download,
  ExternalLink,
  Search,
  Grid,
  Filter,
  X,
  ChevronRight,
  ChevronLeft,
  Rows,
  LayoutGrid,
} from "lucide-react";
import { useAssets } from "../../../hooks/use-assets";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Script from "next/script";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs";
import { Separator } from "@/components/ui/containers";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useUser } from "@/contexts/useUser";
import { PreviewGeneratorDialog } from "@/components/asset-library/dialogs/preview-generator-dialog";
import { createClient } from "@/utils/supabase/client";
import Image from "next/image";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/interactive";
import { AssetLibrarySkeleton } from "@/components/ui/skeletons";
import { translateSwedishToEnglish } from "@/utils/swedishTranslations";

type SortOption =
  | "name-asc"
  | "name-desc"
  | "date-asc"
  | "date-desc"
  | "updated-desc";

const levenshteinDistance = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = Array(b.length + 1)
    .fill(null)
    .map(() => Array(a.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + substitutionCost // substitution
      );
    }
  }

  return matrix[b.length][a.length];
};

const isFuzzyMatch = (searchTerm: string, target: string): boolean => {
  if (!searchTerm || !target) return false;

  // Split search terms by comma and trim whitespace
  const searchTerms = searchTerm
    .split(",")
    .map((term) => term.trim().toLowerCase());
  const targetLower = target.toLowerCase();

  // Return true if any of the search terms match
  return searchTerms.some((term) => {
    const words = term.split(" ");
    return words.every((word) => {
      const distance = levenshteinDistance(word, targetLower);
      // Allow 1 typo for every 4 characters, minimum 1 typo allowed
      const maxDistance = Math.max(1, Math.floor(word.length / 4));
      return distance <= maxDistance;
    });
  });
};

export default function AssetLibraryPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const client = searchParams.get("client");
  const {
    assets,
    loading,
    error,
    refetch,
    filterOptions,
    filters,
    setFilters,
    filteredAssets: hookFilteredAssets,
  } = useAssets();
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearchValue, setDebouncedSearchValue] = useState("");
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [viewMode, setViewMode] = useState<
    "grid" | "colGrid" | "compactGrid" | "list"
  >("grid");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const user = useUser();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [isBatchEditMode, setIsBatchEditMode] = useState(false);

  const categoryContainerRef = useRef<HTMLDivElement>(null);
  const subcategoryContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) return;
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (data?.role) setUserRole(data.role);
    };
    fetchUserRole();
  }, [user]);

  const ITEMS_PER_PAGE = viewMode === "compactGrid" ? 60 : 52;

  // Debounce search value
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchValue(searchValue);
    }, 300); // 300ms delay

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchValue]);

  // Filter assets based on debounced search and sort
  const filteredAssets = hookFilteredAssets
    .filter((asset) => {
      // Translate Swedish search terms to English for matching
      const searchLower = translateSwedishToEnglish(
        debouncedSearchValue.toLowerCase()
      );
      if (!searchLower) return true;

      return (
        isFuzzyMatch(searchLower, asset.product_name) ||
        asset.materials?.some((material) =>
          isFuzzyMatch(searchLower, material)
        ) ||
        asset.colors?.some((color) => isFuzzyMatch(searchLower, color)) ||
        asset.tags?.some((tag) => isFuzzyMatch(searchLower, tag))
      );
    })
    .sort((a, b) => {
      switch (filters.sort) {
        case "name-asc":
          return a.product_name.localeCompare(b.product_name);
        case "name-desc":
          return b.product_name.localeCompare(a.product_name);
        case "date-asc":
          return (
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        case "date-desc":
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        case "updated-desc":
          return (
            new Date(b.updated_at || b.created_at).getTime() -
            new Date(a.updated_at || a.created_at).getTime()
          );
        default:
          return 0;
      }
    });

  // Calculate pagination
  const totalPages = Math.ceil(filteredAssets.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentAssets = filteredAssets.slice(startIndex, endIndex);

  const handleFilterChange = (key: keyof typeof filters, value: any) => {
    if (key === "category") {
      // When selecting "all" or clearing category, also clear subcategory
      if (value === "all" || value === null) {
        setFilters({ ...filters, category: null, subcategory: null });
      } else {
        setFilters({ ...filters, category: value, subcategory: null });
      }
      setCurrentPage(1); // Reset to first page
    } else if (key === "subcategory") {
      // Only allow subcategory change if a category is selected
      if (filters.category) {
        setFilters({ ...filters, [key]: value });
        setCurrentPage(1);
      }
    } else {
      setFilters({ ...filters, [key]: value });
    }
  };

  const handleSortChange = (value: string) => {
    setFilters({ ...filters, sort: value as any });
  };

  const clearFilters = () => {
    setFilters({
      search: [],
      category: null,
      subcategory: null,
      client: [],
      material: [],
      color: [],
      sort: "name-asc",
    });
  };

  // Helper function to build URL with filters
  const buildUrlWithFilters = (params: Record<string, string | null>) => {
    const urlParams = new URLSearchParams();

    // Only include navigation-related filters in the URL
    if (filters.category) urlParams.set("category", filters.category);
    if (filters.subcategory) urlParams.set("subcategory", filters.subcategory);

    // Override with new params
    Object.entries(params).forEach(([key, value]) => {
      if (value === null) {
        urlParams.delete(key);
      } else {
        urlParams.set(key, value);
      }
    });

    return `/asset-library${urlParams.toString() ? `?${urlParams.toString()}` : ""}`;
  };

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();

    // Include all filters in the actual URL
    if (filters.category) params.set("category", filters.category);
    if (filters.subcategory) params.set("subcategory", filters.subcategory);
    if (filters.client.length > 0)
      params.set("clients", filters.client.join(","));
    if (filters.material.length > 0)
      params.set("materials", filters.material.join(","));
    if (filters.color.length > 0) params.set("colors", filters.color.join(","));
    if (filters.sort !== "name-asc") params.set("sort", filters.sort);
    if (debouncedSearchValue) params.set("search", debouncedSearchValue);

    const newUrl = `${pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    router.push(newUrl, { scroll: false });
  }, [filters, debouncedSearchValue, pathname, router]);

  // Initialize filters from URL on mount
  useEffect(() => {
    // Helper to parse comma-separated params
    const parseList = (param: string | null): string[] =>
      param ? param.split(",") : [];

    setFilters((prev) => ({
      ...prev,
      category: searchParams.get("category") || null,
      subcategory: searchParams.get("subcategory") || null,
      client: parseList(searchParams.get("clients")),
      material: parseList(searchParams.get("materials")),
      color: parseList(searchParams.get("colors")),
      sort: (searchParams.get("sort") as SortOption) || "name-asc",
    }));

    setSearchValue(searchParams.get("search") || "");
  }, [searchParams, setFilters]);
  //might wanna remove setFilters from the dependency array
  // Breadcrumb items
  const breadcrumbItems: {
    label: string;
    href: string;
    onClick?: () => void;
  }[] = [
    {
      label: "Asset Library",
      href: buildUrlWithFilters({ category: null, subcategory: null }),
      onClick: () => {
        setFilters((prev) => ({
          ...prev,
          category: null,
          subcategory: null,
        }));
      },
    },
  ];

  if (filters.category) {
    const category = filterOptions.categories.find(
      (c) => c.id === filters.category
    );
    if (category) {
      breadcrumbItems.push({
        label: category.name || "Uncategorized",
        href: buildUrlWithFilters({
          category: filters.category,
          subcategory: null,
        }),
        onClick: () => {
          setFilters((prev) => ({
            ...prev,
            subcategory: null,
          }));
        },
      });
    }
  }

  if (filters.category && filters.subcategory) {
    const category = filterOptions.categories.find(
      (c) => c.id === filters.category
    );
    const subcategory = category?.subcategories.find(
      (s) => s.id === filters.subcategory
    );
    if (subcategory) {
      breadcrumbItems.push({
        label: subcategory.name || "Uncategorized",
        href: buildUrlWithFilters({
          category: filters.category,
          subcategory: filters.subcategory,
        }),
        onClick: () => {
          setFilters((prev) => ({
            ...prev,
            subcategory: filters.subcategory,
          }));
        },
      });
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setStartX(e.pageX - e.currentTarget.offsetLeft);
    setScrollLeft(e.currentTarget.scrollLeft);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - e.currentTarget.offsetLeft;
    const walk = (x - startX) * 0.8; // Reduced from 2 to 0.8 for slower scrolling
    e.currentTarget.scrollLeft = scrollLeft - walk;
  };

  const scrollContainer = (
    direction: "left" | "right",
    containerRef: React.RefObject<HTMLDivElement | null>
  ) => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const scrollAmount = 200;

    if (direction === "left") {
      container.scrollLeft -= scrollAmount;
    } else {
      container.scrollLeft += scrollAmount;
    }
  };

  const handleAssetSelect = (assetId: string) => {
    setSelectedAssets((prev) =>
      prev.includes(assetId)
        ? prev.filter((id) => id !== assetId)
        : [...prev, assetId]
    );
  };

  const handleBatchDelete = async () => {
    if (!selectedAssets.length) return;

    if (
      !confirm(
        `Are you sure you want to delete ${selectedAssets.length} assets?`
      )
    )
      return;

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("assets")
        .delete()
        .in("id", selectedAssets);

      if (error) throw error;

      // Clear selection and refresh assets
      setSelectedAssets([]);
      setIsBatchEditMode(false);
      refetch();
    } catch (error) {
      console.error("Error deleting assets:", error);
      alert("Failed to delete assets. Please try again.");
    }
  };

  // Show loading state while user profile is being fetched
  if (!user) {
    <div className="p-6 space-y-6">
      <Script
        type="module"
        src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js"
      />
      <div>
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex justify-end items-center"></div>

          {/* Controls */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-full h-[120px] flex-1 max-w-[1000px] min-w-[400px]">
              <div className="absolute inset-0 pt-3.5">
                {/* Categories skeleton */}
                <div className="flex items-center gap-2 justify-center pt-5">
                  <div className="flex items-center gap-1">
                    <div className="h-8 w-8 bg-muted rounded animate-pulse" />
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div
                        key={`category-skeleton-${i}`}
                        className="h-8 w-25 bg-muted rounded-md animate-pulse shrink-0"
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-8 w-8 bg-muted rounded animate-pulse" />
                  </div>
                </div>
              </div>
            </div>

            {/* Search and filters skeleton */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative w-[300px]">
                <div className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 bg-muted rounded animate-pulse" />
                <div className="h-10 w-full bg-muted rounded animate-pulse" />
              </div>
              <div className="h-10 w-[180px] bg-muted rounded animate-pulse" />
              <div className="flex items-center gap-1 border-border rounded-md">
                <div className="h-9 w-9 bg-muted rounded animate-pulse" />
                <div className="h-9 w-9 bg-muted rounded animate-pulse" />
                <div className="h-9 w-9 bg-muted rounded animate-pulse" />
              </div>
            </div>
          </div>

          {/* Asset Cards Grid */}
          <AssetLibrarySkeleton />
        </div>
      </div>
    </div>;
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Script
          type="module"
          src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js"
        />
        <div>
          <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex justify-between items-center"></div>

            {/* Controls */}
            <div className="flex items-center justify-between gap-4">
              <div className="relative w-full h-[120px] flex-1 max-w-[1000px] min-w-[400px]">
                <div className="absolute inset-0 pt-3.5">
                  {/* Categories skeleton */}
                  <div className="flex items-center gap-2 justify-center pt-5">
                    <div className="flex items-center gap-1">
                      <div className="h-8 w-8 bg-muted rounded animate-pulse" />
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div
                          key={`category-skeleton-${i}`}
                          className="h-8 w-25 bg-muted rounded-md animate-pulse shrink-0"
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="h-8 w-8 bg-muted rounded animate-pulse" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Search and filters skeleton */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="relative w-[300px]">
                  <div className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 bg-muted rounded animate-pulse" />
                  <div className="h-10 w-full bg-muted rounded animate-pulse" />
                </div>
                <div className="h-10 w-[180px] bg-muted rounded animate-pulse" />
                <div className="flex items-center gap-1 border-border rounded-md">
                  <div className="h-9 w-9 bg-muted rounded animate-pulse" />
                  <div className="h-9 w-9 bg-muted rounded animate-pulse" />
                  <div className="h-9 w-9 bg-muted rounded animate-pulse" />
                </div>
              </div>
            </div>

            {/* Asset Cards Grid */}
            <AssetLibrarySkeleton />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">
          {client && (
            <span className="px-3 py-1 rounded bg-muted text-sm font-medium border border-border text-muted-foreground">
              Client: {client}
            </span>
          )}
        </h1>
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => refetch()}>Try Again</Button>
          </div>
        </div>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">
          {client && (
            <span className="px-3 py-1 rounded bg-muted text-sm font-medium border border-border text-muted-foreground">
              Client: {client}
            </span>
          )}
        </h1>
        <div className="flex justify-center items-center h-64">
          <p className="text-muted-foreground">
            {client ? `No assets found for client: ${client}` : ""}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Script
        type="module"
        src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js"
      />
      <div>
        <div className="flex flex-col  ">
          {/* Breadcrumb Navigation */}

          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
                <SheetTrigger asChild></SheetTrigger>
                <SheetContent side="right" className="w-[400px] sm:w-[540px]">
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                  </SheetHeader>

                  <div className="py-4">
                    <div className="max-h-[80vh] overflow-y-auto pr-4">
                      <div className="space-y-6">
                        {/* Client Filter */}
                        {filterOptions.clients.length > 0 && (
                          <div>
                            <h3 className="text-sm font-medium mb-2 cursor-pointer">
                              Client
                            </h3>
                            <div className="space-y-2">
                              {filterOptions.clients.map((client) => (
                                <div
                                  key={client.value}
                                  className="flex items-center space-x-2"
                                >
                                  <input
                                    type="checkbox"
                                    id={`client-${client.value}`}
                                    checked={filters.client.includes(
                                      client.value
                                    )}
                                    onChange={(e) => {
                                      const newClients = e.target.checked
                                        ? [...filters.client, client.value]
                                        : filters.client.filter(
                                            (c) => c !== client.value
                                          );
                                      handleFilterChange("client", newClients);
                                    }}
                                    className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                                  />
                                  <label
                                    htmlFor={`client-${client.value}`}
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                  >
                                    {client.label}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Material Filter */}
                        <div>
                          <h3 className="text-sm font-medium mb-2 cursor-pointer">
                            Materials
                          </h3>
                          <Select
                            value={
                              filters.material.length > 0
                                ? filters.material[0]
                                : "all"
                            }
                            onValueChange={() => {}}
                          >
                            <SelectTrigger className="cursor-pointer">
                              <SelectValue>
                                {filters.material.length > 0
                                  ? `${filters.material.length} selected`
                                  : "Select materials"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="w-[300px] max-h-[300px]">
                              <div className="space-y-1 p-2">
                                {filterOptions.materials.map((material) => (
                                  <div
                                    key={material.value}
                                    className="flex items-center space-x-2 py-1 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      id={`material-${material.value}`}
                                      checked={filters.material.includes(
                                        material.value
                                      )}
                                      onChange={(e) => {
                                        const newMaterials = e.target.checked
                                          ? [
                                              ...filters.material,
                                              material.value,
                                            ]
                                          : filters.material.filter(
                                              (m) => m !== material.value
                                            );
                                        handleFilterChange(
                                          "material",
                                          newMaterials
                                        );
                                      }}
                                      className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                                    />
                                    <label
                                      htmlFor={`material-${material.value}`}
                                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                    >
                                      {material.label}
                                    </label>
                                  </div>
                                ))}
                              </div>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Color Filter */}
                        <div>
                          <h3 className="text-sm font-medium mb-2 cursor-pointer">
                            Colors
                          </h3>
                          <Select
                            value={
                              filters.color.length > 0
                                ? filters.color[0]
                                : "all"
                            }
                            onValueChange={() => {}}
                          >
                            <SelectTrigger className="cursor-pointer">
                              <SelectValue>
                                {filters.color.length > 0
                                  ? `${filters.color.length} selected`
                                  : "Select colors"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="w-[300px] max-h-[300px]">
                              <div className="space-y-1 p-2">
                                {filterOptions.colors.map((color) => (
                                  <div
                                    key={color.value}
                                    className="flex items-center space-x-2 py-1 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      id={`color-${color.value}`}
                                      checked={filters.color.includes(
                                        color.value
                                      )}
                                      onChange={(e) => {
                                        const newColors = e.target.checked
                                          ? [...filters.color, color.value]
                                          : filters.color.filter(
                                              (c) => c !== color.value
                                            );
                                        handleFilterChange("color", newColors);
                                      }}
                                      className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                                    />
                                    <label
                                      htmlFor={`color-${color.value}`}
                                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                    >
                                      {color.label}
                                    </label>
                                  </div>
                                ))}
                              </div>
                            </SelectContent>
                          </Select>
                        </div>

                        <Separator />

                        {/* Clear Filters Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={clearFilters}
                          className="ml-4 text-muted-foreground border-border/40 hover:bg-muted hover:text-foreground font-medium px-4 rounded-md shadow-sm transition-all duration-200 cursor-pointer"
                          title="Clear all filters"
                        >
                          Clear All
                        </Button>
                      </div>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Only show for admin - moved to the right */}
            {userRole === "admin" && (
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                {/* Hide on mobile, show on sm+ screens */}
                <div className="hidden sm:flex gap-2">
                  <Button onClick={() => setPreviewDialogOpen(true)}>
                    <span className="text-sm">Generate Previews</span>
                  </Button>

                  <PreviewGeneratorDialog
                    isOpen={previewDialogOpen}
                    onClose={() => setPreviewDialogOpen(false)}
                  />

                  <Button variant="default" asChild>
                    <Link
                      href="/asset-library/upload"
                      className="flex items-center gap-2"
                    >
                      Upload Assets
                    </Link>
                  </Button>

                  <Button
                    variant={isBatchEditMode ? "destructive" : "outline"}
                    onClick={() => {
                      setIsBatchEditMode(!isBatchEditMode);
                      if (!isBatchEditMode) setSelectedAssets([]);
                    }}
                  >
                    {isBatchEditMode ? "Cancel" : "Batch Edit"}
                  </Button>

                  {isBatchEditMode && selectedAssets.length > 0 && (
                    <Button variant="destructive" onClick={handleBatchDelete}>
                      Delete Selected ({selectedAssets.length})
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
          <div>
            <div className="mb-8 space-y-4 max-w-full mx-auto">
              {/* Desktop Layout */}
              <div className="hidden sm:flex items-center justify-between gap-4">
                {/* Fixed height container for category navigation */}
                <div className="relative w-full h-[120px] flex-1 max-w-[1200px] min-w-[400px]">
                  {/* Main Categories */}
                  <div
                    className={`absolute inset-0 pt-3.5 ${
                      !filters.category
                        ? "opacity-100"
                        : "opacity-0 pointer-events-none"
                    }`}
                  >
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-2.5">
                      {breadcrumbItems.map((item, index) => (
                        <div key={item.href} className="flex items-center">
                          <ChevronRight className="h-4 w-4 mx-2" />
                          <Link
                            href={item.href}
                            className={`hover:text-primary transition-colors flex items-center gap-1 cursor-pointer ${
                              index === breadcrumbItems.length - 1
                                ? "text-foreground font-medium"
                                : ""
                            }`}
                            onClick={(e) => {
                              if (item.onClick) {
                                e.preventDefault();
                                item.onClick();
                              }
                            }}
                          >
                            {item.label}
                          </Link>
                        </div>
                      ))}
                    </div>

                    <Carousel
                      opts={{
                        align: "start",
                        loop: false,
                      }}
                      className="w-full z-10 pr-10 pl-10 flex justify-start"
                    >
                      <CarouselContent className="-ml-2">
                        <CarouselItem className="pl-2 basis-auto">
                          <Button
                            variant={!filters.category ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleFilterChange("category", null)}
                            className={`shrink-0 pb-1 h-8 px-4 text-sm font-medium transition-colors duration-200 rounded-md cursor-pointer ${
                              !filters.category
                                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                : "hover:bg-accent hover:text-accent-foreground"
                            }`}
                          >
                            All Categories
                          </Button>
                        </CarouselItem>
                        {filterOptions.categories.map((category) => (
                          <CarouselItem
                            key={category.id}
                            className="pl-2 basis-auto "
                          >
                            <Button
                              variant={
                                filters.category === category.id
                                  ? "default"
                                  : "outline"
                              }
                              size="sm"
                              onClick={() =>
                                handleFilterChange("category", category.id)
                              }
                              className={`shrink-0 pb-1
                                 h-8 px-4 text-sm font-medium transition-colors duration-200 rounded-md cursor-pointer ${
                                   filters.category === category.id
                                     ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                     : "hover:bg-accent hover:text-accent-foreground"
                                 }`}
                            >
                              {category.name}
                            </Button>
                          </CarouselItem>
                        ))}
                      </CarouselContent>
                      <CarouselPrevious className="left-0" />
                      <CarouselNext className="right-0" />
                    </Carousel>
                  </div>

                  {/* Subcategory Navigation */}
                  <div
                    className={`absolute inset-0 pt-3.5 ${
                      filters.category
                        ? "opacity-100"
                        : "opacity-0 pointer-events-none"
                    }`}
                  >
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-2.5">
                      {breadcrumbItems.map((item, index) => (
                        <div key={item.href} className="flex items-center">
                          <ChevronRight className="h-4 w-4 mx-2" />
                          <Link
                            href={item.href}
                            className={`hover:text-primary transition-colors flex items-center gap-1 cursor-pointer ${
                              index === breadcrumbItems.length - 1
                                ? "text-foreground font-medium"
                                : ""
                            }`}
                            onClick={(e) => {
                              if (item.onClick) {
                                e.preventDefault();
                                item.onClick();
                              }
                            }}
                          >
                            {item.label}
                          </Link>
                        </div>
                      ))}
                    </div>

                    <Carousel
                      opts={{
                        align: "start",
                        loop: false,
                      }}
                      className="w-full z-10 pr-10 pl-10 "
                    >
                      <CarouselContent className="-ml-2">
                        <CarouselItem className="pl-2 basis-auto">
                          <Button
                            variant={
                              !filters.subcategory ? "default" : "outline"
                            }
                            size="sm"
                            onClick={() =>
                              handleFilterChange("subcategory", null)
                            }
                            className={`shrink-0 pb-1 h-8 px-4 text-sm font-medium transition-colors duration-200 rounded-md cursor-pointer ${
                              !filters.subcategory
                                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                : "hover:bg-accent hover:text-accent-foreground"
                            }`}
                          >
                            All Subcategories
                          </Button>
                        </CarouselItem>
                        {filterOptions.categories
                          .find((cat) => cat.id === filters.category)
                          ?.subcategories?.map((subcategory) => (
                            <CarouselItem
                              key={subcategory.id}
                              className="pl-2 basis-auto"
                            >
                              <Button
                                variant={
                                  filters.subcategory === subcategory.id
                                    ? "default"
                                    : "outline"
                                }
                                size="sm"
                                onClick={() =>
                                  handleFilterChange(
                                    "subcategory",
                                    subcategory.id
                                  )
                                }
                                className={`shrink-0 h-8 px-4 text-sm font-medium transition-colors duration-200 rounded-md cursor-pointer ${
                                  filters.subcategory === subcategory.id
                                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                    : "hover:bg-accent hover:text-accent-foreground"
                                }`}
                              >
                                {subcategory.name}
                              </Button>
                            </CarouselItem>
                          ))}
                      </CarouselContent>
                      <CarouselPrevious className="left-0" />
                      <CarouselNext className="right-0" />
                    </Carousel>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="relative w-[200px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search assets..."
                      value={searchValue}
                      onChange={(e) => {
                        setSearchValue(e.target.value);
                        setCurrentPage(1); // Reset to first page when searching
                      }}
                      className="pl-9"
                    />
                    {/* Active Filters */}
                    {(filters.category ||
                      filters.subcategory ||
                      filters.client.length > 0 ||
                      filters.material.length > 0 ||
                      filters.color.length > 0 ||
                      debouncedSearchValue) && (
                      <div className="absolute -bottom-7 left-0 right-0 flex flex-row gap-1.5 max-w-[300px]">
                        {debouncedSearchValue && (
                          <Badge
                            variant="secondary"
                            className="h-5 px-1.5 py-0.5 text-xs font-medium bg-muted/50 hover:bg-muted cursor-pointer flex items-center gap-1 whitespace-nowrap"
                            onClick={() => {
                              setSearchValue("");
                              setDebouncedSearchValue("");
                            }}
                          >
                            Search: {debouncedSearchValue}
                            <X className="h-3 w-3" />
                          </Badge>
                        )}
                        {filters.category && (
                          <Badge
                            variant="secondary"
                            className="h-5 px-1.5 py-0.5 text-xs font-medium bg-muted/50 hover:bg-muted cursor-pointer flex items-center gap-1 whitespace-nowrap"
                            onClick={() => handleFilterChange("category", null)}
                          >
                            Category:{" "}
                            {
                              filterOptions.categories.find(
                                (c) => c.id === filters.category
                              )?.name
                            }
                            <X className="h-3 w-3" />
                          </Badge>
                        )}
                        {filters.subcategory && (
                          <Badge
                            variant="secondary"
                            className="h-5 px-1.5 py-0.5 text-xs font-medium bg-muted/50 hover:bg-muted cursor-pointer flex items-center gap-1 whitespace-nowrap"
                            onClick={() =>
                              handleFilterChange("subcategory", null)
                            }
                          >
                            Subcategory:{" "}
                            {
                              filterOptions.categories
                                .find((c) => c.id === filters.category)
                                ?.subcategories.find(
                                  (s) => s.id === filters.subcategory
                                )?.name
                            }
                            <X className="h-3 w-3" />
                          </Badge>
                        )}
                        {filters.client.map((client) => (
                          <Badge
                            key={client}
                            variant="secondary"
                            className="h-5 px-1.5 py-0.5 text-xs font-medium bg-muted/50 hover:bg-muted cursor-pointer flex items-center gap-1 whitespace-nowrap"
                            onClick={() =>
                              handleFilterChange(
                                "client",
                                filters.client.filter((c) => c !== client)
                              )
                            }
                          >
                            Client:{" "}
                            {
                              filterOptions.clients.find(
                                (c) => c.value === client
                              )?.label
                            }
                            <X className="h-3 w-3" />
                          </Badge>
                        ))}
                        {filters.material.map((material) => (
                          <Badge
                            key={material}
                            variant="secondary"
                            className="h-5 px-1.5 py-0.5 text-xs font-medium bg-muted/50 hover:bg-muted cursor-pointer flex items-center gap-1 whitespace-nowrap"
                            onClick={() =>
                              handleFilterChange(
                                "material",
                                filters.material.filter((m) => m !== material)
                              )
                            }
                          >
                            Material:{" "}
                            {
                              filterOptions.materials.find(
                                (m) => m.value === material
                              )?.label
                            }
                            <X className="h-3 w-3" />
                          </Badge>
                        ))}
                        {filters.color.map((color) => (
                          <Badge
                            key={color}
                            variant="secondary"
                            className="h-5 px-1.5 py-0.5 text-xs font-medium bg-muted/50 hover:bg-muted cursor-pointer flex items-center gap-1 whitespace-nowrap"
                            onClick={() =>
                              handleFilterChange(
                                "color",
                                filters.color.filter((c) => c !== color)
                              )
                            }
                          >
                            Color:{" "}
                            {
                              filterOptions.colors.find(
                                (c) => c.value === color
                              )?.label
                            }
                            <X className="h-3 w-3" />
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <Select value={filters.sort} onValueChange={handleSortChange}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest</SelectItem>
                      <SelectItem value="oldest">Oldest</SelectItem>
                      <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                      <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                    </SelectContent>
                  </Select>

                  <Sheet
                    open={filterSheetOpen}
                    onOpenChange={setFilterSheetOpen}
                  >
                    <SheetTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 cursor-pointer"
                      >
                        <Filter className="h-4 w-4" />
                        Filters
                        {(filters.category ||
                          filters.subcategory ||
                          filters.client.length > 0 ||
                          filters.material.length > 0 ||
                          filters.color.length > 0) && (
                          <Badge variant="secondary" className="ml-1">
                            {
                              [
                                filters.category,
                                filters.subcategory,
                                ...filters.client,
                                ...filters.material,
                                ...filters.color,
                              ].filter(Boolean).length
                            }
                          </Badge>
                        )}
                      </Button>
                    </SheetTrigger>
                    <SheetContent
                      side="right"
                      className="w-[400px] sm:w-[540px]"
                    >
                      <SheetHeader>
                        <SheetTitle>Filters</SheetTitle>
                      </SheetHeader>

                      <div className="py-4">
                        <div className="max-h-[80vh] overflow-y-auto pr-4">
                          <div className="space-y-6">
                            {/* Client Filter */}
                            {filterOptions.clients.length > 0 && (
                              <div>
                                <h3 className="text-sm font-medium mb-2 cursor-pointer">
                                  Client
                                </h3>
                                <div className="space-y-2">
                                  {filterOptions.clients.map((client) => (
                                    <div
                                      key={client.value}
                                      className="flex items-center space-x-2"
                                    >
                                      <input
                                        type="checkbox"
                                        id={`client-${client.value}`}
                                        checked={filters.client.includes(
                                          client.value
                                        )}
                                        onChange={(e) => {
                                          const newClients = e.target.checked
                                            ? [...filters.client, client.value]
                                            : filters.client.filter(
                                                (c) => c !== client.value
                                              );
                                          handleFilterChange(
                                            "client",
                                            newClients
                                          );
                                        }}
                                        className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                                      />
                                      <label
                                        htmlFor={`client-${client.value}`}
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                      >
                                        {client.label}
                                      </label>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Material Filter */}
                            <div>
                              <h3 className="text-sm font-medium mb-2 cursor-pointer">
                                Materials
                              </h3>
                              <Select
                                value={
                                  filters.material.length > 0
                                    ? filters.material[0]
                                    : "all"
                                }
                                onValueChange={() => {}}
                              >
                                <SelectTrigger className="cursor-pointer">
                                  <SelectValue>
                                    {filters.material.length > 0
                                      ? `${filters.material.length} selected`
                                      : "Select materials"}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent className="w-[300px] max-h-[300px]">
                                  <div className="space-y-1 p-2">
                                    {filterOptions.materials.map((material) => (
                                      <div
                                        key={material.value}
                                        className="flex items-center space-x-2 py-1 cursor-pointer"
                                      >
                                        <input
                                          type="checkbox"
                                          id={`material-${material.value}`}
                                          checked={filters.material.includes(
                                            material.value
                                          )}
                                          onChange={(e) => {
                                            const newMaterials = e.target
                                              .checked
                                              ? [
                                                  ...filters.material,
                                                  material.value,
                                                ]
                                              : filters.material.filter(
                                                  (m) => m !== material.value
                                                );
                                            handleFilterChange(
                                              "material",
                                              newMaterials
                                            );
                                          }}
                                          className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                                        />
                                        <label
                                          htmlFor={`material-${material.value}`}
                                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                        >
                                          {material.label}
                                        </label>
                                      </div>
                                    ))}
                                  </div>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Color Filter */}
                            <div>
                              <h3 className="text-sm font-medium mb-2 cursor-pointer">
                                Colors
                              </h3>
                              <Select
                                value={
                                  filters.color.length > 0
                                    ? filters.color[0]
                                    : "all"
                                }
                                onValueChange={() => {}}
                              >
                                <SelectTrigger className="cursor-pointer">
                                  <SelectValue>
                                    {filters.color.length > 0
                                      ? `${filters.color.length} selected`
                                      : "Select colors"}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent className="w-[300px] max-h-[300px]">
                                  <div className="space-y-1 p-2">
                                    {filterOptions.colors.map((color) => (
                                      <div
                                        key={color.value}
                                        className="flex items-center space-x-2 py-1 cursor-pointer"
                                      >
                                        <input
                                          type="checkbox"
                                          id={`color-${color.value}`}
                                          checked={filters.color.includes(
                                            color.value
                                          )}
                                          onChange={(e) => {
                                            const newColors = e.target.checked
                                              ? [...filters.color, color.value]
                                              : filters.color.filter(
                                                  (c) => c !== color.value
                                                );
                                            handleFilterChange(
                                              "color",
                                              newColors
                                            );
                                          }}
                                          className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                                        />
                                        <label
                                          htmlFor={`color-${color.value}`}
                                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                        >
                                          {color.label}
                                        </label>
                                      </div>
                                    ))}
                                  </div>
                                </SelectContent>
                              </Select>
                            </div>

                            <Separator />

                            {/* Clear Filters Button */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={clearFilters}
                              className="ml-4 text-muted-foreground border-border/40 hover:bg-muted hover:text-foreground font-medium px-4 rounded-md shadow-sm transition-all duration-200 cursor-pointer"
                              title="Clear all filters"
                            >
                              Clear All
                            </Button>
                          </div>
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>

                  {/* Desktop View Options */}
                  <div className="hidden sm:flex items-center gap-1 border rounded-md">
                    <Button
                      variant={viewMode === "grid" ? "default" : "ghost"}
                      size="icon"
                      className="h-9 w-9 cursor-pointer"
                      onClick={() => setViewMode("grid")}
                      aria-label="Grid View"
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === "compactGrid" ? "default" : "ghost"}
                      size="icon"
                      className="h-9 w-9 cursor-pointer"
                      onClick={() => setViewMode("compactGrid")}
                      aria-label="Compact Grid View"
                    >
                      <Grid className="h-3 w-3" />
                    </Button>
                    <Button
                      variant={viewMode === "colGrid" ? "default" : "ghost"}
                      size="icon"
                      className="h-9 w-9 cursor-pointer"
                      onClick={() => setViewMode("colGrid")}
                      aria-label="Column Grid View"
                    >
                      <Rows className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Mobile View Options Dropdown */}
                  <div className="sm:hidden">
                    <Select
                      value={viewMode}
                      onValueChange={(
                        value: "grid" | "compactGrid" | "colGrid"
                      ) => setViewMode(value)}
                    >
                      <SelectTrigger className="w-[140px] cursor-pointer">
                        <SelectValue>
                          {viewMode === "grid" && (
                            <div className="flex items-center gap-2">
                              <LayoutGrid className="h-4 w-4" />
                              <span>Grid</span>
                            </div>
                          )}
                          {viewMode === "compactGrid" && (
                            <div className="flex items-center gap-2">
                              <Grid className="h-3 w-3" />
                              <span>Compact</span>
                            </div>
                          )}
                          {viewMode === "colGrid" && (
                            <div className="flex items-center gap-2">
                              <Rows className="h-3 w-3" />
                              <span>Column</span>
                            </div>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="grid" className="cursor-pointer">
                          <div className="flex items-center gap-2">
                            <LayoutGrid className="h-4 w-4" />
                            <span>Grid</span>
                          </div>
                        </SelectItem>
                        <SelectItem
                          value="compactGrid"
                          className="cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <Grid className="h-3 w-3" />
                            <span>Compact</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="colGrid" className="cursor-pointer">
                          <div className="flex items-center gap-2">
                            <Rows className="h-3 w-3" />
                            <span>Column</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Mobile Layout */}
              <div className="flex sm:hidden flex-col gap-4">
                {/* Category Navigation */}
                <div className="relative w-full z-10">
                  {/* Main Categories */}
                  <div
                    className={`relative w-full ${
                      !filters.category
                        ? "opacity-100"
                        : "opacity-0 pointer-events-none"
                    }`}
                  >
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-2.5">
                      {breadcrumbItems.map((item, index) => (
                        <div key={item.href} className="flex items-center">
                          <ChevronRight className="h-4 w-4 mx-2" />
                          <Link
                            href={item.href}
                            className={`hover:text-primary transition-colors flex items-center gap-1 cursor-pointer ${
                              index === breadcrumbItems.length - 1
                                ? "text-foreground font-medium"
                                : ""
                            }`}
                            onClick={(e) => {
                              if (item.onClick) {
                                e.preventDefault();
                                item.onClick();
                              }
                            }}
                          >
                            {item.label}
                          </Link>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 justify-start">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-foreground hover:text-primary transition-colors h-8 w-8 cursor-pointer"
                          onClick={() => {
                            if (categoryContainerRef.current) {
                              scrollContainer("left", categoryContainerRef);
                            }
                          }}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                      </div>
                      <div
                        ref={categoryContainerRef}
                        className="scroll-hidden flex items-center gap-2 overflow-x-auto cursor-grab active:cursor-grabbing select-none max-w-[800px] scroll-smooth"
                        onMouseDown={handleMouseDown}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseLeave}
                        onMouseMove={handleMouseMove}
                        style={{
                          scrollbarWidth: "none",
                          msOverflowStyle: "none",
                        }}
                      >
                        <Button
                          variant={!filters.category ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleFilterChange("category", null)}
                          className={`shrink-0 h-8 px-4 text-sm font-medium transition-colors duration-200 rounded-md cursor-pointer ${
                            !filters.category
                              ? "bg-primary text-primary-foreground"
                              : "border-border hover:bg-muted/50"
                          }`}
                        >
                          All Categories
                        </Button>
                        {filterOptions.categories.map((category) => (
                          <Button
                            key={category.id}
                            variant={
                              filters.category === category.id
                                ? "default"
                                : "outline"
                            }
                            size="sm"
                            onClick={() =>
                              handleFilterChange("category", category.id)
                            }
                            className={`shrink-0 h-8 px-4 text-sm font-medium transition-colors duration-200 rounded-md cursor-pointer ${
                              filters.category === category.id
                                ? "bg-primary text-primary-foreground"
                                : "border-border hover:bg-muted/50"
                            }`}
                          >
                            {category.name || "Uncategorized"}
                          </Button>
                        ))}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-foreground hover:text-primary transition-colors h-8 w-8 cursor-pointer"
                        onClick={() => {
                          if (categoryContainerRef.current) {
                            scrollContainer("right", categoryContainerRef);
                          }
                        }}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Subcategory Navigation */}
                  <div
                    className={`absolute inset-0 ${
                      filters.category
                        ? "opacity-100"
                        : "opacity-0 pointer-events-none"
                    }`}
                  >
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-2.5">
                      {breadcrumbItems.map((item, index) => (
                        <div key={item.href} className="flex items-center">
                          <ChevronRight className="h-4 w-4 mx-2" />
                          <Link
                            href={item.href}
                            className={`hover:text-primary transition-colors flex items-center gap-1 cursor-pointer ${
                              index === breadcrumbItems.length - 1
                                ? "text-foreground font-medium"
                                : ""
                            }`}
                            onClick={(e) => {
                              if (item.onClick) {
                                e.preventDefault();
                                item.onClick();
                              }
                            }}
                          >
                            {item.label}
                          </Link>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-foreground hover:text-primary transition-colors h-8 w-8 cursor-pointer"
                          onClick={() =>
                            scrollContainer("left", subcategoryContainerRef)
                          }
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                      </div>
                      <div
                        ref={subcategoryContainerRef}
                        className="flex items-center gap-2 overflow-x-auto cursor-grab active:cursor-grabbing select-none  scroll-smooth"
                        onMouseDown={handleMouseDown}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseLeave}
                        onMouseMove={handleMouseMove}
                        style={{
                          scrollbarWidth: "none",
                          msOverflowStyle: "none",
                        }}
                      >
                        <Button
                          variant={!filters.subcategory ? "default" : "outline"}
                          size="sm"
                          onClick={() =>
                            handleFilterChange("subcategory", null)
                          }
                          className={`shrink-0 h-8 px-4 text-sm font-medium transition-colors duration-200 rounded-md cursor-pointer ${
                            !filters.subcategory
                              ? "bg-primary/80 text-primary-foreground"
                              : "border-border hover:bg-muted/50"
                          }`}
                        >
                          All
                        </Button>

                        {filterOptions.categories
                          .find((c) => c.id === filters.category)
                          ?.subcategories.map((sub) => (
                            <Button
                              key={sub.id}
                              variant={
                                filters.subcategory === sub.id
                                  ? "default"
                                  : "outline"
                              }
                              size="sm"
                              onClick={() =>
                                handleFilterChange("subcategory", sub.id)
                              }
                              className={`shrink-0 h-8 px-4 text-sm font-medium transition-colors duration-200 rounded-md cursor-pointer ${
                                filters.subcategory === sub.id
                                  ? "bg-primary/80 text-primary-foreground"
                                  : "border-border hover:bg-muted/50"
                              }`}
                            >
                              {sub.name || "Uncategorized"}
                            </Button>
                          ))}
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-foreground hover:text-primary transition-colors h-8 w-8 cursor-pointer"
                          onClick={() =>
                            scrollContainer("right", subcategoryContainerRef)
                          }
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Search and Controls */}
                <div className="flex flex-col gap-2 mt-4">
                  <div className="relative w-full">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search assets..."
                        value={searchValue}
                        onChange={(e) => {
                          setSearchValue(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="pl-9"
                      />
                    </div>
                    {/* Active Filters */}
                    {(filters.category ||
                      filters.subcategory ||
                      filters.client.length > 0 ||
                      filters.material.length > 0 ||
                      filters.color.length > 0 ||
                      debouncedSearchValue) && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {debouncedSearchValue && (
                          <Badge
                            variant="secondary"
                            className="h-5 px-1.5 py-0.5 text-xs font-medium bg-muted/50 hover:bg-muted cursor-pointer flex items-center gap-1 whitespace-nowrap"
                            onClick={() => {
                              setSearchValue("");
                              setDebouncedSearchValue("");
                            }}
                          >
                            Search: {debouncedSearchValue}
                            <X className="h-3 w-3" />
                          </Badge>
                        )}
                        {filters.category && (
                          <Badge
                            variant="secondary"
                            className="h-5 px-1.5 py-0.5 text-xs font-medium bg-muted/50 hover:bg-muted cursor-pointer flex items-center gap-1 whitespace-nowrap"
                            onClick={() => handleFilterChange("category", null)}
                          >
                            Category:{" "}
                            {
                              filterOptions.categories.find(
                                (c) => c.id === filters.category
                              )?.name
                            }
                            <X className="h-3 w-3" />
                          </Badge>
                        )}
                        {filters.subcategory && (
                          <Badge
                            variant="secondary"
                            className="h-5 px-1.5 py-0.5 text-xs font-medium bg-muted/50 hover:bg-muted cursor-pointer flex items-center gap-1 whitespace-nowrap"
                            onClick={() =>
                              handleFilterChange("subcategory", null)
                            }
                          >
                            Subcategory:{" "}
                            {
                              filterOptions.categories
                                .find((c) => c.id === filters.category)
                                ?.subcategories.find(
                                  (s) => s.id === filters.subcategory
                                )?.name
                            }
                            <X className="h-3 w-3" />
                          </Badge>
                        )}
                        {filters.client.map((client) => (
                          <Badge
                            key={client}
                            variant="secondary"
                            className="h-5 px-1.5 py-0.5 text-xs font-medium bg-muted/50 hover:bg-muted cursor-pointer flex items-center gap-1 whitespace-nowrap"
                            onClick={() =>
                              handleFilterChange(
                                "client",
                                filters.client.filter((c) => c !== client)
                              )
                            }
                          >
                            Client:{" "}
                            {
                              filterOptions.clients.find(
                                (c) => c.value === client
                              )?.label
                            }
                            <X className="h-3 w-3" />
                          </Badge>
                        ))}
                        {filters.material.map((material) => (
                          <Badge
                            key={material}
                            variant="secondary"
                            className="h-5 px-1.5 py-0.5 text-xs font-medium bg-muted/50 hover:bg-muted cursor-pointer flex items-center gap-1 whitespace-nowrap"
                            onClick={() =>
                              handleFilterChange(
                                "material",
                                filters.material.filter((m) => m !== material)
                              )
                            }
                          >
                            Material:{" "}
                            {
                              filterOptions.materials.find(
                                (m) => m.value === material
                              )?.label
                            }
                            <X className="h-3 w-3" />
                          </Badge>
                        ))}
                        {filters.color.map((color) => (
                          <Badge
                            key={color}
                            variant="secondary"
                            className="h-5 px-1.5 py-0.5 text-xs font-medium bg-muted/50 hover:bg-muted cursor-pointer flex items-center gap-1 whitespace-nowrap"
                            onClick={() =>
                              handleFilterChange(
                                "color",
                                filters.color.filter((c) => c !== color)
                              )
                            }
                          >
                            Color:{" "}
                            {
                              filterOptions.colors.find(
                                (c) => c.value === color
                              )?.label
                            }
                            <X className="h-3 w-3" />
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Select
                      value={filters.sort}
                      onValueChange={handleSortChange}
                    >
                      <SelectTrigger className="w-full cursor-pointer">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name-asc" className="cursor-pointer">
                          Name (A-Z)
                        </SelectItem>
                        <SelectItem
                          value="name-desc"
                          className="cursor-pointer"
                        >
                          Name (Z-A)
                        </SelectItem>
                        <SelectItem value="date-asc" className="cursor-pointer">
                          Date (Oldest)
                        </SelectItem>
                        <SelectItem
                          value="date-desc"
                          className="cursor-pointer"
                        >
                          Date (Newest)
                        </SelectItem>
                        <SelectItem
                          value="updated-desc"
                          className="cursor-pointer"
                        >
                          Last Updated
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Sheet
                      open={filterSheetOpen}
                      onOpenChange={setFilterSheetOpen}
                    >
                      <SheetTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 cursor-pointer flex-1"
                        >
                          <Filter className="h-4 w-4" />
                          Filters
                          {(filters.category ||
                            filters.subcategory ||
                            filters.client.length > 0 ||
                            filters.material.length > 0 ||
                            filters.color.length > 0) && (
                            <Badge variant="secondary" className="ml-1">
                              {
                                [
                                  filters.category,
                                  filters.subcategory,
                                  ...filters.client,
                                  ...filters.material,
                                  ...filters.color,
                                ].filter(Boolean).length
                              }
                            </Badge>
                          )}
                        </Button>
                      </SheetTrigger>
                      <SheetContent
                        side="right"
                        className="w-[400px] sm:w-[540px]"
                      >
                        <SheetHeader>
                          <SheetTitle>Filters</SheetTitle>
                        </SheetHeader>

                        <div className="py-4">
                          <div className="max-h-[80vh] overflow-y-auto pr-4">
                            <div className="space-y-6">
                              {/* Client Filter */}
                              {filterOptions.clients.length > 0 && (
                                <div>
                                  <h3 className="text-sm font-medium mb-2 cursor-pointer">
                                    Client
                                  </h3>
                                  <div className="space-y-2">
                                    {filterOptions.clients.map((client) => (
                                      <div
                                        key={client.value}
                                        className="flex items-center space-x-2"
                                      >
                                        <input
                                          type="checkbox"
                                          id={`client-${client.value}`}
                                          checked={filters.client.includes(
                                            client.value
                                          )}
                                          onChange={(e) => {
                                            const newClients = e.target.checked
                                              ? [
                                                  ...filters.client,
                                                  client.value,
                                                ]
                                              : filters.client.filter(
                                                  (c) => c !== client.value
                                                );
                                            handleFilterChange(
                                              "client",
                                              newClients
                                            );
                                          }}
                                          className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                                        />
                                        <label
                                          htmlFor={`client-${client.value}`}
                                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                        >
                                          {client.label}
                                        </label>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Material Filter */}
                              <div>
                                <h3 className="text-sm font-medium mb-2 cursor-pointer">
                                  Materials
                                </h3>
                                <Select
                                  value={
                                    filters.material.length > 0
                                      ? filters.material[0]
                                      : "all"
                                  }
                                  onValueChange={() => {}}
                                >
                                  <SelectTrigger className="cursor-pointer">
                                    <SelectValue>
                                      {filters.material.length > 0
                                        ? `${filters.material.length} selected`
                                        : "Select materials"}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent className="w-[300px] max-h-[300px]">
                                    <div className="space-y-1 p-2">
                                      {filterOptions.materials.map(
                                        (material) => (
                                          <div
                                            key={material.value}
                                            className="flex items-center space-x-2 py-1 cursor-pointer"
                                          >
                                            <input
                                              type="checkbox"
                                              id={`material-${material.value}`}
                                              checked={filters.material.includes(
                                                material.value
                                              )}
                                              onChange={(e) => {
                                                const newMaterials = e.target
                                                  .checked
                                                  ? [
                                                      ...filters.material,
                                                      material.value,
                                                    ]
                                                  : filters.material.filter(
                                                      (m) =>
                                                        m !== material.value
                                                    );
                                                handleFilterChange(
                                                  "material",
                                                  newMaterials
                                                );
                                              }}
                                              className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                                            />
                                            <label
                                              htmlFor={`material-${material.value}`}
                                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                            >
                                              {material.label}
                                            </label>
                                          </div>
                                        )
                                      )}
                                    </div>
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Color Filter */}
                              <div>
                                <h3 className="text-sm font-medium mb-2 cursor-pointer">
                                  Colors
                                </h3>
                                <Select
                                  value={
                                    filters.color.length > 0
                                      ? filters.color[0]
                                      : "all"
                                  }
                                  onValueChange={() => {}}
                                >
                                  <SelectTrigger className="cursor-pointer">
                                    <SelectValue>
                                      {filters.color.length > 0
                                        ? `${filters.color.length} selected`
                                        : "Select colors"}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent className="w-[300px] max-h-[300px]">
                                    <div className="space-y-1 p-2">
                                      {filterOptions.colors.map((color) => (
                                        <div
                                          key={color.value}
                                          className="flex items-center space-x-2 py-1 cursor-pointer"
                                        >
                                          <input
                                            type="checkbox"
                                            id={`color-${color.value}`}
                                            checked={filters.color.includes(
                                              color.value
                                            )}
                                            onChange={(e) => {
                                              const newColors = e.target.checked
                                                ? [
                                                    ...filters.color,
                                                    color.value,
                                                  ]
                                                : filters.color.filter(
                                                    (c) => c !== color.value
                                                  );
                                              handleFilterChange(
                                                "color",
                                                newColors
                                              );
                                            }}
                                            className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                                          />
                                          <label
                                            htmlFor={`color-${color.value}`}
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                          >
                                            {color.label}
                                          </label>
                                        </div>
                                      ))}
                                    </div>
                                  </SelectContent>
                                </Select>
                              </div>

                              <Separator />

                              {/* Clear Filters Button */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={clearFilters}
                                className="ml-4 text-muted-foreground border-border/40 hover:bg-muted hover:text-foreground font-medium px-4 rounded-md shadow-sm transition-all duration-200 cursor-pointer"
                                title="Clear all filters"
                              >
                                Clear All
                              </Button>
                            </div>
                          </div>
                        </div>
                      </SheetContent>
                    </Sheet>

                    {/* Desktop View Options */}
                    <div className="hidden sm:flex items-center gap-1 border rounded-md">
                      <Button
                        variant={viewMode === "grid" ? "default" : "ghost"}
                        size="icon"
                        className="h-9 w-9 cursor-pointer"
                        onClick={() => setViewMode("grid")}
                        aria-label="Grid View"
                      >
                        <LayoutGrid className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={
                          viewMode === "compactGrid" ? "default" : "ghost"
                        }
                        size="icon"
                        className="h-9 w-9 cursor-pointer"
                        onClick={() => setViewMode("compactGrid")}
                        aria-label="Compact Grid View"
                      >
                        <Grid className="h-3 w-3" />
                      </Button>
                      <Button
                        variant={viewMode === "colGrid" ? "default" : "ghost"}
                        size="icon"
                        className="h-9 w-9 cursor-pointer"
                        onClick={() => setViewMode("colGrid")}
                        aria-label="Column Grid View"
                      >
                        <Rows className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Mobile View Options Dropdown */}
                    <div className="sm:hidden">
                      <Select
                        value={viewMode}
                        onValueChange={(
                          value: "grid" | "compactGrid" | "colGrid"
                        ) => setViewMode(value)}
                      >
                        <SelectTrigger className="w-[70px] cursor-pointer">
                          <SelectValue>
                            {viewMode === "grid" && (
                              <div className="flex items-center gap-2">
                                <LayoutGrid className="h-4 w-4" />
                              </div>
                            )}
                            {viewMode === "compactGrid" && (
                              <div className="flex items-center gap-2">
                                <Grid className="h-3 w-3" />
                              </div>
                            )}
                            {viewMode === "colGrid" && (
                              <div className="flex items-center gap-2">
                                <Rows className="h-3 w-3" />
                              </div>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="grid" className="cursor-pointer">
                            <div className="flex items-center gap-2">
                              <LayoutGrid className="h-4 w-4" />
                              <span>Grid</span>
                            </div>
                          </SelectItem>
                          <SelectItem
                            value="compactGrid"
                            className="cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <Grid className="h-3 w-3" />
                              <span>Compact</span>
                            </div>
                          </SelectItem>
                          <SelectItem
                            value="colGrid"
                            className="cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <Rows className="h-3 w-3" />
                              <span>Column</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className={
            viewMode === "grid"
              ? "grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 min-w-full mx-auto"
              : viewMode === "compactGrid"
                ? "grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 min-w-full mx-auto"
                : "flex flex-col gap-4 w-full"
          }
        >
          {currentAssets.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-12 px-4">
              <div className="w-16 h-16 mb-4 text-muted-foreground">
                <Search className="w-full h-full opacity-50" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No matches found</h3>
              <p className="text-muted-foreground text-center max-w-md">
                {debouncedSearchValue ? (
                  <>
                    No assets found matching{" "}
                    <span className="font-medium text-foreground">
                      &quot;{debouncedSearchValue}&quot;
                    </span>
                    {filters.category ||
                    filters.subcategory ||
                    filters.client.length > 0 ||
                    filters.material.length > 0 ||
                    filters.color.length > 0 ? (
                      <> with the current filters</>
                    ) : null}
                  </>
                ) : (
                  <>
                    No assets found
                    {filters.category ||
                    filters.subcategory ||
                    filters.client.length > 0 ||
                    filters.material.length > 0 ||
                    filters.color.length > 0 ? (
                      <> with the current filters</>
                    ) : null}
                  </>
                )}
              </p>
              {(debouncedSearchValue ||
                filters.category ||
                filters.subcategory ||
                filters.client.length > 0 ||
                filters.material.length > 0 ||
                filters.color.length > 0) && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    setSearchValue("");
                    setDebouncedSearchValue("");
                    clearFilters();
                  }}
                >
                  Clear all filters
                </Button>
              )}
            </div>
          ) : (
            currentAssets.map((asset) =>
              viewMode === "colGrid" ? (
                <Card
                  key={asset.id}
                  className="group relative overflow-hidden bg-gradient-to-br from-background via-background to-muted/20 border border-border/40 hover:border-primary/30 transition-all duration-500 hover:scale-[1.01] hover:shadow-2xl hover:shadow-primary/10 backdrop-blur-sm rounded-xl"
                >
                  <div className="flex gap-4 p-4">
                    {/* Image Section */}
                    <div className="relative w-96 h-96 shrink-0">
                      <div className="relative overflow-hidden rounded-lg ">
                        <div className="relative aspect-square overflow-hidden rounded-md bg-white dark:bg-black/50">
                          <Link
                            href={`/asset-library/${asset.id}`}
                            className="block w-full h-full cursor-pointer"
                            prefetch={true}
                          >
                            <Image
                              src={asset.preview_image || "/placeholder.png"}
                              alt={asset.product_name}
                              className="w-full h-full object-contain transition-all duration-700 group-hover:scale-102"
                              loading="lazy"
                              width={384}
                              height={384}
                            />
                          </Link>
                        </div>
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="flex-1 flex flex-col gap-3">
                      {/* Title and Category */}
                      <div className="space-y-2">
                        <CardTitle className="text-xl font-bold leading-tight group-hover:text-primary transition-all duration-300">
                          {asset.product_name}
                        </CardTitle>
                        <div className="flex flex-wrap gap-2">
                          <Badge
                            variant="secondary"
                            className="text-sm font-medium px-3 py-1 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20"
                          >
                            <span className="font-semibold">
                              {asset.category}
                            </span>
                          </Badge>
                          {asset.subcategory && (
                            <Badge
                              variant="outline"
                              className="text-sm font-medium px-3 py-1 border-border/60"
                            >
                              {asset.subcategory}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Additional Info - Made more compact */}
                      <div className="grid grid-cols-2 gap-4 p-3 bg-muted/20 rounded-lg border border-border/40">
                        {asset.client && (
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary/60"></span>
                              Client
                            </p>
                            <p className="text-sm text-foreground font-medium">
                              {asset.client}
                            </p>
                          </div>
                        )}
                        {asset.created_at && (
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary/60"></span>
                              Added
                            </p>
                            <p className="text-sm text-foreground font-medium">
                              {new Date(asset.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                        {asset.product_link && (
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary/60"></span>
                              Product Link
                            </p>
                            <a
                              href={asset.product_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline flex items-center gap-1.5 bg-primary/5 px-2 py-1 rounded-lg hover:bg-primary/10 transition-all duration-300"
                            >
                              View Product
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        )}
                        {asset.glb_link && (
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary/60"></span>
                              3D Model
                            </p>
                            <a
                              href={asset.glb_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline flex items-center gap-1.5 bg-primary/5 px-2 py-1 rounded-lg hover:bg-primary/10 transition-all duration-300"
                            >
                              View GLB
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Materials and Colors - Made more compact */}
                      {(asset.materials?.length > 0 ||
                        asset.colors?.length > 0) && (
                        <div className="flex flex-wrap gap-4 p-3 bg-muted/20 rounded-lg border border-border/40">
                          {asset.materials && asset.materials.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                Materials
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {asset.materials.map((material, index) => (
                                  <Badge
                                    key={material}
                                    variant="secondary"
                                    className="text-xs font-normal px-2 py-1 bg-muted/50"
                                    style={{
                                      animationDelay: `${index * 100}ms`,
                                    }}
                                  >
                                    {material.replace(/[[\]"]/g, "")}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {asset.colors && asset.colors.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                Colors
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {asset.colors.map((color, index) => (
                                  <Badge
                                    key={color}
                                    variant="outline"
                                    className="text-xs font-normal px-2 py-1 border-border/40"
                                    style={{
                                      animationDelay: `${index * 100}ms`,
                                    }}
                                  >
                                    {color.replace(/[[\]"]/g, "")}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Action Buttons - Made more compact */}
                      <div className="mt-auto flex items-center gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          className="w-32 group/btn h-8 font-medium bg-primary/90 hover:bg-primary/95 text-primary-foreground shadow-sm hover:shadow-md transition-all duration-300 rounded-lg"
                          asChild
                        >
                          <Link
                            href={`/asset-library/${asset.id}`}
                            className="flex items-center justify-center gap-2"
                            prefetch={true}
                          >
                            <span>View Details</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </Button>

                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 shrink-0 border-border/60 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 rounded-lg"
                          asChild
                          disabled={!asset.glb_link}
                        >
                          <a
                            href={asset.glb_link}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Download 3D Model"
                            className="flex items-center justify-center relative cursor-pointer"
                          >
                            <Download className="h-3 w-3" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ) : viewMode === "compactGrid" ? (
                <Link
                  href={`/asset-library/${asset.id}`}
                  className="block w-full h-full cursor-pointer"
                  prefetch={true}
                >
                  <Card
                    key={asset.id}
                    className="group relative overflow-hidden  via-background to-muted/20 border border-border/40   hover:scale-[1.01]  rounded-xl"
                  >
                    {isBatchEditMode && (
                      <div className="absolute top-2 left-2 z-10">
                        <input
                          type="checkbox"
                          checked={selectedAssets.includes(asset.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleAssetSelect(asset.id);
                          }}
                          className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                      </div>
                    )}
                    <div className="relative aspect-square overflow-hidden rounded-lg">
                      <Image
                        src={asset.preview_image || "/placeholder.png"}
                        alt={asset.product_name}
                        className="w-full h-full object-contain transition-all duration-700 group-hover:scale-102"
                        loading="lazy"
                        width={384}
                        height={384}
                      />
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/40 to-transparent opacity-0 group-hover:opacity-100  duration-300">
                      <div className="absolute bottom-2 left-2 right-2">
                        <Button
                          variant="default"
                          size="sm"
                          className="w-full h-8 text-xs font-medium  text-primary-foreground shadow-sm hover:shadow-md transition-all duration-300 rounded-lg"
                          asChild
                        >
                          <Link
                            href={`/asset-library/${asset.id}`}
                            className="flex items-center justify-center gap-1"
                            prefetch={true}
                          >
                            <span>View</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </Card>
                </Link>
              ) : (
                <Card
                  key={asset.id}
                  className="group relative overflow-hidden bg-gradient-to-br from-background via-background to-muted/20 border border-border/40 hover:border-primary/30 transition-all duration-500 hover:scale-[1.01] hover:shadow-2xl hover:shadow-primary/10 backdrop-blur-sm min-h-[220px] min-w-[220px] rounded-xl"
                >
                  {isBatchEditMode && (
                    <div className="absolute top-2 left-2 z-10">
                      <input
                        type="checkbox"
                        checked={selectedAssets.includes(asset.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleAssetSelect(asset.id);
                        }}
                        className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    </div>
                  )}
                  {/* Subtle gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                  <CardHeader
                    className={`relative ${viewMode === "grid" ? "p-3" : "p-3 w-32 shrink-0"}`}
                  >
                    {/* Image container with loading state */}

                    <div className="relative aspect-square overflow-hidden rounded-lg  dark:bg-black/50">
                      <Link
                        href={`/asset-library/${asset.id}`}
                        className="block w-full h-full cursor-pointer"
                        prefetch={true}
                      >
                        <Image
                          src={asset.preview_image || "/placeholder.png"}
                          alt={asset.product_name}
                          className="w-full h-full object-contain transition-all duration-700 group-hover:scale-101"
                          loading="lazy"
                          width={384}
                          height={384}
                        />
                      </Link>
                    </div>

                    {/* Floating status indicator */}
                  </CardHeader>

                  <CardContent className="relative flex-1 flex flex-col p-3 space-y-3">
                    <div className="space-y-2">
                      {/* Title with enhanced typography */}
                      <div className="space-y-2">
                        <CardTitle className="line-clamp-2 text-base font-medium leading-tight">
                          {asset.product_name}
                        </CardTitle>

                        {/* Premium divider */}
                        <div className="relative h-px bg-gradient-to-r from-transparent via-border to-transparent group-hover:via-primary/40 transition-all duration-500"></div>
                      </div>

                      {/* Enhanced category badges */}
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          variant="secondary"
                          className="text-xs font-medium px-3 py-1 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20"
                        >
                          <span className="font-semibold">
                            {asset.category}
                          </span>
                        </Badge>
                        {asset.subcategory && (
                          <Badge
                            variant="outline"
                            className="text-xs font-medium px-3 py-1 border-border/60"
                          >
                            {asset.subcategory}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Enhanced action buttons */}
                    <div className="mt-auto pt-4 flex items-center gap-2">
                      <Button
                        variant="default"
                        size="default"
                        className="flex-1 group/btn h-9 font-medium bg-primary/90  hover:bg-primary/95 text-primary-foreground shadow-sm hover:shadow-md transition-all duration-300 rounded-lg"
                        asChild
                      >
                        <Link
                          href={`/asset-library/${asset.id}`}
                          className="flex items-center justify-center gap-2"
                          prefetch={true}
                        >
                          <span>View Details</span>
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>

                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0 border-border/60 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 rounded-lg"
                        asChild
                        disabled={!asset.glb_link}
                      >
                        <a
                          href={asset.glb_link}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Download 3D Model"
                          className="flex items-center justify-center relative cursor-pointer"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            )
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="cursor-pointer"
            >
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="cursor-pointer"
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="cursor-pointer"
            >
              Next
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="cursor-pointer"
            >
              Last
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
