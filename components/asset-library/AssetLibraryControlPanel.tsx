import React from "react";
import Link from "next/link";
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/display";
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs";
import { Badge } from "@/components/ui/feedback";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/interactive";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/interactive";
import {
  LayoutGrid,
  Rows,
  Filter,
  Search,
  ChevronRight,
  Upload,
  MoreVertical,
  X,
  ChevronDown,
  Image,
  Edit3,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/interactive";

// Types for props
interface BreadcrumbItem {
  label: string;
  href: string;
  onClick?: () => void;
}

interface FilterOption {
  id: string;
  name: string;
  count?: number;
}

interface AssetLibraryControlPanelProps {
  breadcrumbs: BreadcrumbItem[];
  searchValue: string;
  onClearSearch: () => void;
  onSearch: (value: string) => void;
  sortValue: string;
  setSortValue: (value: string) => void;
  viewMode: "grid" | "compactGrid";
  setViewMode: (mode: "grid" | "compactGrid") => void;
  onBatchEdit: () => void;
  onGeneratePreviews: () => void;
  userRole?: string | null;
  // Filter props
  materials: FilterOption[];
  selectedMaterials: string[];
  setSelectedMaterials: React.Dispatch<React.SetStateAction<string[]>>;
  colors: FilterOption[];
  selectedColors: string[];
  setSelectedColors: React.Dispatch<React.SetStateAction<string[]>>;
  companies: FilterOption[];
  selectedCompanies: string[];
  setSelectedCompanies: React.Dispatch<React.SetStateAction<string[]>>;
  // Mobile sidebar props
  isMobileSidebarOpen?: boolean;
  onToggleMobileSidebar?: () => void;
  className?: string;
}

export const AssetLibraryControlPanel: React.FC<
  AssetLibraryControlPanelProps
> = ({
  breadcrumbs,
  searchValue,
  onClearSearch,
  onSearch,
  sortValue,
  setSortValue,
  viewMode,
  setViewMode,
  onBatchEdit,
  onGeneratePreviews,
  userRole,
  materials,
  selectedMaterials,
  setSelectedMaterials,
  colors,
  selectedColors,
  setSelectedColors,
  companies,
  selectedCompanies,
  setSelectedCompanies,
  isMobileSidebarOpen,
  onToggleMobileSidebar,
  className = "",
}) => {
  const [materialSearch, setMaterialSearch] = React.useState("");
  const [colorSearch, setColorSearch] = React.useState("");
  const [companySearch, setCompanySearch] = React.useState("");
  const [localSearchValue, setLocalSearchValue] = React.useState(searchValue);

  // Update local search value when prop changes
  React.useEffect(() => {
    setLocalSearchValue(searchValue);
  }, [searchValue]);

  const handleSearch = () => {
    onSearch(localSearchValue);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleClearSearch = () => {
    setLocalSearchValue("");
    onClearSearch();
  };

  const filteredMaterials = materials.filter((material) =>
    material.name.toLowerCase().includes(materialSearch.toLowerCase())
  );
  const filteredColors = colors.filter((color) =>
    color.name.toLowerCase().includes(colorSearch.toLowerCase())
  );
  const filteredCompanies = companies.filter((company) =>
    company.name.toLowerCase().includes(companySearch.toLowerCase())
  );

  const handleMaterialToggle = (materialId: string) => {
    setSelectedMaterials((prev: string[]) =>
      prev.includes(materialId)
        ? prev.filter((id: string) => id !== materialId)
        : [...prev, materialId]
    );
  };

  const handleColorToggle = (colorId: string) => {
    setSelectedColors((prev: string[]) =>
      prev.includes(colorId)
        ? prev.filter((id: string) => id !== colorId)
        : [...prev, colorId]
    );
  };

  const handleCompanyToggle = (companyId: string) => {
    setSelectedCompanies((prev: string[]) =>
      prev.includes(companyId)
        ? prev.filter((id: string) => id !== companyId)
        : [...prev, companyId]
    );
  };

  return (
    <div
      className={`sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border ${className}`}
    >
      <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
        {/* Breadcrumbs */}
        <nav className="flex items-center space-x-1 text-xs sm:text-sm text-muted-foreground overflow-x-auto">
          {breadcrumbs.map((item, index) => (
            <React.Fragment key={index}>
              {index > 0 && (
                <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              )}
              <Link
                href={item.href}
                onClick={item.onClick}
                className="hover:text-foreground transition-colors whitespace-nowrap flex-shrink-0"
              >
                {item.label}
              </Link>
            </React.Fragment>
          ))}
        </nav>

        {/* Main Controls Row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          {/* Mobile Sidebar Toggle - Only show on mobile */}
          {onToggleMobileSidebar && (
            <div className="flex sm:hidden">
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleMobileSidebar}
                className="cursor-pointer"
              >
                <Filter className="h-4 w-4 mr-2" />
                Categories
                {isMobileSidebarOpen && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    Open
                  </Badge>
                )}
              </Button>
            </div>
          )}

          {/* Search */}
          <div className="flex-1 min-w-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search assets..."
                value={localSearchValue}
                onChange={(e) => setLocalSearchValue(e.target.value)}
                onKeyDown={handleKeyPress}
                className="pl-10 pr-20 text-sm sm:text-base"
              />
              <div className="absolute right-1 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                {localSearchValue && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearSearch}
                    className="h-6 w-6 p-0"
                  >
                    ×
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSearch}
                  className="h-6 w-6 p-0"
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Sort and View Controls */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Sort */}
            <Select value={sortValue} onValueChange={setSortValue}>
              <SelectTrigger className="w-32 sm:w-48 cursor-pointer text-xs sm:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                <SelectItem value="created-asc">Created (Oldest)</SelectItem>
                <SelectItem value="created-desc">Created (Newest)</SelectItem>
                <SelectItem value="updated-asc">Updated (Oldest)</SelectItem>
                <SelectItem value="updated-desc">Updated (Newest)</SelectItem>
              </SelectContent>
            </Select>

            {/* View Switcher */}
            <div className="flex items-center border rounded-md">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className="rounded-r-none cursor-pointer"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Grid View</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === "compactGrid" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("compactGrid")}
                    className="rounded-l-none cursor-pointer"
                  >
                    <Rows className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>List View</TooltipContent>
              </Tooltip>
            </div>

            {/* Admin Actions */}
            {userRole === "admin" && (
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem asChild>
                      <Link
                        href="/asset-library/upload"
                        className="cursor-pointer"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Assets
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={onGeneratePreviews}
                      className="cursor-pointer"
                    >
                      <Image className="h-4 w-4 mr-2" />
                      Generate Previews
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={onBatchEdit}
                      className="cursor-pointer"
                    >
                      <Edit3 className="h-4 w-4 mr-2" />
                      Batch Edit
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>

        {/* Filter Layer */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 pt-2 border-t border-border/50">
          {/* Filter Header */}
          <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground">
            <Filter className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>Filters:</span>
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap gap-2 sm:gap-4">
            {/* Materials Filter */}
            {materials.length > 1 ? (
              <div className="relative">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-32 sm:w-48 justify-between cursor-pointer text-xs sm:text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="truncate">Materials</span>
                        {selectedMaterials.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {selectedMaterials.length}
                          </Badge>
                        )}
                      </div>
                      <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 opacity-50 flex-shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-0" align="start">
                    <div className="p-2">
                      <div className="relative mb-2">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search materials..."
                          value={materialSearch}
                          onChange={(e) => setMaterialSearch(e.target.value)}
                          className="pl-8 text-sm"
                        />
                      </div>
                      <ScrollArea className="h-60">
                        <div className="space-y-1">
                          {filteredMaterials.map((material) => (
                            <div
                              key={material.id}
                              className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                              onClick={() => handleMaterialToggle(material.id)}
                            >
                              <input
                                type="checkbox"
                                checked={selectedMaterials.includes(
                                  material.id
                                )}
                                onChange={() => {}}
                                className="rounded"
                                aria-invalid="false"
                              />
                              <span className="flex-1 text-sm truncate">
                                {material.name}
                              </span>
                              {material.count && (
                                <Badge
                                  variant="outline"
                                  className="text-xs flex-shrink-0"
                                >
                                  {material.count}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            ) : materials.length === 1 ? (
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm text-muted-foreground">
                  Material:
                </span>
                <Badge variant="outline" className="text-xs sm:text-sm">
                  {materials[0].name}
                </Badge>
              </div>
            ) : null}

            {/* Colors Filter */}
            {colors.length > 1 ? (
              <div className="relative">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-32 sm:w-48 justify-between cursor-pointer text-xs sm:text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="truncate">Colors</span>
                        {selectedColors.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {selectedColors.length}
                          </Badge>
                        )}
                      </div>
                      <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 opacity-50 flex-shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-0" align="start">
                    <div className="p-2">
                      <div className="relative mb-2">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search colors..."
                          value={colorSearch}
                          onChange={(e) => setColorSearch(e.target.value)}
                          className="pl-8 text-sm"
                        />
                      </div>
                      <ScrollArea className="h-60">
                        <div className="space-y-1">
                          {filteredColors.map((color) => (
                            <div
                              key={color.id}
                              className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                              onClick={() => handleColorToggle(color.id)}
                            >
                              <input
                                type="checkbox"
                                checked={selectedColors.includes(color.id)}
                                onChange={() => {}}
                                className="rounded"
                                aria-invalid="false"
                              />
                              <span className="flex-1 text-sm truncate">
                                {color.name}
                              </span>
                              {color.count && (
                                <Badge
                                  variant="outline"
                                  className="text-xs flex-shrink-0"
                                >
                                  {color.count}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            ) : colors.length === 1 ? (
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm text-muted-foreground">
                  Color:
                </span>
                <Badge variant="outline" className="text-xs sm:text-sm">
                  {colors[0].name}
                </Badge>
              </div>
            ) : null}

            {/* Companies Filter */}
            {companies.length > 1 ? (
              <div className="relative">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-32 sm:w-48 justify-between cursor-pointer text-xs sm:text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="truncate">Companies</span>
                        {selectedCompanies.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {selectedCompanies.length}
                          </Badge>
                        )}
                      </div>
                      <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 opacity-50 flex-shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-0" align="start">
                    <div className="p-2">
                      <div className="relative mb-2">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search companies..."
                          value={companySearch}
                          onChange={(e) => setCompanySearch(e.target.value)}
                          className="pl-8 text-sm"
                        />
                      </div>
                      <ScrollArea className="h-60">
                        <div className="space-y-1">
                          {filteredCompanies.map((company) => (
                            <div
                              key={company.id}
                              className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                              onClick={() => handleCompanyToggle(company.id)}
                            >
                              <input
                                type="checkbox"
                                checked={selectedCompanies.includes(company.id)}
                                onChange={() => {}}
                                className="rounded"
                              />
                              <span className="flex-1 text-sm truncate">
                                {company.name}
                              </span>
                              {company.count && (
                                <Badge
                                  variant="outline"
                                  className="text-xs flex-shrink-0"
                                >
                                  {company.count}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            ) : companies.length === 1 ? (
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm text-muted-foreground">
                  Company:
                </span>
                <Badge variant="outline" className="text-xs sm:text-sm">
                  {companies[0].name}
                </Badge>
              </div>
            ) : null}

            {/* Clear All Filters */}
            {(selectedMaterials.length > 0 ||
              selectedColors.length > 0 ||
              selectedCompanies.length > 0) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedMaterials([]);
                  setSelectedColors([]);
                  setSelectedCompanies([]);
                }}
                className="text-muted-foreground hover:text-foreground text-xs sm:text-sm"
              >
                Clear all
              </Button>
            )}
          </div>
        </div>

        {/* Selected Filters Display */}
        {(selectedMaterials.length > 0 ||
          selectedColors.length > 0 ||
          selectedCompanies.length > 0) && (
          <div className="flex flex-wrap gap-2 pt-2">
            {selectedMaterials.map((materialId) => {
              const material = materials.find((m) => m.id === materialId);
              return material ? (
                <Badge
                  key={materialId}
                  variant="secondary"
                  className="flex items-center gap-1 text-xs"
                >
                  <span className="truncate">Material: {material.name}</span>
                  <button
                    onClick={() => handleMaterialToggle(materialId)}
                    className="ml-1 hover:bg-muted/50 rounded-full p-0.5 flex-shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ) : null;
            })}
            {selectedColors.map((colorId) => {
              const color = colors.find((c) => c.id === colorId);
              return color ? (
                <Badge
                  key={colorId}
                  variant="secondary"
                  className="flex items-center gap-1 text-xs"
                >
                  <span className="truncate">Color: {color.name}</span>
                  <button
                    onClick={() => handleColorToggle(colorId)}
                    className="ml-1 hover:bg-muted/50 rounded-full p-0.5 flex-shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ) : null;
            })}
            {selectedCompanies.map((companyId) => {
              const company = companies.find((c) => c.id === companyId);
              return company ? (
                <Badge
                  key={companyId}
                  variant="secondary"
                  className="flex items-center gap-1 text-xs"
                >
                  <span className="truncate">Company: {company.name}</span>
                  <button
                    onClick={() => handleCompanyToggle(companyId)}
                    className="ml-1 hover:bg-muted/50 rounded-full p-0.5 flex-shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ) : null;
            })}
          </div>
        )}

        {/* Selected Assets Actions */}
      </div>
    </div>
  );
};
