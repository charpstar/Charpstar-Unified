// src/components/demo/CompactModelStats.tsx
import React, { useState, useEffect, useRef } from "react";
import { Info, Loader, Copy, Layers, Brush, Palette } from "lucide-react";

interface CompactModelStatsProps {
  modelViewerRef: React.RefObject<any>;
  modelName: string;
  isMobile?: boolean;
}

interface ModelStatistics {
  vertices: number;
  triangles: number;
  meshCount: number;
  materialCount: number;
  doubleSidedCount: number;
  doubleSidedMaterials: string[];
  variantCount: number;
  isLoading: boolean;
}

const formatNumber = (num: number): string => {
  return num.toLocaleString();
};

export const CompactModelStats: React.FC<CompactModelStatsProps> = ({
  modelViewerRef,
  modelName,
  isMobile = false,
}) => {
  const [stats, setStats] = useState<ModelStatistics>({
    vertices: 0,
    triangles: 0,
    meshCount: 0,
    materialCount: 0,
    doubleSidedCount: 0,
    doubleSidedMaterials: [],
    variantCount: 0,
    isLoading: true,
  });
  const [showDoubleSidedDetails, setShowDoubleSidedDetails] = useState(false);
  const lastValidStatsRef = useRef<ModelStatistics | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Improved stats fetching with retry mechanism and cached values
  const fetchStats = () => {
    if (!modelViewerRef.current) {
      return false;
    }

    try {
      // First, always gather the variant count which is more reliable
      const variants = modelViewerRef.current.availableVariants || [];
      const variantCount = Array.isArray(variants) ? variants.length : 0;

      // Try to get stats via the combined method first
      if (typeof modelViewerRef.current.getModelStats === "function") {
        const modelStats = modelViewerRef.current.getModelStats() || {};

        // Sanity check the values - make sure they're numbers and not all zeros
        const hasValidStats =
          typeof modelStats.triangles === "number" &&
          typeof modelStats.vertices === "number" &&
          typeof modelStats.meshCount === "number" &&
          typeof modelStats.materialCount === "number" &&
          !(
            modelStats.triangles === 0 &&
            modelStats.vertices === 0 &&
            modelStats.meshCount === 0 &&
            modelStats.materialCount === 0
          );

        if (hasValidStats) {
          const newStats = {
            vertices: modelStats.vertices,
            triangles: modelStats.triangles,
            meshCount: modelStats.meshCount,
            materialCount: modelStats.materialCount,
            doubleSidedCount: modelStats.doubleSidedCount || 0,
            doubleSidedMaterials: modelStats.doubleSidedMaterials || [],
            variantCount,
            isLoading: false,
          };

          // Cache this valid set of stats
          lastValidStatsRef.current = newStats;

          setStats(newStats);
          return true;
        }
      }

      // Try individual methods as fallback
      const polyStats =
        typeof modelViewerRef.current.getPolyStats === "function"
          ? modelViewerRef.current.getPolyStats()
          : null;

      const meshCount =
        typeof modelViewerRef.current.totalMeshCount === "function"
          ? modelViewerRef.current.totalMeshCount()
          : null;

      const materialCount =
        typeof modelViewerRef.current.totalMaterialCount === "function"
          ? modelViewerRef.current.totalMaterialCount()
          : null;

      const doubleSidedInfo =
        typeof modelViewerRef.current.checkForDoubleSided === "function"
          ? modelViewerRef.current.checkForDoubleSided()
          : { count: 0, materials: [] };

      // Check if we have valid data from individual methods
      const hasValidIndividualStats =
        polyStats &&
        typeof polyStats.triangles === "number" &&
        typeof polyStats.vertices === "number" &&
        typeof meshCount === "number" &&
        typeof materialCount === "number" &&
        !(
          polyStats.triangles === 0 &&
          polyStats.vertices === 0 &&
          meshCount === 0 &&
          materialCount === 0
        );

      if (hasValidIndividualStats) {
        const newStats = {
          vertices: polyStats.vertices,
          triangles: polyStats.triangles,
          meshCount: meshCount,
          materialCount: materialCount,
          doubleSidedCount: doubleSidedInfo.count || 0,
          doubleSidedMaterials: doubleSidedInfo.materials || [],
          variantCount,
          isLoading: false,
        };

        // Cache this valid set of stats
        lastValidStatsRef.current = newStats;

        setStats(newStats);
        return true;
      }

      // If we get here and have lastValidStats but with different variant count,
      // update just the variant count but keep other stats
      if (lastValidStatsRef.current) {
        if (lastValidStatsRef.current.variantCount !== variantCount) {
          const updatedStats = {
            ...lastValidStatsRef.current,
            variantCount,
            isLoading: false,
          };

          setStats(updatedStats);
          return true;
        }

        // Otherwise, just reuse the last valid stats entirely
        setStats({
          ...lastValidStatsRef.current,
          isLoading: false,
        });
        return true;
      }

      // If we get here, we couldn't get valid stats
      return false;
    } catch (error) {
      console.error("Error fetching model statistics:", error);

      // If we have lastValidStats, use them as fallback in case of error
      if (lastValidStatsRef.current) {
        setStats({
          ...lastValidStatsRef.current,
          isLoading: false,
        });
        return true;
      }

      setStats((prev) => ({ ...prev, isLoading: false }));
      return false;
    }
  };

  // Improved effect to handle model changes and ensure stats are accurate
  useEffect(() => {
    // Clear any existing polling timeout
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }

    // Reset loading state when model changes
    setStats((prev) => ({ ...prev, isLoading: true }));

    // Reset the last valid stats when model changes
    lastValidStatsRef.current = null;

    // Create a more robust polling mechanism
    const startPolling = () => {
      let attempts = 0;
      const maxAttempts = 30; // More attempts but with exponential backoff

      const poll = () => {
        attempts++;

        const success = fetchStats();

        if (success && attempts >= 3) {
          // If we've had success and tried at least 3 times, stop polling
          return;
        } else if (attempts >= maxAttempts) {
          // If we've reached the maximum number of attempts, stop polling
          setStats((prev) => ({ ...prev, isLoading: false }));
          return;
        }

        // Calculate backoff time - start with 100ms, then increase (max 2000ms)
        const backoff = Math.min(2000, Math.pow(1.5, attempts) * 100);

        // Schedule next poll with exponential backoff
        pollingTimeoutRef.current = setTimeout(poll, backoff);
      };

      // Start polling
      poll();
    };

    // Try once immediately (for fast models)
    const initialSuccess = fetchStats();

    // If not immediately successful, start polling
    if (!initialSuccess) {
      startPolling();
    } else {
      // If initially successful, still do a couple more polls to refine data
      // (helpful for when the model is still loading textures etc.)
      pollingTimeoutRef.current = setTimeout(() => {
        fetchStats();

        // One more poll after a longer delay
        pollingTimeoutRef.current = setTimeout(() => {
          fetchStats();
        }, 500);
      }, 200);
    }

    // Cleanup polling on unmount or model change
    return () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelViewerRef, modelName]);

  // Add an additional effect to keep polling for stats changes when the model is selected but stats might change
  // (e.g., variants switching might affect double-sided material count)
  useEffect(() => {
    let isMounted = true;

    // Periodically check stats even after loading, but at a much lower frequency
    const intervalId = setInterval(() => {
      if (isMounted && !stats.isLoading) {
        fetchStats();
      }
    }, 2000); // Every 2 seconds

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.isLoading]);

  const toggleDoubleSidedDetails = () => {
    setShowDoubleSidedDetails(!showDoubleSidedDetails);
  };

  // Smaller and more compact panel
  return (
    <div
      className={
        isMobile
          ? "bg-card/95 rounded-md shadow-md border border-border overflow-hidden w-full max-w-md mx-auto text-xs"
          : "absolute top-2 right-2 z-10 bg-card/95 rounded-md shadow-md border border-border overflow-hidden w-52 text-xs"
      }
    >
      <div
        className={
          isMobile
            ? "flex justify-between items-center px-2 py-1 bg-muted border-b border-border"
            : "flex justify-between items-center px-2 py-1 bg-muted border-b border-border"
        }
      >
        <h3 className="text-xs font-medium text-foreground flex items-center">
          <Info size={11} className="mr-1" />
          Model Statistics
        </h3>
      </div>
      {stats.isLoading ? (
        <div
          className={
            isMobile
              ? "p-1 flex items-center justify-center"
              : "p-2 flex items-center justify-center"
          }
        >
          <Loader
            size={12}
            className="animate-spin text-muted-foreground mr-1.5"
          />
          <span className="text-xs text-muted-foreground">
            Loading stats...
          </span>
        </div>
      ) : (
        <div className="text-xs">
          {/* Geometry stats - direct display of triangles and vertices */}
          <div
            className={
              isMobile
                ? "px-1 py-1 border-b border-border grid grid-cols-2 gap-x-2 gap-y-1"
                : "px-2 py-1.5 border-b border-border grid grid-cols-2 gap-x-2 gap-y-1"
            }
          >
            <div className="flex items-center">
              <Copy size={10} className="mr-1.5 text-muted-foreground" />
              <span className="text-foreground">Triangles:</span>
            </div>
            <div className="text-right font-medium text-foreground">
              {formatNumber(stats.triangles)}
            </div>

            <div className="flex items-center">
              <div className="w-2.5 h-2.5 mr-1.5 opacity-0"></div>
              <span className="text-foreground">Vertices:</span>
            </div>
            <div className="text-right font-medium text-foreground">
              {formatNumber(stats.vertices)}
            </div>
          </div>

          {/* Mesh and Material Counts */}
          <div
            className={
              isMobile
                ? "px-1 py-1 border-b border-border grid grid-cols-2 gap-x-2 gap-y-1"
                : "px-2 py-1.5 border-b border-border grid grid-cols-2 gap-x-2 gap-y-1"
            }
          >
            <div className="flex items-center">
              <Layers size={10} className="mr-1.5 text-muted-foreground" />
              <span className="text-foreground">Meshes:</span>
            </div>
            <div className="text-right font-medium text-foreground">
              {formatNumber(stats.meshCount)}
            </div>

            <div className="flex items-center">
              <Brush size={10} className="mr-1.5 text-muted-foreground" />
              <span className="text-foreground">Materials:</span>
            </div>
            <div className="text-right font-medium text-foreground">
              {formatNumber(stats.materialCount)}
            </div>
          </div>

          {/* Variants Count */}
          <div
            className={
              isMobile
                ? "px-1 py-1 border-b border-border grid grid-cols-2 gap-x-2"
                : "px-2 py-1.5 border-b border-border grid grid-cols-2 gap-x-2"
            }
          >
            <div className="flex items-center">
              <Palette size={10} className="mr-1.5 text-muted-foreground" />
              <span className="text-foreground">Variants:</span>
            </div>
            <div className="text-right font-medium text-foreground">
              {formatNumber(stats.variantCount)}
            </div>
          </div>

          {/* Double Sided Materials */}
          <div className={isMobile ? "px-1 py-1" : "px-2 py-1.5"}>
            <div
              className={`flex items-center justify-between ${stats.doubleSidedCount > 0 ? "cursor-pointer hover:bg-muted" : ""}`}
              onClick={
                stats.doubleSidedCount > 0
                  ? toggleDoubleSidedDetails
                  : undefined
              }
            >
              <div className="flex items-center">
                <div
                  className={`w-2 h-2 rounded-full mr-1.5 ${stats.doubleSidedCount > 0 ? "bg-yellow-400" : "bg-green-400"}`}
                ></div>
                <span className="text-foreground">Double Sided:</span>
              </div>
              <span className="font-medium flex items-center text-foreground">
                {formatNumber(stats.doubleSidedCount)}
                {stats.doubleSidedCount > 0 && (
                  <button className="ml-1 p-0.5">
                    {showDoubleSidedDetails ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="18 15 12 9 6 15"></polyline>
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    )}
                  </button>
                )}
              </span>
            </div>

            {showDoubleSidedDetails && stats.doubleSidedCount > 0 && (
              <div className="mt-1 text-[10px] max-h-24 overflow-y-auto ml-3.5 bg-muted p-1.5 rounded">
                {stats.doubleSidedMaterials.map((material, index) => (
                  <div
                    key={index}
                    className="text-muted-foreground mb-0.5 flex items-center"
                  >
                    <span className="w-1 h-1 bg-yellow-400 rounded-full mr-1"></span>
                    <span className="truncate">{material}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
