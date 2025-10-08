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

interface AssetLibraryPanelProps {
  onAssetSelect?: (asset: any) => void;
}

export default function AssetLibraryPanel({
  onAssetSelect,
}: AssetLibraryPanelProps) {
  const {
    assets,
    loading,
    filteredAssets,

    filterOptions,
  } = useAssets();

  const user = useUser();
  const isAdmin = user?.metadata?.role === "admin";

  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "date">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedClient, setSelectedClient] = useState<string>("all");
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
  }, [searchTerm, selectedCategory, selectedClient, sortBy, sortOrder]);

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

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Asset Library</CardTitle>
        <p className="text-xs text-muted-foreground">
          Showing {paginatedAssets.length} of {displayedAssets.length} assets
          {displayedAssets.length !== assets.length && (
            <span> (filtered from {assets.length})</span>
          )}
        </p>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col space-y-3 p-4 overflow-visible">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name, article ID, category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-9"
          />
        </div>

        {/* Compact Filter Dropdown */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full h-9 justify-between">
              <span className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <span className="text-sm">
                  Filters
                  {(selectedClient !== "all" ||
                    selectedCategory !== "all" ||
                    sortBy !== "name" ||
                    sortOrder !== "asc") && (
                    <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                      {
                        [
                          selectedClient !== "all" && "Client",
                          selectedCategory !== "all" && "Category",
                          (sortBy !== "name" || sortOrder !== "asc") && "Sort",
                        ].filter(Boolean).length
                      }
                    </Badge>
                  )}
                </span>
              </span>
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4" align="start">
            <div className="space-y-4">
              {/* Client Filter - Only for Admins */}
              {isAdmin && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Client</label>
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
                        className="w-full justify-between h-9"
                      >
                        {selectedClient === "all"
                          ? "All Clients"
                          : filterOptions.clients.find(
                              (c) => c.value === selectedClient
                            )?.label || "All Clients"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                              .sort((a, b) => a.label.localeCompare(b.label))
                              .map((client) => (
                                <CommandItem
                                  key={client.value}
                                  value={client.value}
                                  onSelect={() => {
                                    setSelectedClient(client.value);
                                    setClientOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedClient === client.value
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  {client.label}
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
                <label className="text-sm font-medium">
                  Category
                  {isAdmin && selectedClient !== "all" && (
                    <span className="text-xs text-muted-foreground ml-2">
                      (for{" "}
                      {
                        filterOptions.clients.find(
                          (c) => c.value === selectedClient
                        )?.label
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
                      className="w-full justify-between h-9"
                    >
                      {selectedCategory === "all"
                        ? "All Categories"
                        : availableCategories.find(
                            (c) => c.id === selectedCategory
                          )?.name || "All Categories"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                <label className="text-sm font-medium">Sort By</label>
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
                      className="w-full justify-between h-9"
                    >
                      <span className="capitalize">
                        {sortBy} ({sortOrder})
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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

              {/* Clear Filters */}
              {(selectedClient !== "all" ||
                selectedCategory !== "all" ||
                sortBy !== "name" ||
                sortOrder !== "asc") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedClient("all");
                    setSelectedCategory("all");
                    setSortBy("name");
                    setSortOrder("asc");
                  }}
                  className="w-full h-8"
                >
                  Clear All Filters
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Assets Grid */}
        <ScrollArea className="flex-1 ">
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
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
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">No assets found</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 pb-4 overflow-y-auto max-h-[830px]">
                {paginatedAssets.map((asset) => (
                  <Card
                    key={asset.id}
                    className="overflow-hidden p-4 rounded-lg cursor-grab active:cursor-grabbing hover:shadow-lg hover:ring-2 hover:ring-primary/50 transition-all group"
                    onClick={() => onAssetSelect?.(asset)}
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
                    <div className="relative aspect-square bg-muted">
                      {asset.preview_image && !imageErrors.has(asset.id) ? (
                        <Image
                          src={asset.preview_image}
                          alt={asset.product_name}
                          fill
                          unoptimized
                          className="object-cover group-hover:scale-105 transition-transform"
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
                    <div className="p-2 space-y-1">
                      <h4 className="text-xs font-medium line-clamp-1 group-hover:text-primary transition-colors">
                        {asset.product_name}
                      </h4>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {asset.category}
                      </p>
                      {(asset as any).article_id && (
                        <p className="text-xs text-muted-foreground line-clamp-1 font-mono">
                          {(asset as any).article_id}
                        </p>
                      )}
                      {asset.materials && asset.materials.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {asset.materials.slice(0, 2).map((material, idx) => (
                            <Badge
                              key={idx}
                              variant="secondary"
                              className="text-xs px-1 py-0"
                            >
                              {material}
                            </Badge>
                          ))}
                          {asset.materials.length > 2 && (
                            <span className="text-xs text-muted-foreground">
                              +{asset.materials.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Quick Action */}
                    {asset.glb_link && (
                      <div className="p-2 pt-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(asset.glb_link, "_blank");
                          }}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          GLB
                        </Button>
                      </div>
                    )}
                  </Card>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="text-xs text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-7 px-2"
                    >
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                      className="h-7 px-2"
                    >
                      Next
                    </Button>
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
