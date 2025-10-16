"use client";

import { Button } from "@/components/ui/display";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/containers";
import { useAssets } from "../../../hooks/use-assets";
import {
  useState,
  useEffect,
  useMemo,
  Suspense,
  useCallback,
  useRef,
} from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useUser } from "@/contexts/useUser";
import { createClient } from "@/utils/supabase/client";
import { AssetLibraryControlPanel } from "@/components/asset-library/AssetLibraryControlPanel";
import { translateSwedishToEnglish } from "@/utils/swedishTranslations";
import { AssetLibrarySkeleton } from "@/components/ui/skeletons";
import { Search } from "lucide-react";
import React from "react";
import { Card, CardContent } from "@/components/ui/containers/card";
import { AssetLibraryIntroPopup } from "@/components/asset-library/AssetLibraryIntroPopup";

// Lazy load heavy components
const LazyAssetCard = React.lazy(() => import("@/app/components/ui/AssetCard"));
const LazyPreviewGeneratorDialog = React.lazy(() =>
  import("@/components/asset-library/dialogs/preview-generator-dialog").then(
    (module) => ({
      default: module.PreviewGeneratorDialog,
    })
  )
);
const LazyBatchUploadSheet = React.lazy(() =>
  import("@/components/asset-library/components/batch-upload-sheet").then(
    (module) => ({
      default: module.BatchUploadSheet,
    })
  )
);

type SortOption =
  | "name-asc"
  | "name-desc"
  | "date-asc"
  | "date-desc"
  | "updated-desc";

// New function to calculate search relevance score
const calculateSearchRelevance = (searchTerm: string, asset: any): number => {
  if (!searchTerm || !asset) return 0;

  const searchLower = translateSwedishToEnglish(searchTerm.toLowerCase());
  const productName = asset.product_name?.toLowerCase() || "";
  const articleId = asset.article_id?.toLowerCase() || "";
  const materials = asset.materials?.map((m: string) => m.toLowerCase()) || [];
  const colors = asset.colors?.map((c: string) => c.toLowerCase()) || [];
  const tags = asset.tags?.map((t: string) => t.toLowerCase()) || [];

  let score = 0;

  // Exact matches get highest scores
  if (productName.includes(searchLower)) {
    score += 100;
    // Bonus for exact product name match
    if (productName === searchLower) score += 50;
  }

  // Article ID matches (high priority for exact matches)
  if (articleId.includes(searchLower)) {
    score += 90;
    // Bonus for exact article ID match
    if (articleId === searchLower) score += 60;
  }

  // Material matches
  materials.forEach((material: string) => {
    if (material.includes(searchLower)) {
      score += 30;
      if (material === searchLower) score += 20;
    }
  });

  // Color matches
  colors.forEach((color: string) => {
    if (color.includes(searchLower)) {
      score += 25;
      if (color === searchLower) score += 15;
    }
  });

  // Tag matches
  tags.forEach((tag: string) => {
    if (tag.includes(searchLower)) {
      score += 20;
      if (tag === searchLower) score += 10;
    }
  });

  // Word boundary matches (higher relevance)
  const searchWords = searchLower.split(/\s+/);
  searchWords.forEach((word) => {
    if (word.length >= 3) {
      // Check if word appears at word boundaries
      const wordBoundaryRegex = new RegExp(`\\b${word}\\b`, "i");
      if (wordBoundaryRegex.test(productName)) score += 40;
      if (wordBoundaryRegex.test(articleId)) score += 35;
      if (wordBoundaryRegex.test(materials.join(" "))) score += 25;
      if (wordBoundaryRegex.test(colors.join(" "))) score += 20;
      if (wordBoundaryRegex.test(tags.join(" "))) score += 15;
    }
  });

  return score;
};

export default function AssetLibraryPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const {
    assets,
    loading,

    refetch,
    filterOptions,
    filters,
    setFilters,
    filteredAssets: hookFilteredAssets,
  } = useAssets();
  const [searchValue, setSearchValue] = useState("");
  const [activeSearchValue, setActiveSearchValue] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "compactGrid">("grid");
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [batchUploadOpen, setBatchUploadOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const user = useUser();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [isBatchEditMode, setIsBatchEditMode] = useState(false);
  const [canDownloadGLB, setCanDownloadGLB] = useState(false);

  // Search timeout ref
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track if this is the first render after initialization to prevent premature URL sync
  const skipFirstUrlUpdate = useRef(false);

  // Filter state
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [showInactiveOnly, setShowInactiveOnly] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showIntroPopup, setShowIntroPopup] = useState(false);

  // Debounced search function
  const debouncedSearch = useCallback((value: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setActiveSearchValue(value);
      setCurrentPage(1);
    }, 300);
  }, []);

  // Optimized search function with memoization
  const optimizedSearch = useCallback(
    (searchTerm: string, asset: any): boolean => {
      if (!searchTerm || !asset) return false;

      const translatedSearch = translateSwedishToEnglish(
        searchTerm.toLowerCase()
      );
      const searchTerms = translatedSearch
        .split(/,|\s+/)
        .filter((term) => term.trim());
      const productName = asset.product_name?.toLowerCase() || "";
      const articleId = asset.article_id?.toLowerCase() || "";

      // Check if any of the translated search terms match
      return searchTerms.some((searchTerm) => {
        // Quick exact match check first
        if (productName.includes(searchTerm)) return true;
        if (articleId.includes(searchTerm)) return true;

        // Then check other fields
        return (
          asset.materials?.some((material: string) =>
            material.toLowerCase().includes(searchTerm)
          ) ||
          asset.colors?.some((color: string) =>
            color.toLowerCase().includes(searchTerm)
          ) ||
          asset.tags?.some((tag: string) =>
            tag.toLowerCase().includes(searchTerm)
          )
        );
      });
    },
    []
  );

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) {
        setCanDownloadGLB(false);
        return;
      }

      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("role, client")
        .eq("id", user.id)
        .single();

      if (data?.role) setUserRole(data.role);

      // Admins can always download
      if (data?.role === "admin") {
        setCanDownloadGLB(true);
        return;
      }

      // Check enterprise contract
      if (data?.client) {
        const clientNames = Array.isArray(data.client)
          ? data.client
          : [data.client];

        const { data: clients } = await supabase
          .from("clients")
          .select("contract_type")
          .in("name", clientNames);

        const hasEnterprise = clients?.some(
          (c) => c.contract_type === "enterprise"
        );
        setCanDownloadGLB(hasEnterprise || false);
      } else {
        setCanDownloadGLB(false);
      }
    };
    fetchUserRole();
  }, [user]);

  // Check for first visit and show intro popup
  useEffect(() => {
    const hasSeenIntro = localStorage.getItem("asset-library-intro-seen");
    if (!hasSeenIntro && user?.metadata?.role !== "admin") {
      // Only show for client users, and only after a short delay to let the page load
      const timer = setTimeout(() => {
        setShowIntroPopup(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [user?.metadata?.role]);

  const ITEMS_PER_PAGE = 60;

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeSearchValue]);

  // Filter assets based on active search, category, and other filters
  const filteredAssets = useMemo(() => {
    return hookFilteredAssets
      .filter((asset) => {
        // Apply active/inactive filter
        if (showInactiveOnly && asset.active !== false) {
          return false;
        }

        // Apply search filter with optimized search
        if (activeSearchValue) {
          if (!optimizedSearch(activeSearchValue, asset)) return false;
        }

        // Apply material filter
        if (selectedMaterials.length > 0) {
          const hasSelectedMaterial = asset.materials?.some((material) =>
            selectedMaterials.includes(material)
          );
          if (!hasSelectedMaterial) return false;
        }

        // Apply color filter
        if (selectedColors.length > 0) {
          const hasSelectedColor = asset.colors?.some((color) =>
            selectedColors.includes(color)
          );
          if (!hasSelectedColor) return false;
        }

        // Apply company/client filter
        if (selectedCompanies.length > 0) {
          const hasSelectedCompany = selectedCompanies.includes(
            asset.client || ""
          );
          if (!hasSelectedCompany) return false;
        }

        return true;
      })
      .map((asset) => {
        // Add relevance score for search results
        const relevanceScore = activeSearchValue
          ? calculateSearchRelevance(activeSearchValue, asset)
          : 0;

        return { ...asset, relevanceScore };
      })
      .sort((a, b) => {
        // If there's an active search, sort by relevance first
        if (activeSearchValue) {
          if (b.relevanceScore !== a.relevanceScore) {
            return b.relevanceScore - a.relevanceScore;
          }
        }

        // Then apply the selected sort order
        switch (filters.sort) {
          case "name-asc":
            return a.product_name.localeCompare(b.product_name);
          case "name-desc":
            return b.product_name.localeCompare(a.product_name);
          case "date-asc":
            return (
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime()
            );
          case "date-desc":
            return (
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
            );
          case "updated-desc":
            return (
              new Date(b.updated_at || b.created_at).getTime() -
              new Date(a.updated_at || a.created_at).getTime()
            );
          default:
            return 0;
        }
      })
      .filter((asset) => {
        // Only show assets with reasonable relevance when searching
        if (activeSearchValue) {
          return asset.relevanceScore > 0;
        }
        return true;
      });
  }, [
    hookFilteredAssets,
    activeSearchValue,
    selectedMaterials,
    selectedColors,
    selectedCompanies,
    showInactiveOnly,
    filters.sort,
    optimizedSearch,
  ]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredAssets.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentAssets = filteredAssets.slice(startIndex, endIndex);

  // Generate dynamic filter options based on currently filtered assets
  const dynamicFilterOptions = useMemo(() => {
    const materials = new Set<string>();
    const colors = new Set<string>();
    const companies = new Set<string>();

    // Use the original assets, not filtered assets, to avoid circular dependency
    hookFilteredAssets.forEach((asset) => {
      asset.materials?.forEach((material) => materials.add(material));
      asset.colors?.forEach((color) => colors.add(color));
      if (asset.client) companies.add(asset.client);
    });

    return {
      materials: Array.from(materials).map((material) => ({
        id: material,
        name: material,
      })),
      colors: Array.from(colors).map((color) => ({ id: color, name: color })),
      companies: Array.from(companies).map((company) => ({
        id: company,
        name: company,
      })),
    };
  }, [hookFilteredAssets]);

  // Reset to page 1 when filters change (but not when coming from URL)
  useEffect(() => {
    if (isInitialized) {
      setCurrentPage(1);
    }
  }, [selectedMaterials, selectedColors, selectedCompanies, isInitialized]);

  const handleFilterChange = (key: keyof typeof filters, value: any) => {
    if (key === "category") {
      // When selecting "all" or clearing category, also clear subcategory
      if (value === "all" || value === null) {
        setFilters({ ...filters, category: null, subcategory: null });
      } else {
        setFilters({ ...filters, category: value, subcategory: null });
      }
      // Reset to first page when category changes (user interaction)
      if (isInitialized) {
        setCurrentPage(1);
      }
    } else if (key === "subcategory") {
      // Only allow subcategory change if a category is selected
      if (filters.category) {
        setFilters({ ...filters, [key]: value });
        // Reset to first page when subcategory changes (user interaction)
        if (isInitialized) {
          setCurrentPage(1);
        }
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
    setSelectedMaterials([]);
    setSelectedColors([]);
    setSelectedCompanies([]);
  };

  // Update URL when filters change
  useEffect(() => {
    if (!isInitialized) return; // ⛔ Skip until filters loaded from URL

    // Skip the first update after initialization to prevent race condition
    if (skipFirstUrlUpdate.current) {
      skipFirstUrlUpdate.current = false;
      return;
    }

    const params = new URLSearchParams();

    // Include all filters in the actual URL
    if (filters.category) params.set("category", filters.category);
    if (filters.subcategory) params.set("subcategory", filters.subcategory);
    if (selectedMaterials.length > 0)
      params.set("materials", selectedMaterials.join(","));
    if (selectedColors.length > 0)
      params.set("colors", selectedColors.join(","));
    if (selectedCompanies.length > 0)
      params.set("companies", selectedCompanies.join(","));
    if (filters.sort !== "name-asc") params.set("sort", filters.sort);
    if (activeSearchValue) params.set("search", activeSearchValue);
    if (currentPage > 1) params.set("page", currentPage.toString());

    const newUrl = `${pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    router.push(newUrl, { scroll: false });
  }, [
    filters,
    selectedMaterials,
    selectedColors,
    selectedCompanies,
    activeSearchValue,
    currentPage,
    pathname,
    router,
    isInitialized, // ✅ Added
  ]);

  // Initialize filters from URL on mount
  useEffect(() => {
    if (isInitialized) return; // Only initialize once

    // Helper to parse comma-separated params
    const parseList = (param: string | null): string[] =>
      param ? param.split(",") : [];

    const urlPage = searchParams.get("page");
    const pageNumber = urlPage ? parseInt(urlPage, 10) : 1;

    setFilters((prev) => ({
      ...prev,
      category: searchParams.get("category") || null,
      subcategory: searchParams.get("subcategory") || null,
      client: parseList(searchParams.get("clients")),
      material: parseList(searchParams.get("materials")),
      color: parseList(searchParams.get("colors")),
      sort: (searchParams.get("sort") as SortOption) || "name-asc",
    }));

    // Set the new filter states from URL
    setSelectedMaterials(parseList(searchParams.get("materials")));
    setSelectedColors(parseList(searchParams.get("colors")));
    setSelectedCompanies(parseList(searchParams.get("companies")));

    setSearchValue(searchParams.get("search") || "");
    setActiveSearchValue(searchParams.get("search") || "");

    // ✅ Safely set page, with fallback to 1
    setCurrentPage(pageNumber > 0 ? pageNumber : 1);

    // ✅ Mark initialization complete and skip first URL update
    skipFirstUrlUpdate.current = true;
    setIsInitialized(true);
  }, [searchParams, isInitialized]);

  // Handle URL changes when navigating back from other pages (like categories do)
  useEffect(() => {
    if (!isInitialized) return; // Skip until initialized

    // Helper to parse comma-separated params
    const parseList = (param: string | null): string[] =>
      param ? param.split(",") : [];

    // Check if URL parameters have changed and update state accordingly
    const urlCategory = searchParams.get("category");
    const urlSubcategory = searchParams.get("subcategory");
    const urlMaterials = parseList(searchParams.get("materials"));
    const urlColors = parseList(searchParams.get("colors"));
    const urlCompanies = parseList(searchParams.get("companies"));
    const urlSearch = searchParams.get("search") || "";
    const urlSort = (searchParams.get("sort") as SortOption) || "name-asc";
    const urlPage = parseInt(searchParams.get("page") || "1", 10);

    // Use setFilters with callback to always get current state
    setFilters((prev) => {
      const needsUpdate =
        urlCategory !== prev.category ||
        urlSubcategory !== prev.subcategory ||
        urlSort !== prev.sort;

      if (needsUpdate) {
        return {
          ...prev,
          category: urlCategory,
          subcategory: urlSubcategory,
          sort: urlSort,
        };
      }
      return prev;
    });

    // Update other states
    if (JSON.stringify(urlMaterials) !== JSON.stringify(selectedMaterials)) {
      setSelectedMaterials(urlMaterials);
    }
    if (JSON.stringify(urlColors) !== JSON.stringify(selectedColors)) {
      setSelectedColors(urlColors);
    }
    if (JSON.stringify(urlCompanies) !== JSON.stringify(selectedCompanies)) {
      setSelectedCompanies(urlCompanies);
    }
    if (urlSearch !== activeSearchValue) {
      setSearchValue(urlSearch);
      setActiveSearchValue(urlSearch);
    }
    if (urlPage !== currentPage && urlPage > 0) {
      setCurrentPage(urlPage);
    }
  }, [searchParams.toString(), isInitialized]); // Run when URL changes

  // Handler functions for the new control panel
  const handleClearSearch = () => {
    setSearchValue("");
    setActiveSearchValue("");
  };

  const handleSearch = (value: string) => {
    setSearchValue(value);
    debouncedSearch(value);
  };

  const handleGeneratePreviews = () => {
    setPreviewDialogOpen(true);
  };

  const handleBatchEdit = () => {
    setIsBatchEditMode(!isBatchEditMode);
    if (isBatchEditMode) {
      setSelectedAssets([]);
    }
  };

  const handleAssetSelect = (assetId: string) => {
    setSelectedAssets((prev) =>
      prev.includes(assetId)
        ? prev.filter((id) => id !== assetId)
        : [...prev, assetId]
    );
  };

  const handleSelectAll = () => {
    setSelectedAssets(currentAssets.map((asset) => asset.id));
  };

  const handleDeselectAll = () => {
    setSelectedAssets([]);
  };

  const handleDeleteSelected = async () => {
    if (selectedAssets.length === 0) return;

    if (
      !confirm(
        `Are you sure you want to delete ${selectedAssets.length} asset(s)? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("assets")
        .delete()
        .in("id", selectedAssets);

      if (error) {
        throw error;
      }

      setSelectedAssets([]);
      setIsBatchEditMode(false);
      refetch();
    } catch (error) {
      console.error("Error deleting assets:", error);
      alert("Failed to delete assets. Please try again.");
    }
  };

  const handleSetCategory = (id: string | null) => {
    handleFilterChange("category", id);
  };

  const handleSetSubcategory = (id: string | null) => {
    handleFilterChange("subcategory", id);
  };

  const handleCloseIntroPopup = () => {
    setShowIntroPopup(false);
    localStorage.setItem("asset-library-intro-seen", "true");
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Helper function to clear all filters and reset to initial state
  const handleClearAllFilters = () => {
    clearFilters();
    setSearchValue("");
    setActiveSearchValue("");
    setCurrentPage(1);
    // Navigate to clean URL
    router.push("/asset-library", { scroll: false });
  };

  // Helper function to build breadcrumb URLs with current filters
  const buildBreadcrumbUrl = (
    additionalParams: Record<string, string> = {}
  ) => {
    const params = new URLSearchParams();

    // Include current filters
    if (filters.category) params.set("category", filters.category);
    if (filters.subcategory) params.set("subcategory", filters.subcategory);
    if (selectedMaterials.length > 0)
      params.set("materials", selectedMaterials.join(","));
    if (selectedColors.length > 0)
      params.set("colors", selectedColors.join(","));
    if (selectedCompanies.length > 0)
      params.set("companies", selectedCompanies.join(","));
    if (filters.sort !== "name-asc") params.set("sort", filters.sort);
    if (activeSearchValue) params.set("search", activeSearchValue);
    if (currentPage > 1) params.set("page", currentPage.toString());

    // Override with additional params
    Object.entries(additionalParams).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    return `/asset-library${params.toString() ? `?${params.toString()}` : ""}`;
  };

  // Prepare props for AssetLibraryControlPanel (removed category props)
  const breadcrumbItems = [
    {
      label: "Asset Library",
      href: "/asset-library",
      onClick: handleClearAllFilters,
    },
    ...(filters.category
      ? [
          {
            label:
              filterOptions.categories.find((c) => c.id === filters.category)
                ?.name || "",
            href: buildBreadcrumbUrl({ subcategory: "" }),
          },
        ]
      : []),
    ...(filters.subcategory
      ? [
          {
            label:
              filterOptions.categories
                .find((c) => c.id === filters.category)
                ?.subcategories?.find((s) => s.id === filters.subcategory)
                ?.name || "",
            href: buildBreadcrumbUrl(),
          },
        ]
      : []),
  ];

  // Lazy loading asset card component
  const LazyAssetCardWrapper = useCallback(
    ({ asset, ...props }: any) => {
      return (
        <div data-asset-id={asset.id}>
          <Suspense
            fallback={
              <div className="h-48 bg-muted animate-pulse rounded-lg" />
            }
          >
            <LazyAssetCard
              asset={asset}
              {...props}
              onStatusChange={refetch}
              canDownloadGLB={canDownloadGLB}
            />
          </Suspense>
        </div>
      );
    },
    [refetch, canDownloadGLB]
  );

  // Show skeletons while loading
  if (loading) {
    return (
      <div className="flex flex-col h-full">
        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          <AssetLibraryControlPanel
            categories={filterOptions.categories}
            selectedCategory={filters.category}
            setSelectedCategory={handleSetCategory}
            selectedSubcategory={filters.subcategory}
            setSelectedSubcategory={handleSetSubcategory}
            breadcrumbs={breadcrumbItems}
            searchValue={searchValue}
            onClearSearch={handleClearSearch}
            onSearch={handleSearch}
            sortValue={filters.sort}
            setSortValue={handleSortChange}
            viewMode={viewMode}
            setViewMode={setViewMode}
            onBatchEdit={handleBatchEdit}
            onGeneratePreviews={handleGeneratePreviews}
            userRole={userRole}
            materials={dynamicFilterOptions.materials}
            selectedMaterials={selectedMaterials}
            setSelectedMaterials={setSelectedMaterials}
            colors={dynamicFilterOptions.colors}
            selectedColors={selectedColors}
            setSelectedColors={setSelectedColors}
            companies={dynamicFilterOptions.companies}
            selectedCompanies={selectedCompanies}
            setSelectedCompanies={setSelectedCompanies}
            showInactiveOnly={showInactiveOnly}
            setShowInactiveOnly={setShowInactiveOnly}
          />
          <div className="flex-1 flex flex-col max-h-[calc(100vh-80px)]">
            <div className="flex-1 overflow-y-auto p-6">
              <AssetLibrarySkeleton />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show 'No assets found' only if not loading and assets.length === 0
  if (!loading && assets.length === 0) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <h2 className="text-2xl font-semibold mb-2">No Assets Found</h2>
              <p className="text-gray-500">
                You haven&apos;t uploaded any assets yet.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Control Panel */}
        <AssetLibraryControlPanel
          categories={filterOptions.categories}
          selectedCategory={filters.category}
          setSelectedCategory={handleSetCategory}
          selectedSubcategory={filters.subcategory}
          setSelectedSubcategory={handleSetSubcategory}
          breadcrumbs={breadcrumbItems}
          searchValue={searchValue}
          onClearSearch={handleClearSearch}
          onSearch={handleSearch}
          sortValue={filters.sort}
          setSortValue={handleSortChange}
          viewMode={viewMode}
          setViewMode={setViewMode}
          onBatchEdit={handleBatchEdit}
          onGeneratePreviews={handleGeneratePreviews}
          userRole={userRole}
          materials={dynamicFilterOptions.materials}
          selectedMaterials={selectedMaterials}
          setSelectedMaterials={setSelectedMaterials}
          colors={dynamicFilterOptions.colors}
          selectedColors={selectedColors}
          setSelectedColors={setSelectedColors}
          companies={dynamicFilterOptions.companies}
          selectedCompanies={selectedCompanies}
          setSelectedCompanies={setSelectedCompanies}
          showInactiveOnly={showInactiveOnly}
          setShowInactiveOnly={setShowInactiveOnly}
        />

        {/* Asset Grid */}
        <div className="flex-1 flex flex-col max-h-[full]">
          <div className="flex-1 overflow-y-auto p-6">
            {/* Asset Count and Page Info */}
            <div className="flex justify-between items-center mb-4">
              <p className="text-xs sm:text-sm text-muted-foreground">
                Showing {currentAssets?.length || 0} of{" "}
                {filteredAssets?.length || 0} assets
                {totalPages > 1 && ` (Page ${currentPage} of ${totalPages})`}
              </p>
            </div>

            {/* Batch Edit Controls */}
            {isBatchEditMode && (
              <div className="bg-muted/50 rounded-lg p-3 sm:p-4 mb-4 border border-border">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <span className="text-sm font-medium">
                      {selectedAssets.length} asset(s) selected
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSelectAll}
                        disabled={
                          selectedAssets.length === currentAssets.length
                        }
                      >
                        Select All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDeselectAll}
                        disabled={selectedAssets.length === 0}
                      >
                        Deselect All
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteSelected}
                      disabled={selectedAssets.length === 0}
                    >
                      Delete Selected ({selectedAssets.length})
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsBatchEditMode(false);
                        setSelectedAssets([]);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* No Results State */}
            {filteredAssets.length === 0 && assets.length > 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                <div className="mb-6">
                  <Search className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground/50 mx-auto mb-4" />
                  <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2"></h3>
                  <p className="text-sm sm:text-base text-muted-foreground mb-6 max-w-md">
                    {activeSearchValue
                      ? `We couldn't find any assets matching "${activeSearchValue}". Try adjusting your search terms or filters.`
                      : "No assets match your current filters. Try adjusting your selection to see more results."}
                  </p>
                  <Button
                    onClick={handleClearAllFilters}
                    variant="outline"
                    className="gap-2"
                  >
                    <Search className="h-4 w-4" />
                    Remove Filters
                  </Button>
                </div>
              </div>
            )}

            {/* Asset Grid */}
            {filteredAssets.length > 0 && (
              <div
                className={
                  viewMode === "grid"
                    ? "grid gap-3 sm:gap-4 md:gap-5 lg:gap-6 p-1" +
                      " grid-cols-[repeat(auto-fill,minmax(min(100%,200px),1fr))]" +
                      " sm:grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))]" +
                      " md:grid-cols-[repeat(auto-fill,minmax(min(100%,240px),1fr))]" +
                      " lg:grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))]" +
                      " xl:grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))]"
                    : viewMode === "compactGrid"
                      ? "flex flex-col gap-3"
                      : "grid gap-3 sm:gap-4 md:gap-5 lg:gap-6" +
                        " grid-cols-[repeat(auto-fill,minmax(min(100%,200px),1fr))]" +
                        " sm:grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))]" +
                        " md:grid-cols-[repeat(auto-fill,minmax(min(100%,240px),1fr))]" +
                        " lg:grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))]" +
                        " xl:grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))]"
                }
              >
                {currentAssets.map((asset) => (
                  <LazyAssetCardWrapper
                    key={asset.id}
                    asset={asset}
                    isBatchEditMode={isBatchEditMode}
                    isSelected={selectedAssets.includes(asset.id)}
                    onSelect={handleAssetSelect}
                    viewMode={viewMode}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Pagination - Outside scrollable area */}
          <div className="sticky bottom-0 bg-background/0 z-10">
            <div className="flex justify-center p-4 gap-6">
              <div className="flex items-center gap-6">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Dialogs and Sheets */}
      <Suspense fallback={null}>
        <LazyPreviewGeneratorDialog
          isOpen={previewDialogOpen}
          onClose={() => setPreviewDialogOpen(false)}
        />
      </Suspense>

      <Sheet open={batchUploadOpen} onOpenChange={setBatchUploadOpen}>
        <SheetContent side="right" className="w-full max-w-6xl p-0">
          <SheetHeader className="px-6 py-4 border-b border-border">
            <SheetTitle>Batch Upload Assets</SheetTitle>
          </SheetHeader>
          <Suspense
            fallback={<div className="p-6">Loading upload form...</div>}
          >
            <LazyBatchUploadSheet
              onSuccess={() => {
                setBatchUploadOpen(false);
                refetch();
              }}
            />
          </Suspense>
        </SheetContent>
      </Sheet>

      {/* Intro Popup */}
      <AssetLibraryIntroPopup
        isOpen={showIntroPopup}
        onClose={handleCloseIntroPopup}
      />
    </div>
  );
}
