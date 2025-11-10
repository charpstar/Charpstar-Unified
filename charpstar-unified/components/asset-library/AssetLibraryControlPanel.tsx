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
  LayoutGrid,
  Rows,
  Filter,
  Search,
  ChevronRight,
  Upload,
  X,
  ChevronDown,
  Image,
  Edit3,
  CheckCircle2,
  XCircle,
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

interface CategoryOption {
  id: string;
  name: string;
  subcategories?: CategoryOption[];
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
  categories: CategoryOption[];
  selectedCategory: string | null;
  setSelectedCategory: (category: string | null) => void;
  selectedSubcategory: string | null;
  setSelectedSubcategory: (subcategory: string | null) => void;
  materials: FilterOption[];
  selectedMaterials: string[];
  setSelectedMaterials: React.Dispatch<React.SetStateAction<string[]>>;
  colors: FilterOption[];
  selectedColors: string[];
  setSelectedColors: React.Dispatch<React.SetStateAction<string[]>>;
  companies: FilterOption[];
  selectedCompanies: string[];
  setSelectedCompanies: React.Dispatch<React.SetStateAction<string[]>>;
  // Active filter props
  showInactiveOnly: boolean;
  setShowInactiveOnly: React.Dispatch<React.SetStateAction<boolean>>;
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
  categories,
  selectedCategory,
  setSelectedCategory,
  selectedSubcategory,
  setSelectedSubcategory,
  materials,
  selectedMaterials,
  setSelectedMaterials,
  colors,
  selectedColors,
  setSelectedColors,
  companies,
  selectedCompanies,
  setSelectedCompanies,
  showInactiveOnly,
  setShowInactiveOnly,
  className = "",
}) => {
  const [materialSearch, setMaterialSearch] = React.useState("");
  const [colorSearch, setColorSearch] = React.useState("");
  const [companySearch, setCompanySearch] = React.useState("");
  const [categorySearch, setCategorySearch] = React.useState("");
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

  const filteredCategories = categories.filter((category) =>
    category.name.toLowerCase().includes(categorySearch.toLowerCase())
  );

  const filteredMaterials = materials.filter((material) =>
    material.name.toLowerCase().includes(materialSearch.toLowerCase())
  );
  const filteredColors = colors.filter((color) =>
    color.name.toLowerCase().includes(colorSearch.toLowerCase())
  );
  const filteredCompanies = companies.filter((company) =>
    company.name.toLowerCase().includes(companySearch.toLowerCase())
  );

  const handleCategorySelect = (categoryId: string | null) => {
    setSelectedCategory(categoryId); // Parent handler clears subcategory automatically
  };

  const handleSubcategorySelect = (subcategoryId: string | null) => {
    setSelectedSubcategory(subcategoryId);
  };

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

  const getCategoryLabel = () => {
    if (selectedSubcategory && selectedCategory) {
      const category = categories.find((c) => c.id === selectedCategory);
      const subcategory = category?.subcategories?.find(
        (s) => s.id === selectedSubcategory
      );
      return subcategory?.name || "Category";
    }
    if (selectedCategory) {
      const category = categories.find((c) => c.id === selectedCategory);
      return category?.name || "Category";
    }
    return "Category";
  };

  return (
    <div
      className={`sticky top-0 z-10 bg-background rounded-b-lg border-b border-border shadow-md ${className}`}
    >
      {/* Compact Header with Breadcrumbs & Quick Actions */}
      <div className="bg-muted/30 border-b border-border/50 px-4 py-2">
        <div className="flex items-center justify-between gap-4">
          {/* Breadcrumbs */}
          <nav className="flex items-center space-x-1 text-xs text-muted-foreground overflow-x-auto flex-1 min-w-0">
            {breadcrumbs.map((item, index) => (
              <React.Fragment key={index}>
                {index > 0 && (
                  <ChevronRight className="h-3 w-3 flex-shrink-0 opacity-50" />
                )}
                <Link
                  href={item.href}
                  onClick={item.onClick}
                  className="hover:text-foreground transition-colors whitespace-nowrap flex-shrink-0 font-medium"
                >
                  {item.label}
                </Link>
              </React.Fragment>
            ))}
          </nav>

          {/* Admin Quick Actions */}
          {userRole === "admin" && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onGeneratePreviews}
                    className="h-7 px-2"
                  >
                    <Image className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Generate Previews</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/asset-library/upload">
                    <Button variant="ghost" size="sm" className="h-7 px-2">
                      <Upload className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>Upload Assets</TooltipContent>
              </Tooltip>
            </div>
          )}
          {/* Batch Edit - Admin */}
          {userRole === "admin" && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onBatchEdit}
                    className="h-7 px-2"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Batch Edit</TooltipContent>
              </Tooltip>
            </div>
          )}
          {/* Batch Edit - Client */}
          {userRole === "client" && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onBatchEdit}
                    className="h-7 px-2"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Select Assets</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </div>

      {/* Main Control Bar */}
      <div className="p-4 rounded-b-lg ">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Left: Search */}
          <div className="flex-1 min-w-0">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Search assets by name, material, color..."
                value={localSearchValue}
                onChange={(e) => setLocalSearchValue(e.target.value)}
                onKeyDown={handleKeyPress}
                className="pl-10 pr-10 h-10 bg-muted/50 border-border/50 focus:bg-background transition-colors"
              />
              {localSearchValue && (
                <>
                  <span className="absolute right-10 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">
                    Press Enter to search..
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearSearch}
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-3 flex-wrap lg:flex-nowrap">
            {/* Sort */}
            <Select value={sortValue} onValueChange={setSortValue}>
              <SelectTrigger className="w-full sm:w-[180px] h-10 bg-muted/50 border-border/50 cursor-pointer">
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
            <div className="flex items-center bg-muted/50 rounded-md p-1 gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === "grid" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className="h-8 w-8 p-0 cursor-pointer"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Grid View</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === "compactGrid" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("compactGrid")}
                    className="h-8 w-8 p-0 cursor-pointer"
                  >
                    <Rows className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>List View</TooltipContent>
              </Tooltip>
            </div>

            {/* Active/Inactive Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showInactiveOnly ? "destructive" : "secondary"}
                  size="sm"
                  onClick={() => setShowInactiveOnly(!showInactiveOnly)}
                  className="h-10 px-3 cursor-pointer gap-2"
                >
                  {showInactiveOnly ? (
                    <XCircle className="h-4 w-4" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  <span className="hidden md:inline text-sm">
                    {showInactiveOnly ? "Inactive" : "Active"}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {showInactiveOnly
                  ? "Showing inactive assets - Click to show active"
                  : "Showing active assets - Click to show inactive"}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mr-2">
            <Filter className="h-3.5 w-3.5" />
            <span>Filters</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Debug info */}
            {categories.length === 0 &&
              materials.length === 0 &&
              colors.length === 0 &&
              companies.length === 0 && (
                <span className="text-xs text-muted-foreground italic">
                  No filter options available (Cat: {categories.length}, Mat:{" "}
                  {materials.length}, Col: {colors.length}, Comp:{" "}
                  {companies.length})
                </span>
              )}

            {/* Category Filter */}
            {categories.length > 0 && (
              <Popover modal={false}>
                <PopoverTrigger asChild>
                  <Button
                    variant={selectedCategory ? "secondary" : "outline"}
                    size="sm"
                    className="h-8 px-3 gap-2 cursor-pointer rounded-full text-xs font-medium"
                  >
                    <span>{getCategoryLabel()}</span>
                    {(selectedCategory || selectedSubcategory) && (
                      <Badge
                        variant="default"
                        className="h-4 px-1.5 text-[10px] rounded-full"
                      >
                        1
                      </Badge>
                    )}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-64 p-0"
                  align="start"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <div className="p-2">
                    <div className="relative mb-2">
                      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search categories..."
                        value={categorySearch}
                        onChange={(e) => setCategorySearch(e.target.value)}
                        className="pl-8 text-sm"
                      />
                    </div>
                    <ScrollArea className="h-60">
                      <div className="space-y-1">
                        {/* All Categories Option */}
                        <div
                          className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                          onClick={() => handleCategorySelect(null)}
                        >
                          <input
                            type="radio"
                            checked={!selectedCategory}
                            onChange={() => {}}
                            className="rounded-full"
                          />
                          <span className="flex-1 text-sm font-medium">
                            All Categories
                          </span>
                        </div>

                        {/* Categories List */}
                        {filteredCategories.map((category) => (
                          <div key={category.id} className="space-y-1">
                            <div
                              className={`flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors ${
                                selectedCategory === category.id
                                  ? "bg-muted/30"
                                  : ""
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCategorySelect(category.id);
                              }}
                            >
                              <input
                                type="radio"
                                checked={selectedCategory === category.id}
                                onChange={() => {}}
                                className="rounded-full pointer-events-none"
                              />
                              <span className="flex-1 text-sm truncate font-medium">
                                {category.name}
                              </span>
                              {category.subcategories &&
                                category.subcategories.length > 0 && (
                                  <ChevronDown
                                    className={`h-3 w-3 transition-transform ${
                                      selectedCategory === category.id
                                        ? "rotate-180"
                                        : ""
                                    }`}
                                  />
                                )}
                            </div>

                            {/* Subcategories */}
                            {selectedCategory === category.id &&
                              category.subcategories &&
                              category.subcategories.length > 0 && (
                                <div className="ml-6 space-y-1 border-l-2 border-primary/30 pl-2">
                                  {category.subcategories.map((subcategory) => (
                                    <div
                                      key={subcategory.id}
                                      className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSubcategorySelect(subcategory.id);
                                      }}
                                    >
                                      <input
                                        type="radio"
                                        checked={
                                          selectedSubcategory === subcategory.id
                                        }
                                        onChange={() => {}}
                                        className="rounded-full pointer-events-none"
                                      />
                                      <span className="flex-1 text-sm truncate">
                                        {subcategory.name}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Materials Filter */}
            {materials.length > 1 ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={
                      selectedMaterials.length > 0 ? "secondary" : "outline"
                    }
                    size="sm"
                    className="h-8 px-3 gap-2 cursor-pointer rounded-full text-xs font-medium"
                  >
                    <span>Materials</span>
                    {selectedMaterials.length > 0 && (
                      <Badge
                        variant="default"
                        className="h-4 px-1.5 text-[10px] rounded-full"
                      >
                        {selectedMaterials.length}
                      </Badge>
                    )}
                    <ChevronDown className="h-3 w-3 opacity-50" />
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
                              checked={selectedMaterials.includes(material.id)}
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
            ) : materials.length === 1 ? (
              <Badge
                variant="secondary"
                className="h-8 px-3 rounded-full text-xs font-medium"
              >
                {materials[0].name}
              </Badge>
            ) : null}

            {/* Colors Filter */}
            {colors.length > 1 ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={
                      selectedColors.length > 0 ? "secondary" : "outline"
                    }
                    size="sm"
                    className="h-8 px-3 gap-2 cursor-pointer rounded-full text-xs font-medium"
                  >
                    <span>Colors</span>
                    {selectedColors.length > 0 && (
                      <Badge
                        variant="default"
                        className="h-4 px-1.5 text-[10px] rounded-full"
                      >
                        {selectedColors.length}
                      </Badge>
                    )}
                    <ChevronDown className="h-3 w-3 opacity-50" />
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
            ) : colors.length === 1 ? (
              <Badge
                variant="secondary"
                className="h-8 px-3 rounded-full text-xs font-medium"
              >
                {colors[0].name}
              </Badge>
            ) : null}

            {/* Companies Filter */}
            {companies.length > 1 ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={
                      selectedCompanies.length > 0 ? "secondary" : "outline"
                    }
                    size="sm"
                    className="h-8 px-3 gap-2 cursor-pointer rounded-full text-xs font-medium"
                  >
                    <span>Companies</span>
                    {selectedCompanies.length > 0 && (
                      <Badge
                        variant="default"
                        className="h-4 px-1.5 text-[10px] rounded-full"
                      >
                        {selectedCompanies.length}
                      </Badge>
                    )}
                    <ChevronDown className="h-3 w-3 opacity-50" />
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
            ) : companies.length === 1 ? (
              <Badge
                variant="secondary"
                className="h-8 px-3 rounded-full text-xs font-medium"
              >
                {companies[0].name}
              </Badge>
            ) : null}

            {/* Clear All Filters */}
            {(selectedCategory ||
              selectedSubcategory ||
              selectedMaterials.length > 0 ||
              selectedColors.length > 0 ||
              selectedCompanies.length > 0) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedCategory(null); // This also clears subcategory
                  setSelectedMaterials([]);
                  setSelectedColors([]);
                  setSelectedCompanies([]);
                }}
                className="h-8 px-3 text-xs font-medium text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
              >
                Clear all
              </Button>
            )}
          </div>
        </div>

        {/* Active Filters Display */}
        {(selectedCategory ||
          selectedSubcategory ||
          selectedMaterials.length > 0 ||
          selectedColors.length > 0 ||
          selectedCompanies.length > 0) && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/50">
            {/* Category Badge */}
            {selectedCategory && (
              <div className="inline-flex items-center gap-1.5 h-7 px-3 bg-primary/10 text-primary rounded-full text-xs font-medium group">
                <span className="truncate max-w-[200px]">
                  {selectedSubcategory
                    ? `${categories.find((c) => c.id === selectedCategory)?.subcategories?.find((s) => s.id === selectedSubcategory)?.name}`
                    : `${categories.find((c) => c.id === selectedCategory)?.name}`}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedCategory(null); // This also clears subcategory
                  }}
                  className="hover:bg-primary/20 rounded-full p-0.5 transition-colors cursor-pointer"
                  aria-label="Remove category filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {selectedMaterials.map((materialId) => {
              const material = materials.find((m) => m.id === materialId);
              return material ? (
                <div
                  key={materialId}
                  className="inline-flex items-center gap-1.5 h-7 px-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full text-xs font-medium"
                >
                  <span className="truncate max-w-[150px]">
                    {material.name}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleMaterialToggle(materialId);
                    }}
                    className="hover:bg-blue-500/20 rounded-full p-0.5 transition-colors cursor-pointer"
                    aria-label={`Remove ${material.name} filter`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : null;
            })}
            {selectedColors.map((colorId) => {
              const color = colors.find((c) => c.id === colorId);
              return color ? (
                <div
                  key={colorId}
                  className="inline-flex items-center gap-1.5 h-7 px-3 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full text-xs font-medium"
                >
                  <span className="truncate max-w-[150px]">{color.name}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleColorToggle(colorId);
                    }}
                    className="hover:bg-purple-500/20 rounded-full p-0.5 transition-colors cursor-pointer"
                    aria-label={`Remove ${color.name} filter`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : null;
            })}
            {selectedCompanies.map((companyId) => {
              const company = companies.find((c) => c.id === companyId);
              return company ? (
                <div
                  key={companyId}
                  className="inline-flex items-center gap-1.5 h-7 px-3 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-full text-xs font-medium"
                >
                  <span className="truncate max-w-[150px]">{company.name}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleCompanyToggle(companyId);
                    }}
                    className="hover:bg-orange-500/20 rounded-full p-0.5 transition-colors cursor-pointer"
                    aria-label={`Remove ${company.name} filter`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : null;
            })}
          </div>
        )}
      </div>
    </div>
  );
};
