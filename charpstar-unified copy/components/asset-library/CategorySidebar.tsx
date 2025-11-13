import React, { useState } from "react";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  ChevronLeft,
  X,
  ChevronDown,
} from "lucide-react";

interface CategoryOption {
  id: string;
  name: string;
  subcategories?: CategoryOption[];
}

interface CategorySidebarProps {
  categories: CategoryOption[];
  selectedCategory: string | null;
  setSelectedCategory: (id: string | null) => void;
  selectedSubcategory: string | null;
  setSelectedSubcategory: (id: string | null) => void;
  onClearAllFilters?: () => void;
  onClose?: () => void;
  className?: string;
  selectedCompanies?: string[];
  assets?: any[];
}

export const CategorySidebar: React.FC<CategorySidebarProps> = ({
  categories,
  selectedCategory,
  setSelectedCategory,
  selectedSubcategory,
  setSelectedSubcategory,
  onClearAllFilters,
  onClose,
  className = "",
  selectedCompanies = [],
  assets = [],
}) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );

  // Filter categories based on selected companies
  const filteredCategories = React.useMemo(() => {
    if (selectedCompanies.length === 0) {
      return categories;
    }

    // Get all assets that belong to the selected companies
    const companyAssets = assets.filter((asset) =>
      selectedCompanies.includes(asset.client)
    );

    // Get unique categories from these assets
    const availableCategories = new Set(
      companyAssets.map((asset) => asset.category).filter(Boolean)
    );

    // Filter categories and their subcategories
    return categories
      .filter((category) => availableCategories.has(category.id))
      .map((category) => {
        // Get available subcategories for this category and these companies
        const availableSubcategories = new Set(
          companyAssets
            .filter((asset) => asset.category === category.id)
            .map((asset) => asset.subcategory)
            .filter(Boolean)
        );

        return {
          ...category,
          subcategories: category.subcategories?.filter((sub) =>
            availableSubcategories.has(sub.id)
          ),
        };
      });
  }, [categories, selectedCompanies, assets]);

  const currentSubcategories = selectedCategory
    ? filteredCategories.find((cat) => cat.id === selectedCategory)
        ?.subcategories || []
    : [];

  const toggleSubcategories = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  // Hide the sidebar if no categories are available
  if (filteredCategories.length === 0) {
    return null;
  }

  return (
    <div
      className={`w-full lg:w-62 h-full lg:h-cover bg-muted/30 border-b lg:border-b-0 lg:border-r border-border p-3 sm:p-4 space-y-3 sm:space-y-4 ${className}`}
    >
      {/* Header */}
      <div className="pb-2 sm:pb-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-foreground">
              Categories
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Browse by category
            </p>
          </div>
          {/* Close button for mobile */}
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="lg:hidden h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* All Categories Button */}
      <div className="space-y-1">
        <Button
          variant={
            !selectedCategory && !selectedSubcategory ? "default" : "ghost"
          }
          className={`w-full justify-start h-9 sm:h-10 px-2 sm:px-3 cursor-pointer text-sm sm:text-base ${
            !selectedCategory && !selectedSubcategory
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted/50"
          }`}
          onClick={() => {
            if (onClearAllFilters) {
              onClearAllFilters();
            } else {
              setSelectedCategory(null);
              setSelectedSubcategory(null);
            }
            // Clear all expanded categories when going back to "All Categories"
            setExpandedCategories(new Set());
          }}
        >
          {selectedCategory || selectedSubcategory ? (
            <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
          ) : (
            <Folder className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
          )}
          <span className="truncate">All Categories</span>
          {!selectedCategory && !selectedSubcategory && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {filteredCategories.length}
            </Badge>
          )}
        </Button>
      </div>

      {/* Separator */}
      <div className="border-t border-border/50" />

      {/* Categories List */}
      <div className="space-y-1">
        {/* Categories Dropdown */}
        <div className="border border-border/50 rounded-md bg-background/50 max-h-[400px] sm:max-h-[600px] lg:max-h-[800px] overflow-y-auto">
          <div className="p-1 space-y-1">
            {filteredCategories
              .filter(
                (category) =>
                  // If a category is selected, only show that category
                  !selectedCategory || category.id === selectedCategory
              )
              .map((category) => (
                <div key={category.id} className="space-y-1">
                  <Button
                    variant={
                      selectedCategory === category.id ? "default" : "ghost"
                    }
                    className={`w-full justify-start h-9 sm:h-10 px-2 sm:px-3 cursor-pointer text-sm sm:text-base ${
                      selectedCategory === category.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => {
                      // If clicking the same category, deselect it
                      if (selectedCategory === category.id) {
                        setSelectedCategory(null);
                        setSelectedSubcategory(null);
                        // Collapse subcategories when deselecting
                        setExpandedCategories((prev) => {
                          const newSet = new Set(prev);
                          newSet.delete(category.id);
                          return newSet;
                        });
                      } else {
                        // Select new category and deselect any previous one
                        setSelectedCategory(category.id);
                        setSelectedSubcategory(null);
                        // Only one category can be expanded at a time - collapse all others
                        if (
                          category.subcategories &&
                          category.subcategories.length > 0
                        ) {
                          // Replace the entire set with just this category
                          setExpandedCategories(new Set([category.id]));
                        } else {
                          // No subcategories, so clear all expanded categories
                          setExpandedCategories(new Set());
                        }
                      }
                    }}
                  >
                    {selectedCategory === category.id ? (
                      <FolderOpen className="h-3 w-3 sm:h-4 sm:w-4 mr-2 flex-shrink-0" />
                    ) : (
                      <Folder className="h-3 w-3 sm:h-4 sm:w-4 mr-2 flex-shrink-0" />
                    )}
                    <span className="truncate">{category.name}</span>
                    {category.subcategories &&
                      category.subcategories.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 ml-auto flex-shrink-0 hover:bg-transparent"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSubcategories(category.id);
                          }}
                        >
                          {expandedCategories.has(category.id) ? (
                            <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />
                          ) : (
                            <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                          )}
                        </Button>
                      )}
                  </Button>

                  {/* Subcategories Dropdown (show when expanded) */}
                  {expandedCategories.has(category.id) &&
                    category.subcategories &&
                    category.subcategories.length > 0 && (
                      <div className="space-y-1 ml-2">
                        <Button
                          variant={!selectedSubcategory ? "secondary" : "ghost"}
                          size="sm"
                          className={`w-full justify-start h-7 sm:h-8 px-2 sm:px-3 text-xs sm:text-sm cursor-pointer ${
                            !selectedSubcategory
                              ? "bg-secondary text-secondary-foreground"
                              : "hover:bg-muted/50"
                          }`}
                          onClick={() => setSelectedSubcategory(null)}
                        >
                          {selectedSubcategory && (
                            <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                          )}
                          <span className="truncate">All {category.name}</span>
                        </Button>

                        {/* Subcategories Dropdown */}
                        <div className="border border-border/50 rounded-md bg-background/50 max-h-[300px] sm:max-h-[500px] lg:max-h-[700px] overflow-y-auto">
                          <div className="p-1 space-y-1">
                            {category.subcategories.map((subcategory) => (
                              <Button
                                key={subcategory.id}
                                variant={
                                  selectedSubcategory === subcategory.id
                                    ? "secondary"
                                    : "ghost"
                                }
                                size="sm"
                                className={`w-full justify-start h-7 sm:h-8 px-2 sm:px-3 text-xs sm:text-sm cursor-pointer ${
                                  selectedSubcategory === subcategory.id
                                    ? "bg-secondary text-secondary-foreground"
                                    : "hover:bg-muted/50"
                                }`}
                                onClick={() =>
                                  setSelectedSubcategory(subcategory.id)
                                }
                              >
                                <span className="truncate">
                                  {subcategory.name}
                                </span>
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Footer with counts */}
      <div className="pt-2 sm:pt-3 border-t border-border">
        <div className="text-xs text-muted-foreground">
          {selectedCategory ? (
            <>
              <div className="font-medium truncate">
                {
                  filteredCategories.find((c) => c.id === selectedCategory)
                    ?.name
                }
              </div>
              {selectedSubcategory && (
                <div className="text-muted-foreground truncate">
                  {
                    currentSubcategories.find(
                      (s) => s.id === selectedSubcategory
                    )?.name
                  }
                </div>
              )}
            </>
          ) : (
            <div className="font-medium">All Categories</div>
          )}
        </div>
      </div>
    </div>
  );
};
