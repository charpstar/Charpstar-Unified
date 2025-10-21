import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import { Download, Check, CheckCircle2, XCircle } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/display";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { useUser } from "@/contexts/useUser";
import { useToast } from "@/components/ui/utilities/use-toast";

// Global cache to prevent multiple API calls for the same client
const remainingChangesCache = new Map<
  string,
  { count: number; timestamp: number }
>();
const CACHE_DURATION = 10000; // 10 seconds

// Track ongoing requests to prevent duplicate calls
const ongoingRequests = new Set<string>();

// Callbacks to notify all components when data is fetched
const dataCallbacks = new Map<string, Set<(count: number) => void>>();

interface Asset {
  id: string;
  product_name: string;
  preview_image: string | string[];
  category: string;
  subcategory: string;
  materials?: string[];
  colors?: string[];
  client?: string;
  glb_link?: string;
  active?: boolean;
}

interface AssetCardProps {
  asset: Asset;
  isBatchEditMode?: boolean;
  isSelected?: boolean;
  onSelect?: (assetId: string) => void;
  viewMode?: "grid" | "compactGrid";
  onStatusChange?: () => void;
  canDownloadGLB?: boolean;
}

export default function AssetCard({
  asset,
  isBatchEditMode = false,
  isSelected = false,
  onSelect,
  viewMode = "grid",
  onStatusChange,
  canDownloadGLB = false,
}: AssetCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [imgLoaded, setImgLoaded] = useState(false);
  const [isActive, setIsActive] = useState(asset.active ?? true);
  const [isTogglingActive, setIsTogglingActive] = useState(false);
  const [remainingChanges, setRemainingChanges] = useState<number | null>(null);
  const [isUpdatingChanges, setIsUpdatingChanges] = useState(false);
  const user = useUser();
  const { toast } = useToast();

  const isCompactMode = viewMode === "compactGrid";

  // Helper function to get the first preview image (handles both string and array)
  const getPreviewImage = (
    preview: string | string[] | null | undefined
  ): string => {
    if (!preview) return "";
    if (Array.isArray(preview)) {
      return preview.length > 0 ? preview[0] : "";
    }
    return preview;
  };

  const previewImageUrl: string = getPreviewImage(asset.preview_image);

  // Fetch remaining changes for client users with caching
  const fetchRemainingChanges = useCallback(
    async (force = false) => {
      if (!user?.metadata?.client || user?.metadata?.role === "admin") return;

      const clientName = asset.client || "";
      const now = Date.now();

      // Check cache first
      if (!force) {
        const cached = remainingChangesCache.get(clientName);
        if (cached && now - cached.timestamp < CACHE_DURATION) {
          setRemainingChanges(cached.count);
          return;
        }
      }

      // Check if there's already an ongoing request for this client
      if (ongoingRequests.has(clientName)) {
        return;
      }

      // Mark request as ongoing
      ongoingRequests.add(clientName);

      try {
        const response = await fetch(
          `/api/assets/remaining-changes?client=${encodeURIComponent(clientName)}`
        );
        if (response.ok) {
          const data = await response.json();
          const count = data.remainingChanges;
          setRemainingChanges(count);
          // Update cache
          remainingChangesCache.set(clientName, { count, timestamp: now });

          // Notify all components for this client
          const callbacks = dataCallbacks.get(clientName);
          if (callbacks) {
            callbacks.forEach((callback) => callback(count));
          }
        }
      } catch (error) {
        console.error("Error fetching remaining changes:", error);
      } finally {
        // Remove from ongoing requests
        ongoingRequests.delete(clientName);
      }
    },
    [user?.metadata?.client, user?.metadata?.role, asset.client]
  );

  useEffect(() => {
    if (user?.metadata?.role !== "admin" && asset.client) {
      const clientName = asset.client;

      // Check if we already have cached data
      const cached = remainingChangesCache.get(clientName);
      if (cached) {
        setRemainingChanges(cached.count);
        return;
      }

      // Register callback to get notified when data is fetched
      const callback = (count: number) => {
        setRemainingChanges(count);
      };

      if (!dataCallbacks.has(clientName)) {
        dataCallbacks.set(clientName, new Set());
      }
      dataCallbacks.get(clientName)!.add(callback);

      // Fetch remaining changes with a shorter delay
      const timeoutId = setTimeout(() => {
        fetchRemainingChanges();
      }, 500); // Reduced delay to 500ms

      return () => {
        clearTimeout(timeoutId);
        // Clean up callback
        const callbacks = dataCallbacks.get(clientName);
        if (callbacks) {
          callbacks.delete(callback);
          if (callbacks.size === 0) {
            dataCallbacks.delete(clientName);
          }
        }
      };
    }
  }, [user?.metadata?.role, asset.client, fetchRemainingChanges]);

  const handleToggleActive = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsTogglingActive(true);

    // Store original values for potential rollback
    const originalIsActive = isActive;
    const originalRemainingChanges = remainingChanges;

    try {
      const response = await fetch(`/api/assets/${asset.id}/toggle-active`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ active: !isActive }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to toggle active status");
      }

      setIsActive(!isActive);

      // Refresh remaining changes for both deactivation and reactivation
      if (user?.metadata?.role !== "admin") {
        // Optimistically update the remaining changes count
        if (remainingChanges !== null) {
          setIsUpdatingChanges(true);
          let newCount = remainingChanges;
          if (!isActive) {
            // Deactivating: decrease remaining changes (deactivation uses up a change)
            newCount = Math.max(0, remainingChanges - 1);
          } else {
            // Reactivating: increase remaining changes (reactivation frees up a change)
            newCount = remainingChanges + 1;
          }
          setRemainingChanges(newCount);

          // Update cache and notify all components for this client
          const clientName = asset.client || "";
          remainingChangesCache.set(clientName, {
            count: newCount,
            timestamp: Date.now(),
          });

          // Notify all other components for this client
          const callbacks = dataCallbacks.get(clientName);
          if (callbacks) {
            callbacks.forEach((callback) => callback(newCount));
          }
        }
        // Also fetch from server to ensure accuracy (force fetch) with a small delay
        setTimeout(() => {
          fetchRemainingChanges(true).finally(() => {
            setIsUpdatingChanges(false);
          });
        }, 100);
      }

      // Trigger refetch to update the list
      if (onStatusChange) {
        onStatusChange();
      }

      // Show success message
      toast({
        title: "Success",
        description: `Asset ${!isActive ? "deactivated" : "activated"} successfully`,
      });
    } catch (error) {
      console.error("Error toggling active status:", error);

      // Rollback optimistic updates on error
      setIsActive(originalIsActive);
      setIsUpdatingChanges(false);
      if (originalRemainingChanges !== null) {
        setRemainingChanges(originalRemainingChanges);

        // Restore cache and notify other components
        const clientName = asset.client || "";
        remainingChangesCache.set(clientName, {
          count: originalRemainingChanges,
          timestamp: Date.now(),
        });

        // Notify all other components for this client
        const callbacks = dataCallbacks.get(clientName);
        if (callbacks) {
          callbacks.forEach((callback) => callback(originalRemainingChanges));
        }
      }

      // Show error message to user
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to toggle active status",
        variant: "destructive",
      });
    } finally {
      setIsTogglingActive(false);
    }
  };

  // Reset imgLoaded when asset changes or when there's no preview image
  useEffect(() => {
    if (!previewImageUrl || previewImageUrl === "") {
      setImgLoaded(true); // No image to load, so consider it "loaded"
    } else {
      setImgLoaded(false); // Reset for new image
    }
  }, [previewImageUrl]);

  const handleViewAsset = () => {
    // Preserve current URL parameters (including page number) when navigating to asset detail
    const currentParams = new URLSearchParams(searchParams.toString());
    const assetUrl = `/asset-library/${asset.id}${currentParams.toString() ? `?${currentParams.toString()}` : ""}`;
    router.push(assetUrl);
  };

  return (
    <motion.div
      initial={{ y: 15, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      whileHover={{
        scale: isCompactMode ? 1.01 : 1.02,

        boxShadow: "0 6px 36px rgba(0,0,0,0.08)",
      }}
      className="group"
    >
      <Card
        className={`relative overflow-hidden border border-border/50 transition-all duration-300 shadow-sm ${
          isCompactMode
            ? "flex flex-row h-76 min-w-full"
            : "flex flex-col min-h-[220px] min-w-[220px]"
        } ${
          !isActive ? "bg-gray-50 dark:bg-gray-800/50 opacity-75" : "bg-card"
        }`}
      >
        {/* Selection checkbox */}
        {isBatchEditMode && (
          <div
            className={`absolute z-20 ${
              isCompactMode ? "top-4 left-4" : "top-3 left-3"
            }`}
          >
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelect?.(asset.id);
              }}
              className={`rounded-full transition-all duration-200 border-2 shadow-lg ${
                isSelected
                  ? "bg-primary border-primary text-primary-foreground scale-110"
                  : "bg-white/95 dark:bg-black/90 border-border hover:border-primary hover:bg-primary/10 "
              } ${isCompactMode ? "p-2" : "p-2.5"}`}
              aria-label={isSelected ? "Deselect asset" : "Select asset"}
            >
              <Check
                className={`${isCompactMode ? "h-4 w-4" : "h-5 w-5"} ${isSelected ? "opacity-100" : "opacity-0"}`}
              />
            </button>
          </div>
        )}

        {/* Deactivated badge */}
        {!isActive && (
          <div
            className={`absolute z-20 ${
              isCompactMode ? "top-4 right-4" : "top-3 right-3"
            }`}
          >
            <Badge
              variant="secondary"
              className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            >
              Deactivated
            </Badge>
          </div>
        )}

        {isCompactMode ? (
          // Horizontal layout for compact mode
          <>
            {/* Image section - always reserve space */}
            <div className="flex-shrink-0 w-50 h-60 p-3">
              {previewImageUrl && previewImageUrl !== "" ? (
                <div
                  onClick={handleViewAsset}
                  className="block w-full h-full cursor-pointer"
                >
                  <div className="relative rounded-xl overflow-hidden bg-white dark:bg-black w-full h-full cursor-pointer">
                    <motion.img
                      src={previewImageUrl}
                      alt={asset.product_name}
                      loading="lazy"
                      decoding="async"
                      className={`w-full h-full object-contain transition-transform duration-500 ${
                        imgLoaded ? "scale-100" : "scale-105 blur-sm"
                      }`}
                      onLoad={() => setImgLoaded(true)}
                      draggable={false}
                    />
                  </div>
                </div>
              ) : (
                <div className="w-full h-full bg-muted rounded-xl flex items-center justify-center">
                  <div className="text-center p-4">
                    <div className="text-2xl mb-2">📦</div>
                    <p className="text-xs text-muted-foreground font-medium">
                      {asset.product_name.substring(0, 15)}
                      {asset.product_name.length > 15 ? "..." : ""}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Content section */}
            <div className="flex-1 flex flex-col justify-between p-4 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <CardTitle className="line-clamp-1 font-bold text-lg transition-colors group-hover:text-primary mb-2">
                    {asset.product_name}
                  </CardTitle>

                  {/* Category and Subcategory */}
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        Category:
                      </span>
                      <Badge variant="secondary" className="text-sm">
                        {asset.category}
                      </Badge>
                    </div>
                    {asset.subcategory && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          Type:
                        </span>
                        <Badge variant="outline" className="text-sm">
                          {asset.subcategory}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Materials Section */}
                  {asset.materials && asset.materials.length > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-foreground">
                          Materials:
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {asset.materials?.slice(0, 5).map((m) => (
                          <Badge
                            key={m}
                            variant="secondary"
                            className="text-sm group-hover:bg-primary/10 transition-all"
                          >
                            {m.replace(/[[\]"]/g, "")}
                          </Badge>
                        ))}
                        {asset.materials.length > 5 && (
                          <Badge variant="outline" className="text-sm">
                            +{asset.materials.length - 5} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Colors Section */}
                  {asset.colors && asset.colors.length > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-foreground">
                          Colors:
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {asset.colors?.slice(0, 4).map((c) => (
                          <Badge
                            key={c}
                            variant="outline"
                            className="text-sm group-hover:border-primary/60 transition-all"
                          >
                            {c.replace(/[[\]"]/g, "")}
                          </Badge>
                        ))}
                        {asset.colors.length > 4 && (
                          <Badge variant="outline" className="text-sm">
                            +{asset.colors.length - 4} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Additional Info */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span>ID:</span>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {asset.id.slice(0, 8)}...
                      </code>
                    </div>
                    {asset.glb_link && (
                      <div className="flex items-center gap-1">
                        <span>3D Model:</span>
                        <Badge variant="secondary" className="text-xs">
                          Available
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col items-center gap-3 flex-shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="default"
                        className="group/btn dark:bg-muted dark:text-white  w-24"
                        onClick={handleViewAsset}
                      >
                        View
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>View product details</TooltipContent>
                  </Tooltip>

                  <div className="flex gap-2">
                    {canDownloadGLB && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 hover:bg-muted/70"
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
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Download 3D model</TooltipContent>
                      </Tooltip>
                    )}

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className={`h-9 w-9 transition-all ${
                            isUpdatingChanges ? "opacity-70" : ""
                          } ${
                            isActive
                              ? "bg-green-100 hover:bg-green-200 text-green-700 dark:bg-green-900/30 dark:hover:bg-green-900/50 dark:text-green-400"
                              : "bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400"
                          }`}
                          onClick={handleToggleActive}
                          disabled={
                            isTogglingActive ||
                            (user?.metadata?.role !== "admin" &&
                              isActive &&
                              remainingChanges === 0)
                          }
                        >
                          {isActive ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isUpdatingChanges
                          ? "Updating changes..."
                          : isActive
                            ? remainingChanges === 0
                              ? "Active - No changes remaining to deactivate"
                              : `Active - Click to deactivate (${remainingChanges} changes remaining)`
                            : "Inactive - Click to activate (frees up a change)"}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          // Original vertical layout for grid mode
          <>
            {/* Image section - always reserve space */}
            <CardHeader
              className={`flex-shrink-0 ${isCompactMode ? "p-1" : "p-2"}`}
            >
              {previewImageUrl && previewImageUrl !== "" ? (
                <div
                  onClick={handleViewAsset}
                  className="block w-full h-full cursor-pointer"
                >
                  <div className="relative rounded-xl overflow-hidden bg-white dark:bg-black w-full h-full cursor-pointer">
                    <motion.img
                      src={previewImageUrl}
                      alt={asset.product_name}
                      loading="lazy"
                      decoding="async"
                      className={`w-full object-contain transition-transform duration-500 ${
                        imgLoaded ? "scale-100" : "scale-105 blur-sm"
                      } ${isCompactMode ? "h-24" : "h-36"}`}
                      onLoad={() => setImgLoaded(true)}
                      draggable={false}
                    />
                    {/* Overlay gradient */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      whileHover={{ opacity: 1 }}
                      className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent pointer-events-none"
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              ) : (
                <div
                  className={`w-full bg-muted rounded-xl flex items-center justify-center ${isCompactMode ? "h-24" : "h-36"}`}
                >
                  <div className="text-center p-4">
                    <p className="text-xs text-muted-foreground font-medium">
                      {asset.product_name.substring(0, 20)}
                      {asset.product_name.length > 20 ? "..." : ""}
                    </p>
                  </div>
                </div>
              )}
            </CardHeader>

            <CardContent
              className={`flex-1 flex flex-col justify-between items-center gap-3 ${isCompactMode ? "p-2" : "p-3"}`}
            >
              <div className="w-full">
                <CardTitle
                  className={`line-clamp-1 font-bold text-center mb-2 transition-colors group-hover:text-primary ${
                    isCompactMode ? "text-sm" : "text-base"
                  }`}
                >
                  {asset.product_name}
                </CardTitle>
                {!isCompactMode && (
                  <>
                    <div className="flex flex-wrap justify-center gap-1">
                      {asset.client && (
                        <Badge
                          variant="secondary"
                          className="flex items-center gap-1 text-xs font-medium transition group-hover:bg-primary/10"
                        >
                          {asset.client}
                        </Badge>
                      )}
                    </div>
                  </>
                )}
              </div>
              {/* Actions: Buttons */}
              <div
                className={`flex w-full gap-2 justify-between ${isCompactMode ? "pt-1" : "pt-2"}`}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size={isCompactMode ? "sm" : "sm"}
                      className="flex-1 group/btn dark:bg-muted dark:text-white transition-all "
                      onClick={handleViewAsset}
                    >
                      {isCompactMode ? "View" : "View"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>View product details</TooltipContent>
                </Tooltip>

                {canDownloadGLB && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 hover:bg-muted/70  group/download "
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
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Download 3D model</TooltipContent>
                  </Tooltip>
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className={`h-9 w-9 transition-all ${
                        isUpdatingChanges ? "opacity-70" : ""
                      } ${
                        isActive
                          ? "bg-green-100 hover:bg-green-200 text-green-700 dark:bg-green-900/30 dark:hover:bg-green-900/50 dark:text-green-400"
                          : "bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400"
                      }`}
                      onClick={handleToggleActive}
                      disabled={
                        isTogglingActive ||
                        (user?.metadata?.role !== "admin" &&
                          !isActive &&
                          remainingChanges === 0)
                      }
                    >
                      {isActive ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isUpdatingChanges
                      ? "Updating changes..."
                      : isActive
                        ? remainingChanges === 0
                          ? "Active - No changes remaining to deactivate"
                          : `Active - Click to deactivate (${remainingChanges} changes remaining)`
                        : "Inactive - Click to activate (frees up a change)"}
                  </TooltipContent>
                </Tooltip>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </motion.div>
  );
}
