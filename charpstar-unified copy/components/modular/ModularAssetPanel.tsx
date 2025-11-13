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
import {
  Search,
  Filter,
  Check,
  ChevronsUpDown,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
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

interface ModularAssetPanelProps {
  onAssetSelect?: (asset: any) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  selectedAssets?: any[];
  showCollapseButton?: boolean;
}

export default function ModularAssetPanel({
  onAssetSelect,
  isCollapsed = false,
  onToggleCollapse,
  selectedAssets = [],
  showCollapseButton = true,
}: ModularAssetPanelProps) {
  const {
    assets,
    loading,
    filteredAssets,
    filterOptions,
  } = useAssets(1, 30000); // Fetch up to 30,000 assets at once

  const user = useUser();
  const isAdmin = user?.metadata?.role === "admin";

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

    // Only show assets with GLB link
    result = result.filter((asset) => asset.glb_link);

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

  // If collapsed, show minimal UI
  if (isCollapsed) {
    return (
      <Card className="h-full max-h-[calc(90vh-100px)] flex flex-col overflow-hidden surface-elevated border border-light shadow-md items-center py-2 sm:py-4 px-1 sm:px-2 gap-2 sm:gap-4 transition-all duration-500 ease-out">
        {/* Expand Button - at the top */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className="h-8 w-8 sm:h-10 sm:w-10 p-0 hover:bg-primary/10 flex-shrink-0 transition-colors duration-200"
          title="Expand Asset Library"
        >
          <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>

        {/* Client Filter - Only for Admins */}
        {isAdmin && (
          <Popover open={clientOpen} onOpenChange={setClientOpen} modal={false}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-10 w-10 p-0 flex-shrink-0 transition-colors duration-200 hover:bg-primary/5"
                title={
                  selectedClient === "all"
                    ? "All Clients"
                    : filterOptions.clients.find((c) => c.id === selectedClient)
                        ?.name || "All Clients"
                }
              >
                <Filter className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[250px] p-0 pointer-events-auto z-[100000] animate-in slide-in-from-right-2 duration-200"
              align="start"
              side="right"
            >
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
                          "mr-2 h-4 w-4 transition-opacity duration-200",
                          selectedClient === "all" ? "opacity-100" : "opacity-0"
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
                              "mr-2 h-4 w-4 transition-opacity duration-200",
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
        )}

        {/* Asset Count with Icon */}
        <div className="flex flex-col items-center gap-1 sm:gap-2 flex-shrink-0 transition-all duration-500 ease-out">
          <span className="text-xs sm:text-sm font-medium text-muted-foreground transition-colors duration-300">
            {displayedAssets.length}
          </span>
          {displayedAssets.length !== assets.length && (
            <span className="text-[10px] sm:text-xs text-muted-foreground transition-opacity duration-300">
              /{assets.length}
            </span>
          )}
        </div>

        {/* Vertical Text - rotated correctly */}
        <div className="flex-1 flex items-center justify-center min-h-0 transition-all duration-500 ease-out">
          <div className="text-xs sm:text-sm font-medium tracking-wider [writing-mode:vertical-lr] transition-all duration-500 ease-out">
            Asset Library
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "h-full flex flex-col overflow-hidden transition-all duration-500 ease-out",
      showCollapseButton 
        ? "max-h-[calc(90vh-100px)] surface-elevated border border-light shadow-md" 
        : "border-0 shadow-none p-0"
    )}>
      {showCollapseButton && (
        <CardHeader className="pb-2 sm:pb-3 flex-shrink-0 transition-all duration-500 ease-out">
          <div className="flex items-center justify-between">
            <div className="flex-1 transition-all duration-500 ease-out">
              <CardTitle className="text-base sm:text-lg transition-all duration-500 ease-out">
                Asset Library
              </CardTitle>
              <p className="text-xs text-muted-foreground transition-all duration-500 ease-out">
                Showing {paginatedAssets.length} of {displayedAssets.length}{" "}
                assets
                {displayedAssets.length !== assets.length && (
                  <span> (filtered from {assets.length})</span>
                )}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleCollapse}
              className="h-8 w-8 p-0 ml-2 flex-shrink-0 transition-colors duration-200 hover:bg-primary/10"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
      )}

      <CardContent className={cn(
        "flex-1 flex flex-col min-h-0 overflow-hidden transition-all duration-500 ease-out",
        showCollapseButton ? "space-y-2 sm:space-y-3 p-3 sm:p-4" : "space-y-1.5 pt-2 px-4 pb-0"
      )}>
        {/* Search */}
        <div className="relative transition-all duration-300">
          <Search className={cn(
            "absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground transition-colors duration-200",
            showCollapseButton ? "h-4 w-4" : "h-3.5 w-3.5 left-2.5"
          )} />
          <Input
            type="text"
            placeholder="Search assets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={cn(
              "text-sm transition-all duration-200 focus:ring-2 focus:ring-primary/20 rounded-none",
              showCollapseButton ? "pl-10 h-8 sm:h-9" : "pl-8 h-8 text-xs"
            )}
          />
        </div>

        {/* Responsive Filter Dropdown */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-between transition-colors duration-200 hover:bg-primary/5 hover:border-primary/20 rounded-none",
                showCollapseButton ? "h-8 sm:h-9" : "h-7"
              )}
            >
              <span className="flex items-center gap-1 sm:gap-2">
                <Filter className={cn(showCollapseButton ? "h-3 w-3 sm:h-4 sm:w-4" : "h-3 w-3")} />
                <span className={cn(showCollapseButton ? "text-xs sm:text-sm" : "text-xs")}>
                  Filters
                  {(selectedClient !== "all" ||
                    selectedCategory !== "all" ||
                    sortBy !== "name" ||
                    sortOrder !== "asc" ||
                    !showInactive) && (
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-xs",
                        showCollapseButton ? "ml-1 sm:ml-2 h-4 sm:h-5 px-1 sm:px-1.5" : "ml-1 h-4 px-1"
                      )}
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
              <ChevronsUpDown className={cn(showCollapseButton ? "h-3 w-3 sm:h-4 sm:w-4" : "h-3 w-3", "opacity-50")} />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-72 sm:w-80 p-3 sm:p-4 animate-in slide-in-from-top-2 duration-200"
            align="start"
          >
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
            <div className={cn(
              "grid grid-cols-4",
              showCollapseButton ? "gap-2 sm:gap-3 p-1" : "gap-3 px-4 py-2"
            )}>
              {[...Array(8)].map((_, i) => (
                <Card
                  key={i}
                  className="animate-pulse overflow-hidden transition-all duration-300"
                >
                  <div className="aspect-square bg-muted transition-colors duration-300" />
                  <div className="p-2 space-y-2">
                    <div className="h-3 bg-muted w-3/4 transition-colors duration-300" />
                    <div className="h-2 bg-muted w-1/2 transition-colors duration-300" />
                  </div>
                </Card>
              ))}
            </div>
          ) : displayedAssets.length === 0 ? (
            <div className={cn(
              "text-center transition-all duration-300",
              showCollapseButton ? "py-8 sm:py-12" : "py-6 px-4"
            )}>
              <p className="text-xs sm:text-sm text-muted-foreground transition-colors duration-300">
                No assets found
              </p>
            </div>
          ) : (
            <>
              <div className={cn(
                "grid grid-cols-4",
                showCollapseButton ? "gap-3 p-4" : "gap-3 px-4 py-2"
              )}>
                {paginatedAssets.map((asset) => {
                  const isSelected = selectedAssets.some((a) => a.id === asset.id);
                  return (
                    <button
                      key={asset.id}
                      onClick={() => onAssetSelect?.(asset)}
                      className={cn(
                        "group relative text-left border bg-gradient-to-br from-card to-card/50 hover:from-card hover:to-card transition-all duration-300 overflow-hidden hover:shadow-lg hover:-translate-y-1 active:scale-[0.98]",
                        isSelected
                          ? "border-primary ring-2 ring-primary/30 shadow-md shadow-primary/10 bg-gradient-to-br from-primary/10 to-primary/5"
                          : "border-border/40 hover:border-primary/50 shadow-sm"
                      )}
                      title={asset.product_name}
                    >
                      {/* Image Container */}
                      <div className="relative aspect-square bg-gradient-to-br from-muted/20 via-muted/10 to-transparent overflow-hidden">
                        {asset.preview_image && !imageErrors.has(asset.id) ? (
                          <Image
                            src={
                              Array.isArray(asset.preview_image)
                                ? asset.preview_image[0]
                                : asset.preview_image
                            }
                            alt={asset.product_name}
                            fill
                            className="object-contain group-hover:scale-110 transition-transform duration-500 ease-out"
                            sizes="200px"
                            priority={false}
                            onError={() => {
                              setImageErrors((prev) => new Set(prev).add(asset.id));
                            }}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground/60 p-3 text-center font-medium">
                            {asset.product_name}
                          </div>
                        )}
                        {/* Enhanced Hover Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        
                        {/* Selection Indicator - Enhanced */}
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-6 h-6 bg-primary flex items-center justify-center shadow-lg animate-in zoom-in-50 duration-200">
                            <Check className="w-4 h-4 text-primary-foreground" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-2.5 space-y-1 bg-gradient-to-b from-transparent to-muted/5">
                        <div className="text-xs font-semibold line-clamp-2 leading-tight group-hover:text-primary transition-colors duration-200">
                          {asset.product_name}
                        </div>
                        {asset.category && (
                          <div className="text-[10px] text-muted-foreground line-clamp-1 font-medium">
                            {asset.category}
                          </div>
                        )}
                        {(asset as any).article_id && (
                          <div className="text-[9px] text-muted-foreground/70 font-mono tracking-tight">
                            {(asset as any).article_id}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Pagination Controls - Only show if there are multiple pages */}
              {totalPages > 1 && (
                <div className={cn(
                  "sticky bottom-0 pt-3 pb-2 mt-2",
                  showCollapseButton 
                    ? "bg-background/95 backdrop-blur-sm border-t" 
                    : "bg-gradient-to-t from-background/80 via-background/50 to-transparent backdrop-blur-md"
                )}>
                  <div className={cn(
                    "flex flex-col xs:flex-row xs:items-center justify-between gap-2",
                    showCollapseButton ? "px-1" : "px-4"
                  )}>
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
                        className="h-6 sm:h-7 px-2 sm:px-3 text-[10px] sm:text-xs min-w-[60px] sm:min-w-[70px] disabled:opacity-50"
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
                        className="h-6 sm:h-7 px-2 sm:px-3 text-[10px] sm:text-xs min-w-[60px] sm:min-w-[70px] disabled:opacity-50"
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