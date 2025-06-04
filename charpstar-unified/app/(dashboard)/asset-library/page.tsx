"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Download,
  ExternalLink,
  Search,
  Grid,
  Filter,
  X,
  ChevronRight,
  Home,
  ChevronLeft,
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
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useUser } from "@/contexts/useUser";
import { AssetCardSkeleton } from "@/components/ui/asset-card-skeleton";
import { PreviewGeneratorDialog } from "./components/preview-generator-dialog";
import { createClient } from "@/utils/supabase/client";

type SortOption = "name-asc" | "name-desc" | "date-asc" | "date-desc";

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
    totalCount,
  } = useAssets();
  const [searchValue, setSearchValue] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "compactGrid" | "list">(
    "grid"
  );
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const user = useUser();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const categoryContainerRef = useRef<HTMLDivElement>(null);
  const subcategoryContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) return;
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (data?.role) setUserRole(data.role);
    };
    fetchUserRole();
  }, [user]);

  const ITEMS_PER_PAGE = 52;

  // Filter assets based on search and sort
  const filteredAssets = assets
    .filter((asset) =>
      asset.product_name.toLowerCase().includes(searchValue.toLowerCase())
    )
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
    if (key === "category" && value === null) {
      // When clearing category, also clear subcategory
      setFilters({ ...filters, category: null, subcategory: null });
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
    if (searchValue) params.set("search", searchValue);

    const newUrl = `${pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    router.push(newUrl, { scroll: false });
  }, [filters, searchValue, pathname, router]);

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
  }, [searchParams]);

  // Breadcrumb items
  const breadcrumbItems: {
    label: string;
    href: string;
    icon?: React.ReactNode;
    onClick?: () => void;
  }[] = [
    {
      label: "Home",
      href: "/asset-library",
      icon: <Home className="h-4 w-4" />,
    },
  ];

  // Always include Asset Library
  breadcrumbItems.push({
    label: "Asset Library",
    href: buildUrlWithFilters({ category: null, subcategory: null }),
    onClick: () => {
      setFilters((prev) => ({
        ...prev,
        category: null,
        subcategory: null,
      }));
    },
  });

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
    containerRef: React.RefObject<HTMLDivElement>
  ) => {
    if (containerRef.current) {
      const scrollAmount = 200; // Adjust this value to control scroll distance
      containerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  // Show loading state while user profile is being fetched
  if (!user) {
    return (
      <div className="p-6">
        <div className="flex flex-col gap-4">
          <div className="flex  items-center">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold">Library</h1>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <AssetCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <Script
          type="module"
          src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js"
        />
        <div className="flex flex-col gap-4">
          <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-2">
            {breadcrumbItems.map((item, index) => (
              <div key={item.href} className="flex items-center">
                {index > 0 && <ChevronRight className="h-4 w-4 mx-2" />}
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
                  {item.icon || item.label}
                </Link>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4 mb-6">
              <h1 className="text-2xl font-bold">Library</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="default" asChild>
                <Link
                  href="/asset-library/upload"
                  className="flex items-center gap-2"
                >
                  Upload Assets
                </Link>
              </Button>
            </div>
          </div>

          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 border rounded-md">
                {/* <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setViewMode("grid")}
                  aria-label="Grid View"
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "compactGrid" ? "default" : "ghost"}
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setViewMode("compactGrid")}
                  aria-label="Compact Grid View"
                >
                  <Grid className="h-3 w-3" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setViewMode("list")}
                  aria-label="List View"
                >
                  <List className="h-4 w-4" />
                </Button> */}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 pl-10 pr-10">
            {Array.from({ length: 12 }).map((_, i) => (
              <AssetCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">
          Library{" "}
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
          Library{" "}
          {client && (
            <span className="px-3 py-1 rounded bg-muted text-sm font-medium border border-border text-muted-foreground">
              Client: {client}
            </span>
          )}
        </h1>
        <div className="flex justify-center items-center h-64">
          <p className="text-muted-foreground">
            {client
              ? `No assets found for client: ${client}`
              : "No assets found"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Script
        type="module"
        src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js"
      />
      <div className="flex flex-col gap-4">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-2">
          {breadcrumbItems.map((item, index) => (
            <div key={item.href} className="flex items-center">
              {index > 0 && <ChevronRight className="h-4 w-4 mx-2" />}
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
                {item.icon || item.label}
              </Link>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4 mb-6">
            <h1 className="text-2xl font-bold">Library</h1>
            <Badge variant="secondary" className="text-sm">
              {totalCount} {totalCount === 1 ? "Model" : "Models"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
              <SheetContent side="right" className="w-[400px] sm:w-[540px]">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>

                <div className="py-4">
                  <div className="h-[calc(100vh-8rem)] overflow-y-auto pr-4">
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
                                        ? [...filters.material, material.value]
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
                            filters.color.length > 0 ? filters.color[0] : "all"
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

            {/* Only show for admin */}
            {userRole === "admin" && (
              <>
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
              </>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2 ml-auto">
            <div className="relative w-96">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search assets..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filters.sort} onValueChange={handleSortChange}>
              <SelectTrigger className="w-[180px] cursor-pointer">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name-asc" className="cursor-pointer">
                  Name (A-Z)
                </SelectItem>
                <SelectItem value="name-desc" className="cursor-pointer">
                  Name (Z-A)
                </SelectItem>
                <SelectItem value="date-asc" className="cursor-pointer">
                  Date (Oldest First)
                </SelectItem>
                <SelectItem value="date-desc" className="cursor-pointer">
                  Date (Newest First)
                </SelectItem>
              </SelectContent>
            </Select>
            <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
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
            </Sheet>
            <div className="flex items-center gap-1 border rounded-md">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="icon"
                className="h-9 w-9 cursor-pointer"
                onClick={() => setViewMode("grid")}
                aria-label="Grid View"
              >
                <Grid className="h-4 w-4" />
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
            </div>
          </div>
        </div>

        <div className="mb-8 space-y-4">
          <div className="flex flex-row gap-4">
            {/* Main Categories */}
            {!filters.category && (
              <div className="relative w-full">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-0.5 w-6 bg-primary rounded-full"></div>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Categories
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <div
                    ref={categoryContainerRef}
                    className="flex items-center gap-2 overflow-x-auto pb-2 px-1 cursor-grab active:cursor-grabbing select-none max-w-[1300px]"
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
                      className={`shrink-0 h-8 px-4 text-sm font-medium transition-colors duration-200 rounded-md ${
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
                        className={`shrink-0 h-8 px-4 text-sm font-medium transition-colors duration-200 rounded-md ${
                          filters.category === category.id
                            ? "bg-primary text-primary-foreground"
                            : "border-border hover:bg-muted/50"
                        }`}
                      >
                        {category.name || "Uncategorized"}
                      </Button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-foreground hover:text-primary transition-colors"
                      onClick={() =>
                        scrollContainer("left", categoryContainerRef)
                      }
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-foreground hover:text-primary transition-colors"
                      onClick={() =>
                        scrollContainer("right", categoryContainerRef)
                      }
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Subcategory Navigation */}
            {filters.category && (
              <div className="relative w-full">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-0.5 w-6 bg-primary/60 rounded-full"></div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {filterOptions.categories.find(
                      (c) => c.id === filters.category
                    )?.name || "Subcategories"}
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFilterChange("category", null)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Back to Categories
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <div
                    ref={subcategoryContainerRef}
                    className="flex items-center gap-2 overflow-x-auto pb-2 px-1 cursor-grab active:cursor-grabbing select-none max-w-[1300px]"
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
                      onClick={() => handleFilterChange("subcategory", null)}
                      className={`shrink-0 h-8 px-4 text-sm font-medium transition-colors duration-200 rounded-md ${
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
                          className={`shrink-0 h-8 px-4 text-sm font-medium transition-colors duration-200 rounded-md ${
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
                      className="text-foreground hover:text-primary transition-colors"
                      onClick={() =>
                        scrollContainer("left", subcategoryContainerRef)
                      }
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-foreground hover:text-primary transition-colors"
                      onClick={() =>
                        scrollContainer("right", subcategoryContainerRef)
                      }
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div
          className={
            viewMode === "grid"
              ? "grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 max-w-[2000px] mx-auto"
              : "flex flex-col gap-4 w-full"
          }
        >
          {currentAssets.map((asset) =>
            viewMode === "compactGrid" ? (
              <Card
                key={asset.id}
                className="group relative overflow-hidden bg-gradient-to-br from-background via-background to-muted/20 border border-border/40 hover:border-primary/30 transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl hover:shadow-primary/10 backdrop-blur-sm rounded-xl"
              >
                <div className="flex gap-4 p-4">
                  {/* Image Section */}
                  <div className="relative w-96 h-96 shrink-0">
                    <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-muted/30 to-muted/10 p-2 group-hover:shadow-lg transition-all duration-500">
                      <div className="relative aspect-square overflow-hidden rounded-md bg-white dark:bg-black/50">
                        <Link
                          href={`/asset-library/${asset.id}`}
                          className="block w-full h-full cursor-pointer"
                          prefetch={true}
                        >
                          <img
                            src={asset.preview_image || "/placeholder.png"}
                            alt={asset.product_name}
                            className="w-full h-full object-contain transition-all duration-700 group-hover:scale-105"
                            loading="lazy"
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
                          className="text-base font-medium px-4 py-1 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20"
                        >
                          <span className="font-semibold">
                            {asset.category}
                          </span>
                        </Badge>
                        {asset.subcategory && (
                          <Badge
                            variant="outline"
                            className="text-base font-medium px-4 py-1 border-border/60"
                          >
                            {asset.subcategory}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Additional Info */}
                    <div className="grid grid-cols-3 gap-4 p-4 bg-muted/20 rounded-lg border border-border/40">
                      {asset.client && (
                        <div className="space-y-2">
                          <p className="text-lg font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary/60"></span>
                            Client
                          </p>
                          <p className="text-base text-foreground font-medium">
                            {asset.client}
                          </p>
                        </div>
                      )}
                      {asset.created_at && (
                        <div className="space-y-2">
                          <p className="text-lg font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary/60"></span>
                            Added
                          </p>
                          <p className="text-base text-foreground font-medium">
                            {new Date(asset.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                      {asset.product_link && (
                        <div className="space-y-2">
                          <p className="text-lg font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary/60"></span>
                            Product Link
                          </p>
                          <a
                            href={asset.product_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-base text-primary hover:underline flex items-center gap-1.5 bg-primary/5 px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-all duration-300"
                          >
                            View Product
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      )}
                      {asset.glb_link && (
                        <div className="space-y-2">
                          <p className="text-lg font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary/60"></span>
                            3D Model
                          </p>
                          <a
                            href={asset.glb_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-base text-primary hover:underline flex items-center gap-1.5 bg-primary/5 px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-all duration-300"
                          >
                            View GLB
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      )}
                      {asset.tags && asset.tags.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-lg font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary/60"></span>
                            Tags
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {asset.tags.map((tag) => (
                              <Badge
                                key={tag}
                                variant="secondary"
                                className="text-sm font-normal px-3 py-1 bg-muted/50 hover:bg-muted transition-all duration-300"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Materials and Colors */}
                    <div className="flex flex-wrap gap-8 p-6 bg-muted/20 rounded-xl border border-border/40 ">
                      {asset.materials && asset.materials.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-lg font-medium text-muted-foreground uppercase tracking-wider">
                            Materials
                          </p>
                          <div className="flex flex-wrap gap-3">
                            {asset.materials.map((material, index) => (
                              <Badge
                                key={material}
                                variant="secondary"
                                className="text-base font-normal px-4 py-1.5 bg-muted/50"
                                style={{ animationDelay: `${index * 100}ms` }}
                              >
                                {material.replace(/[[\]"]/g, "")}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {asset.colors && asset.colors.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-lg font-medium text-muted-foreground uppercase tracking-wider">
                            Colors
                          </p>
                          <div className="flex flex-wrap gap-3">
                            {asset.colors.map((color, index) => (
                              <Badge
                                key={color}
                                variant="outline"
                                className="text-base font-normal px-4 py-1.5 border-border/40"
                                style={{ animationDelay: `${index * 100}ms` }}
                              >
                                {color.replace(/[[\]"]/g, "")}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons - More compact */}
                    <div className="mt-auto flex items-center gap-2">
                      <Button
                        variant="default"
                        size="default"
                        className="w-40 group/btn h-9 font-medium bg-primary/90 hover:bg-primary/95 text-primary-foreground shadow-sm hover:shadow-md transition-all duration-300 rounded-lg"
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
                  </div>
                </div>
              </Card>
            ) : (
              <Card
                key={asset.id}
                className="group relative overflow-hidden bg-gradient-to-br from-background via-background to-muted/20 border border-border/40 hover:border-primary/30 transition-all duration-500 hover:scale-[1.01] hover:shadow-2xl hover:shadow-primary/10 backdrop-blur-sm min-h-[220px] min-w-[220px] rounded-xl"
              >
                {/* Subtle gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                <CardHeader
                  className={`relative ${viewMode === "grid" ? "p-3" : "p-3 w-32 shrink-0"}`}
                >
                  {/* Image container with loading state */}
                  <div className="relative aspect-square overflow-hidden rounded-lg bg-white dark:bg-black/50">
                    <Link
                      href={`/asset-library/${asset.id}`}
                      className="block w-full h-full cursor-pointer"
                      prefetch={true}
                    >
                      <img
                        src={asset.preview_image || "/placeholder.png"}
                        alt={asset.product_name}
                        className="w-full h-full object-contain transition-all duration-700 group-hover:scale-103"
                        loading="lazy"
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
                      <div className="relative h-px bg-gradient-to-r from-transparent via-border to-transparent group-hover:via-primary/40 transition-all duration-500">
                        <div className="absolute left-1/2 top-1/2 w-1 h-1 bg-primary/60 rounded-full transform -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </div>
                    </div>

                    {/* Enhanced category badges */}
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant="secondary"
                        className="text-xs font-medium px-3 py-1 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20"
                      >
                        <span className="font-semibold">{asset.category}</span>
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

                    {/* Material and color tags with enhanced styling */}
                    <div className="space-y-2">
                      {asset.materials && asset.materials.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Materials
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {asset.materials
                              .slice(0, 3)
                              .map((material, index) => (
                                <Badge
                                  key={material}
                                  variant="secondary"
                                  className="text-xs font-normal px-2 py-0.5 bg-muted/50"
                                  style={{ animationDelay: `${index * 100}ms` }}
                                >
                                  {material.replace(/[[\]"]/g, "")}
                                </Badge>
                              ))}
                            {asset.materials.length > 3 && (
                              <Badge className="text-xs font-normal px-2 py-0.5">
                                +{asset.materials.length - 3}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {asset.colors && asset.colors.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Colors
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {asset.colors.slice(0, 4).map((color, index) => (
                              <Badge
                                key={color}
                                variant="outline"
                                className="text-xs font-normal px-2 py-0.5 border-border/40"
                                style={{ animationDelay: `${index * 100}ms` }}
                              >
                                {color.replace(/[[\]"]/g, "")}
                              </Badge>
                            ))}
                            {asset.colors.length > 4 && (
                              <Badge
                                variant="ghost"
                                className="text-xs font-normal px-2 py-0.5"
                              >
                                +{asset.colors.length - 4}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Enhanced action buttons */}
                  <div className="mt-auto pt-4 flex items-center gap-2">
                    <Button
                      variant="default"
                      size="default"
                      className="flex-1 group/btn h-9 font-medium bg-primary/90 hover:bg-primary/95 text-primary-foreground shadow-sm hover:shadow-md transition-all duration-300 rounded-lg"
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
