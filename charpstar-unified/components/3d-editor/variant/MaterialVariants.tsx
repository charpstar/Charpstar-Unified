// src/components/variant/MaterialVariants.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/inputs";

interface MaterialVariantsProps {
  modelViewerRef: React.RefObject<any>;
  onVariantChange?: () => void;
  selectedNode?: any | null;
  isMobile?: boolean;
}

export const MaterialVariants: React.FC<MaterialVariantsProps> = ({
  modelViewerRef,
  onVariantChange,
  selectedNode,
}) => {
  const [variants, setVariants] = useState<string[]>([]);
  const [currentVariant, setCurrentVariant] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const hasMountedRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchVariants = useCallback(() => {
    if (!modelViewerRef.current) {
      return false;
    }

    try {
      // Get all available variants
      const availableVariants = modelViewerRef.current.availableVariants || [];

      if (availableVariants.length > 0) {
        setVariants(availableVariants);
        setLoading(false);

        // Set the current variant if none is selected
        if (!currentVariant && availableVariants.length > 0) {
          setCurrentVariant(availableVariants[0]);
        }

        return true;
      }

      return false;
    } catch (error) {
      console.error("Error fetching variants:", error);
      return false;
    }
  }, [modelViewerRef, currentVariant]);

  const startTimeRef = useRef(Date.now());
  // Add a reset function that's triggered when a new model is loaded
  useEffect(() => {
    // Reset polling on component mount or when modelViewerRef changes
    const resetPolling = () => {
      setVariants([]);
      setCurrentVariant(null);
      setLoading(true);
      hasMountedRef.current = false;

      // Clear existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Reset polling with a new interval
      intervalRef.current = setInterval(() => {
        const hasVariants = fetchVariants();

        // Stop polling after finding variants or after a timeout (like 10 seconds)
        if (intervalRef.current) {
          if (hasVariants || Date.now() - startTimeRef.current > 10000) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      }, 500);
    };

    // Reset polling when the component mounts
    resetPolling();

    // Monitor modelViewerRef for changes
    const modelViewer = modelViewerRef.current;
    if (modelViewer) {
      // Listen for model load events to reset polling
      modelViewer.addEventListener("load", resetPolling);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        modelViewer.removeEventListener("load", resetPolling);
      };
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [modelViewerRef, fetchVariants]);

  // Set up polling for variants
  useEffect(() => {
    // Fetch immediately on mount
    if (!hasMountedRef.current) {
      fetchVariants();
      hasMountedRef.current = true;
    }

    // Set up polling interval (check every 500ms)
    intervalRef.current = setInterval(() => {
      const hasVariants = fetchVariants();

      // Once we've found variants, we can stop polling
      if (intervalRef.current) {
        if (hasVariants) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    }, 500);

    // Add a load event listener as a backup
    const modelViewer = modelViewerRef.current;
    if (modelViewer) {
      modelViewer.addEventListener("load", fetchVariants);
    }

    return () => {
      // Clean up interval and event listener
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      if (modelViewer) {
        modelViewer.removeEventListener("load", fetchVariants);
      }

      hasMountedRef.current = false;
    };
  }, [modelViewerRef, fetchVariants]);

  // Function to select a variant
  const selectVariant = (variantName: string) => {
    if (modelViewerRef.current) {
      try {
        // Apply the variant
        modelViewerRef.current.variantName = variantName;
        setCurrentVariant(variantName);

        // Wait a brief moment for the variant to be applied
        setTimeout(() => {
          // If the selectedNode exists, we need to refresh the material properties
          // by forcing a re-query of the material information
          if (selectedNode && modelViewerRef.current) {
            try {
              // Force a refresh of the material state by requesting a render
              if (typeof modelViewerRef.current.requestRender === "function") {
                modelViewerRef.current.requestRender();
              }
            } catch (error) {
              console.error(
                "Error refreshing material after variant change:",
                error
              );
            }
          }

          // Notify parent component of the variant change
          if (onVariantChange) {
            onVariantChange();
          }
        }, 100);
      } catch (error) {
        console.error("Error selecting variant:", error);
      }
    }
  };

  // Filter variants based on search query
  const filteredVariants = searchQuery
    ? variants.filter((variant) =>
        variant.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : variants;

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery("");
  };

  // If there are no variants or still loading, show appropriate message
  if (variants.length === 0) {
    return (
      <div className="text-muted-foreground text-xs">
        {loading
          ? "Loading variants..."
          : "No material variants available for this model."}
      </div>
    );
  }

  return (
    <div className="space-y-2 pb-4">
      {/* Search box */}
      <div className="relative mb-3">
        <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
          <Search size={16} className="text-muted-foreground" />
        </div>
        <Input
          type="text"
          placeholder="Search variants..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="pl-8 pr-8 py-1 h-8 text-sm bg-background border-border focus:ring-accent focus:border-accent"
        />
        {searchQuery && (
          <button
            onClick={clearSearch}
            className="absolute inset-y-0 right-0 pr-2 flex items-center text-muted-foreground hover:text-foreground"
          >
            <span className="text-xs">✕</span>
          </button>
        )}
      </div>

      {/* Variants count */}
      <div className="text-xs text-muted-foreground mb-2">
        {filteredVariants.length === variants.length
          ? `${variants.length} variants available`
          : `Showing ${filteredVariants.length} of ${variants.length} variants`}
      </div>

      {/* Variants list */}
      <div className="grid grid-cols-1 gap-2 max-h-96 overflow">
        {filteredVariants.length === 0 ? (
          <div className="text-muted-foreground text-xs italic p-2 text-center">
            No variants match your search
          </div>
        ) : (
          filteredVariants.map((variant, index) => (
            <div
              key={index}
              className={`p-2 cursor-pointer border rounded-sm ${
                currentVariant === variant
                  ? "bg-accent border-accent text-accent-foreground"
                  : "bg-card border-border hover:bg-muted"
              }`}
              onClick={() => selectVariant(variant)}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm truncate text-foreground">
                  {variant}
                </div>
                {currentVariant === variant && (
                  <div className="text-xs text-accent-foreground ml-1">✓</div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
