"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers/card";
import { Input } from "@/components/ui/inputs";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import { ScrollArea } from "@/components/ui/interactive";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/interactive";
import { Search, Filter, Download, Check, ChevronsUpDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/utilities";
import Image from "next/image";
import { useAssets } from "@/hooks/use-assets";
import { useUser } from "@/contexts/useUser";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";

interface AssetLibraryPanelProps {
  onAssetSelect?: (asset: any) => void;
  selectedAssets?: any[];
}

export default function AssetLibraryPanel({
  onAssetSelect,
  selectedAssets = [],
}: AssetLibraryPanelProps) {
  const {
    assets,
    loading,
    filteredAssets,

    filterOptions,
  } = useAssets();

  const user = useUser();
  const isAdmin = user?.metadata?.role === "admin";
  const [canDownloadGLB, setCanDownloadGLB] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "date">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [showInactive, setShowInactive] = useState<boolean>(false);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  // Combobox open states
  const [clientOpen, setClientOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20; // Show 20 assets per page

  // Apply search and sorting
  const displayedAssets = useMemo(() => {
    let result = filteredAssets;

    // Apply client filter first (for admins)
    if (selectedClient !== "all") {
      result = result.filter((asset) => asset.client === selectedClient);
    }

    // Apply category filter (only categories available for selected client)
    if (selectedCategory !== "all") {
      result = result.filter((asset) => asset.category === selectedCategory);
    }

    // Apply active/inactive filter
    if (!showInactive) {
      result = result.filter((asset) => asset.active !== false);
    }

    // Apply search
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(
        (asset) =>
          asset.product_name?.toLowerCase().includes(searchLower) ||
          asset.category?.toLowerCase().includes(searchLower) ||
          asset.subcategory?.toLowerCase().includes(searchLower) ||
          asset.client?.toLowerCase().includes(searchLower) ||
          (asset as any).article_id?.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    result = [...result].sort((a, b) => {
      let comparison = 0;

      if (sortBy === "name") {
        comparison = (a.product_name || "").localeCompare(b.product_name || "");
      } else if (sortBy === "date") {
        comparison =
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [
    filteredAssets,
    searchTerm,
    sortBy,
    sortOrder,
    selectedCategory,
    selectedClient,
    showInactive,
  ]);

  // Calculate pagination
  const totalPages = Math.ceil(displayedAssets.length / itemsPerPage);
  const paginatedAssets = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return displayedAssets.slice(startIndex, endIndex);
  }, [displayedAssets, currentPage, itemsPerPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    selectedCategory,
    selectedClient,
    sortBy,
    sortOrder,
    showInactive,
  ]);

  // Get categories based on selected client (for admins)
  const availableCategories = useMemo(() => {
    let assetsToCheck = filteredAssets;

    // If admin has selected a specific client, filter to that client's assets
    if (isAdmin && selectedClient !== "all") {
      assetsToCheck = assetsToCheck.filter(
        (asset) => asset.client === selectedClient
      );
    }

    // Extract unique categories from the filtered assets
    const uniqueCategories = Array.from(
      new Set(assetsToCheck.map((asset) => asset.category))
    )
      .filter(Boolean)
      .sort();

    return uniqueCategories.map((cat) => ({
      id: cat,
      name: cat,
    }));
  }, [filteredAssets, selectedClient, isAdmin]);

  // Check if user can download GLB files
  useEffect(() => {
    const checkDownloadPermission = async () => {
      if (!user?.id) {
        setCanDownloadGLB(false);
        return;
      }

      const supabase = createClient();
      const { data: profile } = await supabase
        .from("profiles")
        .select("client, role")
        .eq("id", user.id)
        .single();

      // Admins can always download
      if (profile?.role === "admin") {
        setCanDownloadGLB(true);
        return;
      }

      // Check if client has enterprise contract
      if (profile?.client) {
        const clientNames = Array.isArray(profile.client)
          ? profile.client
          : [profile.client];

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

    checkDownloadPermission();
  }, [user]);

  // Reset category when client changes (to avoid invalid category selection)
  useEffect(() => {
    if (isAdmin && selectedClient !== "all") {
      // Check if current category still exists for the selected client
      const categoryExists = availableCategories.some(
        (cat) => cat.id === selectedCategory
      );
      if (!categoryExists && selectedCategory !== "all") {
        setSelectedCategory("all");
      }
    }
  }, [selectedClient, availableCategories, selectedCategory, isAdmin]);

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-2 sm:pb-3 flex-shrink-0">
        <CardTitle className="text-base sm:text-lg">Asset Library</CardTitle>
        <p className="text-xs text-muted-foreground">
          Showing {paginatedAssets.length} of {displayedAssets.length} assets
          {displayedAssets.length !== assets.length && (
            <span> (filtered from {assets.length})</span>
          )}
        </p>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col space-y-2 sm:space-y-3 p-3 sm:p-4 min-h-0">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name, article ID, category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-8 sm:h-9 text-sm"
          />
        </div>

        {/* Responsive Filter Dropdown */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full h-8 sm:h-9 justify-between"
            >
              <span className="flex items-center gap-1 sm:gap-2">
                <Filter className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="text-xs sm:text-sm">
                  Filters
                  {(selectedClient !== "all" ||
                    selectedCategory !== "all" ||
                    sortBy !== "name" ||
                    sortOrder !== "asc" ||
                    !showInactive) && (
                    <Badge
                      variant="secondary"
                      className="ml-1 sm:ml-2 h-4 sm:h-5 px-1 sm:px-1.5 text-xs"
                    >
                      {
                        [
                          selectedClient !== "all" && "Client",
                          selectedCategory !== "all" && "Category",
                          (sortBy !== "name" || sortOrder !== "asc") && "Sort",
                          !showInactive && "Inactive",
                        ].filter(Boolean).length
                      }
                    </Badge>
                  )}
                </span>
              </span>
              <ChevronsUpDown className="h-3 w-3 sm:h-4 sm:w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 sm:w-80 p-3 sm:p-4" align="start">
            <div className="space-y-3 sm:space-y-4">
              {/* Client Filter - Only for Admins */}
              {isAdmin && (
                <div className="space-y-2">
                  <label className="text-xs sm:text-sm font-medium">
                    Client
                  </label>
                  <Popover
                    open={clientOpen}
                    onOpenChange={setClientOpen}
                    modal={false}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={clientOpen}
                        className="w-full justify-between h-8 sm:h-9 text-xs sm:text-sm"
                      >
                        {selectedClient === "all"
                          ? "All Clients"
                          : filterOptions.clients.find(
                              (c) => c.id === selectedClient
                            )?.name || "All Clients"}
                        <ChevronsUpDown className="ml-2 h-3 w-3 sm:h-4 sm:w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0 pointer-events-auto z-[100000]">
                      <Command>
                        <CommandInput placeholder="Search clients..." />
                        <CommandList className="max-h-[300px] overflow-y-auto">
                          <CommandEmpty>No client found.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="all"
                              onSelect={() => {
                                setSelectedClient("all");
                                setClientOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedClient === "all"
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              All Clients
                            </CommandItem>
                            {filterOptions.clients
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map((client) => (
                                <CommandItem
                                  key={client.id}
                                  value={client.id}
                                  onSelect={() => {
                                    setSelectedClient(client.id);
                                    setClientOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedClient === client.id
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  {client.name}
                                </CommandItem>
                              ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {/* Category Filter */}
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-medium">
                  Category
                  {isAdmin && selectedClient !== "all" && (
                    <span className="text-xs text-muted-foreground ml-1 sm:ml-2">
                      (for{" "}
                      {
                        filterOptions.clients.find(
                          (c) => c.id === selectedClient
                        )?.name
                      }
                      )
                    </span>
                  )}
                </label>
                <Popover
                  open={categoryOpen}
                  onOpenChange={setCategoryOpen}
                  modal={false}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={categoryOpen}
                      className="w-full justify-between h-8 sm:h-9 text-xs sm:text-sm"
                    >
                      {selectedCategory === "all"
                        ? "All Categories"
                        : availableCategories.find(
                            (c) => c.id === selectedCategory
                          )?.name || "All Categories"}
                      <ChevronsUpDown className="ml-2 h-3 w-3 sm:h-4 sm:w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0 pointer-events-auto z-[100000]">
                    <Command>
                      <CommandInput placeholder="Search categories..." />
                      <CommandList className="max-h-[300px] overflow-y-auto">
                        <CommandEmpty>No category found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="all"
                            onSelect={() => {
                              setSelectedCategory("all");
                              setCategoryOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedCategory === "all"
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            All Categories
                          </CommandItem>
                          {availableCategories.map((cat) => (
                            <CommandItem
                              key={cat.id}
                              value={cat.id}
                              onSelect={() => {
                                setSelectedCategory(cat.id);
                                setCategoryOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedCategory === cat.id
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              {cat.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Sort Options */}
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-medium">
                  Sort By
                </label>
                <Popover
                  open={sortOpen}
                  onOpenChange={setSortOpen}
                  modal={false}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={sortOpen}
                      className="w-full justify-between h-8 sm:h-9 text-xs sm:text-sm"
                    >
                      <span className="capitalize">
                        {sortBy} ({sortOrder})
                      </span>
                      <ChevronsUpDown className="ml-2 h-3 w-3 sm:h-4 sm:w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0 pointer-events-auto z-[100000]">
                    <Command>
                      <CommandList className="max-h-[300px] overflow-y-auto">
                        <CommandGroup>
                          <CommandItem
                            value="name-asc"
                            onSelect={() => {
                              setSortBy("name");
                              setSortOrder("asc");
                              setSortOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                sortBy === "name" && sortOrder === "asc"
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            Name (A → Z)
                          </CommandItem>
                          <CommandItem
                            value="name-desc"
                            onSelect={() => {
                              setSortBy("name");
                              setSortOrder("desc");
                              setSortOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                sortBy === "name" && sortOrder === "desc"
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            Name (Z → A)
                          </CommandItem>
                          <CommandItem
                            value="date-asc"
                            onSelect={() => {
                              setSortBy("date");
                              setSortOrder("asc");
                              setSortOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                sortBy === "date" && sortOrder === "asc"
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            Date (Oldest)
                          </CommandItem>
                          <CommandItem
                            value="date-desc"
                            onSelect={() => {
                              setSortBy("date");
                              setSortOrder("desc");
                              setSortOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                sortBy === "date" && sortOrder === "desc"
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            Date (Newest)
                          </CommandItem>
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Show Inactive Assets Toggle */}
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-medium">
                  Show Inactive Assets
                </label>
                <Button
                  variant={showInactive ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowInactive(!showInactive)}
                  className="h-7 sm:h-8 px-2 sm:px-3 text-xs"
                >
                  {showInactive ? "Yes" : "No"}
                </Button>
              </div>

              {/* Clear Filters */}
              {(selectedClient !== "all" ||
                selectedCategory !== "all" ||
                sortBy !== "name" ||
                sortOrder !== "asc" ||
                !showInactive) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedClient("all");
                    setSelectedCategory("all");
                    setSortBy("name");
                    setSortOrder("asc");
                    setShowInactive(true);
                  }}
                  className="w-full h-7 sm:h-8 text-xs"
                >
                  Clear All Filters
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Assets Grid */}
        <ScrollArea className="flex-1 min-h-0">
          {loading ? (
            <div className="grid grid-cols-3 xs:grid-cols-2 gap-2 sm:gap-3">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse overflow-hidden">
                  <div className="aspect-square bg-muted" />
                  <div className="p-2 space-y-2">
                    <div className="h-3 bg-muted rounded w-3/4" />
                    <div className="h-2 bg-muted rounded w-1/2" />
                  </div>
                </Card>
              ))}
            </div>
          ) : displayedAssets.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <p className="text-xs sm:text-sm text-muted-foreground">
                No assets found
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 xs:grid-cols-3 gap-2 sm:gap-3 pb-4 p-1">
                {paginatedAssets.map((asset) => {
                  const isSelected = selectedAssets.some(selected => selected.id === asset.id);
                  return (
                  <Card
                    key={asset.id}
                    className={`overflow-hidden p-2 sm:p-4 rounded-lg cursor-pointer hover:shadow-lg hover:ring-2 hover:ring-primary/50 hover:ring-offset-2 transition-all group ${
                      asset.active === false ? "opacity-60 border-dashed" : ""
                    } ${
                      isSelected ? "ring-2 ring-primary bg-primary/5" : ""
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log("Asset card clicked:", asset);
                      onAssetSelect?.(asset);
                    }}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        "application/json",
                        JSON.stringify(asset)
                      );
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                  >
                    {/* Preview Image */}
                    <div className="relative aspect-square ">
                      {asset.preview_image && !imageErrors.has(asset.id) ? (
                        <Image
                          src={
                            Array.isArray(asset.preview_image)
                              ? asset.preview_image[0]
                              : asset.preview_image
                          }
                          alt={asset.product_name}
                          fill
                          unoptimized
                          className="object-contain group-hover:scale-105 transition-transform"
                          sizes="(max-width: 768px) 50vw, 200px"
                          onError={() => {
                            setImageErrors((prev) =>
                              new Set(prev).add(asset.id)
                            );
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-muted">
                          <p className="text-xs text-muted-foreground text-center px-2">
                            {asset.product_name.substring(0, 20)}
                            {asset.product_name.length > 20 ? "..." : ""}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Asset Info */}
                    <div className="p-1 sm:p-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-medium line-clamp-1 group-hover:text-primary transition-colors">
                          {asset.product_name}
                        </h4>
                        {asset.active === false && (
                          <Badge
                            variant="destructive"
                            className="text-[10px] sm:text-xs px-1 sm:px-1.5 py-0"
                          >
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1">
                        {asset.category}
                      </p>
                      {(asset as any).article_id && (
                        <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1 font-mono">
                          {(asset as any).article_id}
                        </p>
                      )}
                      {asset.materials && asset.materials.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {asset.materials.slice(0, 2).map((material, idx) => (
                            <Badge
                              key={idx}
                              variant="secondary"
                              className="text-[10px] sm:text-xs px-1 py-0"
                            >
                              {material}
                            </Badge>
                          ))}
                          {asset.materials.length > 2 && (
                            <span className="text-[10px] sm:text-xs text-muted-foreground">
                              +{asset.materials.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Quick Action */}
                    {asset.glb_link && canDownloadGLB && (
                      <div className="p-1 sm:p-2 pt-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full h-6 sm:h-7 text-[10px] sm:text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(asset.glb_link, "_blank");
                          }}
                        >
                          <Download className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                          GLB
                        </Button>
                      </div>
                    )}

                    {/* Selection Indicator */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </Card>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="sticky bottom-0 z-10  backdrop-blur-sm border-t pt-3 sm:pt-4 mt-2 sm:mt-3">
                  <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 px-1 sm:px-2">
                    <div className="text-[10px] sm:text-xs text-muted-foreground text-center xs:text-left order-2 xs:order-1">
                      Page {currentPage} of {totalPages}
                    </div>
                    <div className="flex gap-1 justify-center xs:justify-end order-1 xs:order-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCurrentPage((p) => Math.max(1, p - 1))
                        }
                        disabled={currentPage === 1}
                        className="h-6 sm:h-7 px-2 sm:px-3 text-[10px] sm:text-xs min-w-[60px] sm:min-w-[70px]"
                      >
                        <span className="hidden xs:inline">Prev</span>
                        <span className="xs:hidden">‹</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={currentPage === totalPages}
                        className="h-6 sm:h-7 px-2 sm:px-3 text-[10px] sm:text-xs min-w-[60px] sm:min-w-[70px]"
                      >
                        <span className="hidden xs:inline">Next</span>
                        <span className="xs:hidden">›</span>
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
