"use client";

import { Button } from "@/components/ui/display";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/containers";
import { useAssets } from "../../../hooks/use-assets";
import { useState, useEffect, Suspense, useCallback, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useUser } from "@/contexts/useUser";
import { createClient } from "@/utils/supabase/client";
import { AssetLibraryControlPanel } from "@/components/asset-library/AssetLibraryControlPanel";
import { AssetLibrarySkeleton } from "@/components/ui/skeletons";
import { Search } from "lucide-react";
import React from "react";
import { Card, CardContent } from "@/components/ui/containers/card";
import { AssetLibraryIntroPopup } from "@/components/asset-library/AssetLibraryIntroPopup";
import { useVirtualizer } from "@tanstack/react-virtual";

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

export default function AssetLibraryPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 60;

  // Filter state - moved before useAssets
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [showInactiveOnly, setShowInactiveOnly] = useState(false);

  const {
    assets,
    loading,
    refetch,
    filterOptions,
    filters,
    setFilters,
    filteredAssets: hookFilteredAssets,
    totalCount: serverTotalCount,
    setSearchTerm: setServerSearchTerm,
  } = useAssets(
    currentPage,
    ITEMS_PER_PAGE,
    selectedMaterials,
    selectedColors,
    selectedCompanies,
    showInactiveOnly
  );
  const [searchValue, setSearchValue] = useState("");
  const [activeSearchValue, setActiveSearchValue] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "compactGrid">("grid");
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [batchUploadOpen, setBatchUploadOpen] = useState(false);
  const user = useUser();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [isBatchEditMode, setIsBatchEditMode] = useState(false);
  const [canDownloadGLB, setCanDownloadGLB] = useState(false);

  // Search timeout ref
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Ref for virtualized scrolling container
  const parentRef = useRef<HTMLDivElement>(null);

  // Track if this is the first render after initialization to prevent premature URL sync
  const skipFirstUrlUpdate = useRef(false);

  // Calculate number of columns based on viewport width
  const [columnsCount, setColumnsCount] = useState(4);

  useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      if (width >= 1280)
        setColumnsCount(5); // xl
      else if (width >= 1024)
        setColumnsCount(4); // lg
      else if (width >= 768)
        setColumnsCount(3); // md
      else if (width >= 640)
        setColumnsCount(2); // sm
      else setColumnsCount(1); // mobile
    };

    updateColumns();
    window.addEventListener("resize", updateColumns);
    return () => window.removeEventListener("resize", updateColumns);
  }, []);

  // Initialization state
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

  // Reset to page 1 when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    activeSearchValue,
    selectedMaterials,
    selectedColors,
    selectedCompanies,
    showInactiveOnly,
  ]);

  // Update server search term when active search changes
  useEffect(() => {
    if (setServerSearchTerm) {
      setServerSearchTerm(activeSearchValue);
    }
  }, [activeSearchValue, setServerSearchTerm]);

  // Server handles all filtering including search - use server results directly
  // Note: Server-side search currently covers product_name and article_id only
  // JSONB array fields (materials, colors, tags) would require PostgreSQL functions for full database search
  const filteredAssets = hookFilteredAssets;

  // Calculate pagination - server returns paginated data, so we use it directly
  const currentAssets = filteredAssets;
  const totalPages = Math.ceil(
    (serverTotalCount || filteredAssets.length) / ITEMS_PER_PAGE
  );

  // Calculate rows for virtualization
  const rowCount = Math.ceil(currentAssets.length / columnsCount);

  // Set up virtualizer for rows
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (viewMode === "grid" ? 400 : 200), // Estimated row height
    overscan: 2, // Render 2 extra rows above/below viewport
  });

  // Filter options now come from useAssets hook - they include ALL user's assets
  // No need to generate dynamic options from current page

  // Reset to page 1 when filters change (but not when coming from URL)
  useEffect(() => {
    if (isInitialized) {
      setCurrentPage(1);
    }
  }, [selectedMaterials, selectedColors, selectedCompanies, isInitialized]);

  // Clear category if it's no longer available after filtering by companies
  useEffect(() => {
    if (filters.category && filterOptions.categories.length > 0) {
      const categoryExists = filterOptions.categories.some(
        (cat) => cat.id === filters.category
      );
      if (!categoryExists) {
        setFilters((prev) => ({ ...prev, category: null, subcategory: null }));
      } else if (filters.subcategory) {
        // Check if subcategory still exists in the filtered category
        const category = filterOptions.categories.find(
          (cat) => cat.id === filters.category
        );
        if (
          category &&
          !category.subcategories?.some((sub) => sub.id === filters.subcategory)
        ) {
          setFilters((prev) => ({ ...prev, subcategory: null }));
        }
      }
    }
  }, [
    selectedCompanies,
    filterOptions.categories,
    filters.category,
    filters.subcategory,
    setFilters,
  ]);

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
      <div className="flex flex-col h-full max-w-7xl mx-auto space-y-8 ">
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
            materials={filterOptions.materials}
            selectedMaterials={selectedMaterials}
            setSelectedMaterials={setSelectedMaterials}
            colors={filterOptions.colors}
            selectedColors={selectedColors}
            setSelectedColors={setSelectedColors}
            companies={filterOptions.clients}
            selectedCompanies={selectedCompanies}
            setSelectedCompanies={setSelectedCompanies}
            showInactiveOnly={showInactiveOnly}
            setShowInactiveOnly={setShowInactiveOnly}
          />
          <div className="flex-1 flex flex-col max-h-[calc(100vh-80px)] max-w-7xl mx-auto space-y-8">
            <div className="flex-1 overflow-y-auto p-6">
              <AssetLibrarySkeleton />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show 'No assets found' only if not loading and assets.length === 0 AND no active filters/search
  // This means there are truly no assets in the database (user hasn't uploaded anything)
  const hasActiveFilters =
    activeSearchValue ||
    selectedMaterials.length > 0 ||
    selectedColors.length > 0 ||
    selectedCompanies.length > 0 ||
    filters.category ||
    filters.subcategory ||
    showInactiveOnly;

  // Only show early return if there are no assets AND no filters/search applied
  // If filters/search are active, show full UI so users can adjust their search
  if (!loading && assets.length === 0 && !hasActiveFilters) {
    return (
      <div className="flex flex-col h-full max-w-7xl mx-auto space-y-8">
        {/* Control Panel - still show it so users can navigate */}
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
            materials={filterOptions.materials}
            selectedMaterials={selectedMaterials}
            setSelectedMaterials={setSelectedMaterials}
            colors={filterOptions.colors}
            selectedColors={selectedColors}
            setSelectedColors={setSelectedColors}
            companies={filterOptions.clients}
            selectedCompanies={selectedCompanies}
            setSelectedCompanies={setSelectedCompanies}
            showInactiveOnly={showInactiveOnly}
            setShowInactiveOnly={setShowInactiveOnly}
          />
          <div className="flex-1 flex flex-col">
            <Card className="m-6">
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <h2 className="text-2xl font-semibold mb-2">
                    No Assets Found
                  </h2>
                  <p className="text-gray-500">
                    You haven&apos;t uploaded any assets yet.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full  max-w-7xl mx-auto space-y-8">
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
          materials={filterOptions.materials}
          selectedMaterials={selectedMaterials}
          setSelectedMaterials={setSelectedMaterials}
          colors={filterOptions.colors}
          selectedColors={selectedColors}
          setSelectedColors={setSelectedColors}
          companies={filterOptions.clients}
          selectedCompanies={selectedCompanies}
          setSelectedCompanies={setSelectedCompanies}
          showInactiveOnly={showInactiveOnly}
          setShowInactiveOnly={setShowInactiveOnly}
        />

        {/* Asset Grid */}
        <div className="flex-1 flex flex-col max-h-[full]">
          <div ref={parentRef} className="flex-1 overflow-y-auto p-6">
            {/* Asset Count and Page Info */}
            <div className="flex justify-between items-center mb-4">
              <p className="text-xs sm:text-sm text-muted-foreground">
                Showing {currentAssets?.length || 0} of{" "}
                {serverTotalCount || filteredAssets?.length || 0} assets
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
              <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4 py-12">
                <div className="flex flex-col items-center max-w-lg">
                  {/* Icon */}
                  <div className="relative mb-6">
                    <div className="absolute inset-0 bg-muted rounded-full blur-xl opacity-50" />
                    <div className="relative bg-muted/30 rounded-full p-6">
                      <Search className="h-12 w-12 sm:h-14 sm:w-14 text-muted-foreground/60" />
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-xl sm:text-2xl font-semibold text-foreground mb-3">
                    {activeSearchValue
                      ? "No assets found"
                      : "No matching assets"}
                  </h3>

                  {/* Message */}
                  <p className="text-sm sm:text-base text-muted-foreground mb-6 leading-relaxed">
                    {activeSearchValue ? (
                      <>
                        We couldn&apos;t find any assets matching{" "}
                        <span className="font-medium text-foreground">
                          &quot;{activeSearchValue}&quot;
                        </span>
                        . Try adjusting your search terms or clearing some
                        filters to see more results.
                      </>
                    ) : (
                      <>
                        No assets match your current filters. Try adjusting your
                        selection or clearing filters to see more results.
                      </>
                    )}
                  </p>

                  {/* Helpful Suggestions */}
                  <div className="w-full mb-6">
                    <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">
                      Suggestions:
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1.5 text-left max-w-md">
                      {activeSearchValue ? (
                        <>
                          <li className="flex items-start gap-2">
                            <span className="text-primary mt-0.5">•</span>
                            <span>
                              Check for typos or try different keywords
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-primary mt-0.5">•</span>
                            <span>Clear search and browse by category</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-primary mt-0.5">•</span>
                            <span>Remove filters to see all assets</span>
                          </li>
                        </>
                      ) : (
                        <>
                          <li className="flex items-start gap-2">
                            <span className="text-primary mt-0.5">•</span>
                            <span>Select different materials or colors</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-primary mt-0.5">•</span>
                            <span>Try a different category</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-primary mt-0.5">•</span>
                            <span>Clear all filters to see everything</span>
                          </li>
                        </>
                      )}
                    </ul>
                  </div>

                  {/* Action Button */}
                  <Button
                    onClick={handleClearAllFilters}
                    variant="outline"
                    className="gap-2"
                  >
                    <Search className="h-4 w-4" />
                    Clear all filters
                  </Button>
                </div>
              </div>
            )}

            {/* Virtualized Asset Grid */}
            {filteredAssets.length > 0 && (
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const startIndex = virtualRow.index * columnsCount;
                  const rowAssets = currentAssets.slice(
                    startIndex,
                    startIndex + columnsCount
                  );

                  return (
                    <div
                      key={virtualRow.index}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <div
                        className={
                          viewMode === "grid"
                            ? `grid gap-3 sm:gap-4 md:gap-5 lg:gap-6 p-1 grid-cols-${columnsCount}`
                            : "flex flex-col gap-3"
                        }
                        style={{
                          gridTemplateColumns:
                            viewMode === "grid"
                              ? `repeat(${columnsCount}, minmax(0, 1fr))`
                              : undefined,
                        }}
                      >
                        {rowAssets.map((asset) => (
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
                    </div>
                  );
                })}
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
