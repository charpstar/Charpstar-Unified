import React from "react";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import { ChevronRight, Folder, FolderOpen, ChevronLeft, X } from "lucide-react";

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
}) => {
  const currentSubcategories = selectedCategory
    ? categories.find((cat) => cat.id === selectedCategory)?.subcategories || []
    : [];

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
              {categories.length}
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
            {categories.map((category) => (
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
                    setSelectedCategory(category.id);
                    setSelectedSubcategory(null);
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
                      <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 ml-auto flex-shrink-0" />
                    )}
                </Button>

                {/* Subcategories Dropdown (only show if this category is selected) */}
                {selectedCategory === category.id &&
                  category.subcategories &&
                  category.subcategories.length > 0 && (
                    <div className="space-y-1">
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
                        <span className="truncate">Subcategories</span>
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
                {categories.find((c) => c.id === selectedCategory)?.name}
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
