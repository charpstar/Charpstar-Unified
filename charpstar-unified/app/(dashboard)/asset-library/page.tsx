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
  ChevronLeft,
  ChevronRight,
  Grid,
  List,
  Filter,
  X,
  Camera,
} from "lucide-react";
import { useAssets } from "../../../hooks/use-assets";
import { AssetLibrarySkeleton } from "@/components/ui/asset-library-skeleton";
import { useState, useEffect } from "react";
import Link from "next/link";
import Script from "next/script";
import { BatchUploadSheet } from "./components/batch-upload-sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  UploadAssetDialogContent,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useSearchParams } from "next/navigation";
import { useUser } from "@/contexts/useUser";
import { AssetCardSkeleton } from "@/components/ui/asset-card-skeleton";

export default function AssetLibraryPage() {
  const searchParams = useSearchParams();
  const client = searchParams.get("client");
  const {
    assets,
    loading,
    error,
    refetch,
    filterOptions,
    filters,
    setFilters,
  } = useAssets();
  const [searchValue, setSearchValue] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const user = useUser();

  const ITEMS_PER_PAGE = 50;

  // Filter assets based on search
  const filteredAssets = assets.filter((asset) =>
    asset.product_name.toLowerCase().includes(searchValue.toLowerCase())
  );

  // Calculate pagination
  const totalPages = Math.ceil(filteredAssets.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentAssets = filteredAssets.slice(startIndex, endIndex);

  const handleFilterChange = (key: keyof typeof filters, value: any) => {
    setFilters({ ...filters, [key]: value });
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

  // Show loading state while user profile is being fetched
  if (!user) {
    return (
      <div className="p-6">
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold">Asset Library</h1>
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
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold">Asset Library</h1>
              {user?.metadata?.client && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    My Business:
                  </span>
                  <span className="px-3 py-1 rounded bg-primary/10 text-primary text-sm font-medium">
                    {user.metadata.client}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Filter className="h-4 w-4" />
                    Filters
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[400px] sm:w-[540px]">
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                  </SheetHeader>
                  <div className="py-4">
                    <div className="h-[calc(100vh-8rem)] overflow-y-auto pr-4">
                      <div className="space-y-6">
                        <div className="h-8 w-full bg-muted rounded animate-pulse" />
                        <div className="h-8 w-full bg-muted rounded animate-pulse" />
                        <div className="h-8 w-full bg-muted rounded animate-pulse" />
                      </div>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>

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
              <div className="relative w-94">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search assets..."
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-1 border rounded-md">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
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

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">
          Asset Library{" "}
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
          Asset Library{" "}
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
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">Asset Library</h1>
            {user?.metadata?.client && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  My Business:
                </span>
                <span className="px-3 py-1 rounded bg-primary/10 text-primary text-sm font-medium">
                  {user.metadata.client}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
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
              <SheetContent side="right" className="w-[400px] sm:w-[540px]">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="py-4">
                  <div className="h-[calc(100vh-8rem)] overflow-y-auto pr-4">
                    <div className="space-y-6">
                      {/* Category Filter */}
                      <div>
                        <h3 className="text-sm font-medium mb-2">Category</h3>
                        <Select
                          value={filters.category || "all"}
                          onValueChange={(value) =>
                            handleFilterChange(
                              "category",
                              value === "all" ? null : value
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            {filterOptions.categories.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Subcategory Filter */}
                      {filters.category && (
                        <div>
                          <h3 className="text-sm font-medium mb-2">
                            Subcategory
                          </h3>
                          <Select
                            value={filters.subcategory || "all"}
                            onValueChange={(value) =>
                              handleFilterChange(
                                "subcategory",
                                value === "all" ? null : value
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select subcategory" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">
                                All Subcategories
                              </SelectItem>
                              {filterOptions.categories
                                .find((c) => c.id === filters.category)
                                ?.subcategories.map((sub) => (
                                  <SelectItem key={sub.id} value={sub.id}>
                                    {sub.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Client Filter */}
                      {filterOptions.clients.length > 1 && (
                        <div>
                          <h3 className="text-sm font-medium mb-2">Client</h3>
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
                                  className="h-4 w-4 rounded border-gray-300"
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
                        <h3 className="text-sm font-medium mb-2">Materials</h3>
                        <div className="space-y-2">
                          {filterOptions.materials.map((material) => (
                            <div
                              key={material.value}
                              className="flex items-center space-x-2"
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
                                  handleFilterChange("material", newMaterials);
                                }}
                                className="h-4 w-4 rounded border-gray-300"
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
                      </div>

                      {/* Color Filter */}
                      <div>
                        <h3 className="text-sm font-medium mb-2">Colors</h3>
                        <div className="space-y-2">
                          {filterOptions.colors.map((color) => (
                            <div
                              key={color.value}
                              className="flex items-center space-x-2"
                            >
                              <input
                                type="checkbox"
                                id={`color-${color.value}`}
                                checked={filters.color.includes(color.value)}
                                onChange={(e) => {
                                  const newColors = e.target.checked
                                    ? [...filters.color, color.value]
                                    : filters.color.filter(
                                        (c) => c !== color.value
                                      );
                                  handleFilterChange("color", newColors);
                                }}
                                className="h-4 w-4 rounded border-gray-300"
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
                      </div>

                      {/* Sort Options */}
                      <div>
                        <h3 className="text-sm font-medium mb-2">Sort By</h3>
                        <Select
                          value={filters.sort}
                          onValueChange={handleSortChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sort by" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                            <SelectItem value="name-desc">
                              Name (Z-A)
                            </SelectItem>
                            <SelectItem value="date-asc">
                              Date (Oldest First)
                            </SelectItem>
                            <SelectItem value="date-desc">
                              Date (Newest First)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Separator />

                      {/* Clear Filters Button */}
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={clearFilters}
                      >
                        Clear All Filters
                      </Button>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

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
            <div className="relative w-94">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search assets..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-1 border rounded-md">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="icon"
                className="h-9 w-9"
                onClick={() => setViewMode("grid")}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="icon"
                className="h-9 w-9"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Active Filters Display */}
          <div className="flex flex-wrap gap-2">
            {filters.category && (
              <Badge variant="secondary" className="gap-1">
                {
                  filterOptions.categories.find(
                    (c) => c.id === filters.category
                  )?.name
                }
                <button
                  onClick={() => handleFilterChange("category", null)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.subcategory && (
              <Badge variant="secondary" className="gap-1">
                {
                  filterOptions.categories
                    .find((c) => c.id === filters.category)
                    ?.subcategories.find((s) => s.id === filters.subcategory)
                    ?.name
                }
                <button
                  onClick={() => handleFilterChange("subcategory", null)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.client.map((client) => (
              <Badge key={client} variant="secondary" className="gap-1">
                {client}
                <button
                  onClick={() =>
                    handleFilterChange(
                      "client",
                      filters.client.filter((c) => c !== client)
                    )
                  }
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {filters.material.map((material) => (
              <Badge key={material} variant="secondary" className="gap-1">
                {material}
                <button
                  onClick={() =>
                    handleFilterChange(
                      "material",
                      filters.material.filter((m) => m !== material)
                    )
                  }
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {filters.color.map((color) => (
              <Badge key={color} variant="secondary" className="gap-1">
                {color}
                <button
                  onClick={() =>
                    handleFilterChange(
                      "color",
                      filters.color.filter((c) => c !== color)
                    )
                  }
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        <div
          className={`${
            viewMode === "grid"
              ? `grid gap-8 grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 max-w-[2000px] mx-auto`
              : "flex flex-col gap-4"
          }`}
        >
          {currentAssets.map((asset) => (
            <Card
              key={asset.id}
              className={`group ${
                viewMode === "grid"
                  ? `flex flex-col h-full overflow-hidden border-border/50 hover:border-border transition-colors`
                  : "flex flex-row overflow-hidden border-border/50 hover:border-border transition-colors"
              }`}
            >
              <CardHeader
                className={`p-0 relative ${
                  viewMode === "list" ? "w-48 shrink-0" : ""
                }`}
              >
                {asset.glb_link ? (
                  <div
                    className={`w-full ${
                      viewMode === "grid"
                        ? "rounded-t-lg h-[32rem]"
                        : "h-full rounded-l-lg"
                    }`}
                  >
                    <model-viewer
                      src={asset.glb_link}
                      alt={asset.product_name}
                      camera-orbit="-31.05deg 79.38deg"
                      field-of-view="33.96deg"
                      environment-image="https://cdn.charpstar.net/Demos/HDR_Furniture.hdr"
                      exposure="1.2"
                      shadow-intensity="0"
                      auto-rotate
                      camera-controls
                      interaction-prompt="none"
                      className="w-full h-full"
                      poster={asset.preview_image}
                    />
                  </div>
                ) : (
                  <div
                    className={`w-full flex items-center justify-center ${
                      viewMode === "grid"
                        ? "rounded-t-lg h-[32rem]"
                        : "h-full rounded-l-lg"
                    } bg-muted`}
                  >
                    <p className="text-muted-foreground">No 3D Model</p>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardHeader>
              <CardContent className={`flex-1 flex flex-col space-y-4 p-8`}>
                <div>
                  <CardTitle className={`line-clamp-1 font-semibold text-2xl`}>
                    {asset.product_name}
                  </CardTitle>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge variant="secondary" className="text-sm font-normal">
                      {asset.category}
                    </Badge>
                    {asset.subcategory && (
                      <Badge variant="outline" className="text-sm font-normal">
                        {asset.subcategory}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="h-px bg-border my-2" />

                <div className="flex flex-wrap gap-2">
                  {asset.materials &&
                    asset.materials.length > 0 &&
                    asset.materials.map((material: string) => (
                      <Badge
                        key={material}
                        variant="secondary"
                        className="text-sm font-normal"
                      >
                        {material.replace(/[\[\]"]/g, "")}
                      </Badge>
                    ))}
                  {asset.colors &&
                    asset.colors.length > 0 &&
                    asset.colors.map((color: string) => (
                      <Badge
                        key={color}
                        variant="outline"
                        className="text-sm font-normal"
                      >
                        {color.replace(/[\[\]"]/g, "")}
                      </Badge>
                    ))}
                </div>
                <div className="mt-auto pt-6 flex items-center gap-3">
                  <Button
                    variant="default"
                    size="default"
                    className="flex-1 group/btn h-11"
                    asChild
                  >
                    <Link
                      href={`/asset-library/${asset.id}`}
                      className="flex items-center justify-center gap-2"
                      prefetch={true}
                    >
                      View Product
                      <ExternalLink className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 shrink-0 hover:bg-muted/50 transition-colors group/download"
                    asChild
                    disabled={!asset.glb_link}
                  >
                    <a
                      href={asset.glb_link}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Download 3D Model"
                      className="flex items-center justify-center"
                    >
                      <Download className="h-4 w-4 transition-transform group-hover/download:translate-y-0.5" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
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
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
