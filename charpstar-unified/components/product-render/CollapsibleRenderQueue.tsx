"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/display";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
  Download,
  ChevronLeft,
  ChevronRight,
  Save,
} from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";

interface QueueItemMeta {
  jobId: string;
  client: string;
  modelName?: string;
  variantName?: string | null;
  view?: { name: string };
  views?: Array<{ name: string }>;
  background?: string;
  resolution?: number;
  format?: string;
  createdAt: string;
  status?:
    | "queued"
    | "running"
    | "pending"
    | "completed"
    | "failed"
    | "unknown";
  sourceGlbUrl?: string | null;
}

interface CombinedStatusResponse {
  stage?: "preparing" | "rendering";
  status?:
    | "queued"
    | "running"
    | "pending"
    | "completed"
    | "failed"
    | "unknown";
  progress?: number;
  queuePosition?: number;
  imageUrl?: string;
  imageUrls?: string[];
  images?: Array<{ url: string; view: string; format: string }>;
  error?: string;
}

const CollapsibleRenderQueue: React.FC<{ clientName: string }> = ({
  clientName,
}) => {
  const [items, setItems] = useState<QueueItemMeta[]>([]);
  const [statuses, setStatuses] = useState<
    Record<string, CombinedStatusResponse>
  >({});
  const [prevStatuses, setPrevStatuses] = useState<
    Record<string, CombinedStatusResponse>
  >({});
  const [totalActiveCount, setTotalActiveCount] = useState(0);
  const [queuedCount, setQueuedCount] = useState(0);
  const timerRef = useRef<any>(null);
  const [visible, setVisible] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{
    url: string;
    view?: string;
    resolution?: number;
    format?: string;
    filename?: string;
  } | null>(null);
  const [selectedImageGroup, setSelectedImageGroup] = useState<
    Array<{
      url: string;
      view?: string;
      resolution?: number;
      format?: string;
      filename?: string;
    }>
  >([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [currentJobMeta, setCurrentJobMeta] = useState<QueueItemMeta | null>(
    null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  // Format view names for display
  const formatViewName = (view?: string): string => {
    if (!view) return "Render";
    const viewMap: Record<string, string> = {
      default: "Ang Right",
      angledright: "Ang Right",
      angledleft: "Ang Left",
      front: "Front",
      back: "Back",
      side: "Side",
      top: "Top",
      table: "Table",
    };
    return viewMap[view.toLowerCase()] || view;
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(
          `/api/render/jobs/list?client=${encodeURIComponent(clientName)}`,
          { cache: "no-store" }
        );
        const json = await res.json().catch(() => ({}));
        const arr = Array.isArray(json?.items) ? (json.items as any[]) : [];
        setItems(arr);
        setStatuses(
          arr.reduce((acc: any, it: any) => {
            acc[it.jobId] = it;
            return acc;
          }, {})
        );
        setTotalActiveCount(
          typeof json?.activeCount === "number" ? json.activeCount : 0
        );
        setQueuedCount(
          typeof json?.queuedCount === "number" ? json.queuedCount : 0
        );
        if (arr.length > 0) setVisible(true);
      } catch {}
    };
    load();
  }, [clientName]);

  // Immediate refresh when tab becomes visible again
  useEffect(() => {
    const onVisibilityChange = async () => {
      try {
        if (typeof document !== "undefined" && !(document as any).hidden) {
          const res = await fetch(
            `/api/render/jobs/list?client=${encodeURIComponent(clientName)}`,
            { cache: "no-store" }
          );
          const json = await res.json().catch(() => ({}));
          const arr = Array.isArray(json?.items) ? (json.items as any[]) : [];
          setTotalActiveCount(
            typeof json?.activeCount === "number" ? json.activeCount : 0
          );
          setQueuedCount(
            typeof json?.queuedCount === "number" ? json.queuedCount : 0
          );
          setItems(arr);
          const next: Record<string, CombinedStatusResponse> = {};
          for (const it of arr) next[it.jobId] = it;
          setPrevStatuses(next);
          setStatuses(next);
          setVisible(
            arr.length > 0 ||
              (typeof json?.activeCount === "number" && json.activeCount > 0)
          );
        }
      } catch {}
    };
    try {
      document.addEventListener("visibilitychange", onVisibilityChange);
    } catch {}
    return () => {
      try {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      } catch {}
    };
  }, [clientName]);

  useEffect(() => {
    const onStarted = (e: Event) => {
      setVisible(true);
      setIsCollapsed(false);

      // Clear old status for this job to start fresh at 0%
      const detail = (e as CustomEvent).detail;
      if (detail?.jobId) {
        setStatuses((prev) => {
          const next = { ...prev };
          delete next[detail.jobId]; // Remove old cached progress
          return next;
        });
      }
    };
    try {
      window.addEventListener(
        "charpstar:renderJobStarted",
        onStarted as EventListener
      );
    } catch {}
    return () => {
      try {
        window.removeEventListener(
          "charpstar:renderJobStarted",
          onStarted as EventListener
        );
      } catch {}
    };
  }, [clientName]);

  // Handle keyboard navigation in modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isModalOpen) return;

      if (event.key === "Escape") {
        setIsModalOpen(false);
      } else if (event.key === "ArrowLeft") {
        // Navigate to previous image
        setSelectedImageIndex((prev) => {
          const newIndex = prev > 0 ? prev - 1 : selectedImageGroup.length - 1;
          setSelectedImage(selectedImageGroup[newIndex] || null);
          return newIndex;
        });
      } else if (event.key === "ArrowRight") {
        // Navigate to next image
        setSelectedImageIndex((prev) => {
          const newIndex = prev < selectedImageGroup.length - 1 ? prev + 1 : 0;
          setSelectedImage(selectedImageGroup[newIndex] || null);
          return newIndex;
        });
      }
    };

    if (isModalOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isModalOpen, selectedImageGroup]);

  // Handle image download
  const handleDownloadImage = async () => {
    if (!selectedImage) return;

    try {
      const response = await fetch(selectedImage.url);
      if (!response.ok) {
        throw new Error("Failed to fetch image");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download =
        selectedImage.filename ||
        `render-${Date.now()}.${selectedImage.format || "png"}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(url);

      toast.success("Image downloaded successfully!");
    } catch (error) {
      console.error("Error downloading image:", error);
      toast.error("Failed to download image");
    }
  };

  // Navigate to previous image
  const handlePrevImage = () => {
    setSelectedImageIndex((prev) => {
      const newIndex = prev > 0 ? prev - 1 : selectedImageGroup.length - 1;
      setSelectedImage(selectedImageGroup[newIndex] || null);
      return newIndex;
    });
  };

  // Navigate to next image
  const handleNextImage = () => {
    setSelectedImageIndex((prev) => {
      const newIndex = prev < selectedImageGroup.length - 1 ? prev + 1 : 0;
      setSelectedImage(selectedImageGroup[newIndex] || null);
      return newIndex;
    });
  };

  // Download all renders for a specific job and save to library
  const handleDownloadJobRenders = async (
    job: QueueItemMeta,
    images: Array<{
      url: string;
      view?: string;
      format?: string;
      filename?: string;
      resolution?: number;
    }>
  ) => {
    if (images.length === 0) {
      toast.error("No renders to download");
      return;
    }

    setIsDownloadingAll(true);
    try {
      // First, download all images
      for (const img of images) {
        try {
          const response = await fetch(img.url);
          if (!response.ok) continue;

          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download =
            img.filename ||
            `${job.modelName || "render"}_${img.view || "default"}_${job.resolution || 1024}px.${img.format || job.format || "png"}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);

          // Small delay between downloads
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Error downloading ${img.url}:`, error);
        }
      }

      // Then, save all images to library
      const supabase = createClient();

      let sourceAssetId = null;
      let sourceAssetData = null;

      if (job.sourceGlbUrl) {
        const { data: assetDataArray } = await supabase
          .from("assets")
          .select("id, article_id, product_name")
          .eq("glb_link", job.sourceGlbUrl)
          .limit(1);

        if (assetDataArray && assetDataArray.length > 0) {
          sourceAssetId = assetDataArray[0].id;
          sourceAssetData = assetDataArray[0];
        }
      }

      if (!sourceAssetId && job.modelName) {
        const { data: assetDataArray } = await supabase
          .from("assets")
          .select("id, article_id, product_name")
          .eq("article_id", job.modelName)
          .limit(1);

        if (assetDataArray && assetDataArray.length > 0) {
          sourceAssetId = assetDataArray[0].id;
          sourceAssetData = assetDataArray[0];
        }
      }

      if (sourceAssetId) {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;

        if (token) {
          let savedCount = 0;

          // Save each render
          for (const img of images) {
            try {
              const response = await fetch("/api/assets/save-packshot", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  product_name:
                    sourceAssetData?.product_name || job.modelName || "Product",
                  description: `Packshot render - ${img.view || "default"} view`,
                  image_url: img.url,
                  sourceModelId: sourceAssetId,
                  sourceModelUrl: job.sourceGlbUrl,
                  client: job.client || clientName,
                  render_settings: {
                    view: img.view,
                    resolution: img.resolution || job.resolution,
                    background: job.background,
                    format: img.format || job.format,
                    variantName: job.variantName,
                  },
                }),
              });

              if (response.ok) {
                savedCount++;
              }
            } catch (error) {
              console.error("Error saving packshot:", error);
            }
          }

          if (savedCount > 0) {
            try {
              window.dispatchEvent(new CustomEvent("charpstar:packshotSaved"));
            } catch {}
          }
        }
      }

      toast.success(
        `Downloaded and saved ${images.length} render(s) to asset library`
      );
    } catch (error) {
      console.error("Error downloading renders:", error);
      toast.error("Failed to download some renders");
    } finally {
      setIsDownloadingAll(false);
    }
  };

  // Save packshot to library
  const handleSaveToLibrary = async () => {
    if (!selectedImage || !currentJobMeta) {
      toast.error("Unable to save: missing image or job information");
      return;
    }

    setIsSaving(true);

    try {
      const supabase = createClient();

      // First, try to find the source asset by GLB URL if available
      let sourceAssetId = null;
      let sourceAssetData = null;

      if (currentJobMeta.sourceGlbUrl) {
        const { data: assetDataArray } = await supabase
          .from("assets")
          .select("id, article_id, product_name")
          .eq("glb_link", currentJobMeta.sourceGlbUrl)
          .limit(1);

        if (assetDataArray && assetDataArray.length > 0) {
          sourceAssetId = assetDataArray[0].id;
          sourceAssetData = assetDataArray[0];
        }
      }

      // If we didn't find by GLB URL, try by model name (article_id)
      if (!sourceAssetId && currentJobMeta.modelName) {
        const { data: assetDataArray } = await supabase
          .from("assets")
          .select("id, article_id, product_name")
          .eq("article_id", currentJobMeta.modelName)
          .limit(1);

        if (assetDataArray && assetDataArray.length > 0) {
          sourceAssetId = assetDataArray[0].id;
          sourceAssetData = assetDataArray[0];
        }
      }

      if (!sourceAssetId) {
        toast.error("Unable to find source asset. Cannot save packshot.");
        return;
      }

      // Get auth session
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        toast.error("You must be logged in to save packshots");
        return;
      }

      // Save the packshot
      const response = await fetch("/api/assets/save-packshot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          product_name:
            sourceAssetData?.product_name ||
            currentJobMeta.modelName ||
            "Product",
          description: `Packshot render - ${selectedImage.view || "default"} view`,
          image_url: selectedImage.url,
          sourceModelId: sourceAssetId,
          sourceModelUrl: currentJobMeta.sourceGlbUrl,
          client: currentJobMeta.client || clientName,
          render_settings: {
            view: selectedImage.view,
            resolution: selectedImage.resolution,
            background: currentJobMeta.background,
            format: selectedImage.format,
            variantName: currentJobMeta.variantName,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save packshot");
      }

      toast.success("Packshot saved to library!");

      // Dispatch event to refresh the packshots section
      try {
        window.dispatchEvent(new CustomEvent("charpstar:packshotSaved"));
      } catch {}
    } catch (error) {
      console.error("Error saving packshot:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save packshot"
      );
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    let localPrevStatuses = prevStatuses;

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/render/jobs/list?client=${encodeURIComponent(clientName)}`,
          { cache: "no-store" }
        );
        const json = await res.json().catch(() => ({}));
        const arr = Array.isArray(json?.items) ? (json.items as any[]) : [];

        setTotalActiveCount(
          typeof json?.activeCount === "number" ? json.activeCount : 0
        );
        setQueuedCount(
          typeof json?.queuedCount === "number" ? json.queuedCount : 0
        );

        setItems(arr);

        const next: Record<string, CombinedStatusResponse> = {};
        for (const it of arr) next[it.jobId] = it;

        for (const jobId of Object.keys(next)) {
          const prevStatus = localPrevStatuses[jobId];
          const currentStatus = next[jobId];
          if (
            currentStatus?.status === "completed" &&
            prevStatus?.status !== "completed"
          ) {
            try {
              window.dispatchEvent(
                new CustomEvent("charpstar:renderCompleted", {
                  detail: { jobId },
                })
              );
            } catch {}
          }
          if (
            currentStatus?.status === "completed" &&
            prevStatus?.status !== "completed"
          ) {
            try {
              window.dispatchEvent(
                new CustomEvent("charpstar:renderFinished", {
                  detail: { jobId, status: "completed" },
                })
              );
            } catch {}
          }
          if (
            currentStatus?.status === "failed" &&
            prevStatus?.status !== "failed"
          ) {
            try {
              window.dispatchEvent(
                new CustomEvent("charpstar:renderFinished", {
                  detail: {
                    jobId,
                    status: "failed",
                    error: currentStatus?.error,
                  },
                })
              );
            } catch {}
          }
        }

        localPrevStatuses = next;
        setPrevStatuses(next);
        setStatuses(next);
        setVisible(
          (prev) =>
            prev ||
            arr.length > 0 ||
            (typeof json?.activeCount === "number" && json.activeCount > 0)
        );
      } catch {}
    };
    poll();

    timerRef.current = setInterval(poll, 5000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [clientName]);

  const clearFinished = async () => {
    if (isClearing) return;
    try {
      setIsClearing(true);
      // Optimistic: remove completed/failed immediately
      setItems((prev) =>
        prev.filter((it) => {
          const st = statuses[it.jobId]?.status;
          return st !== "completed" && st !== "failed";
        })
      );
      setStatuses((prev) => {
        const next: typeof prev = {};
        for (const [k, v] of Object.entries(prev)) {
          if (v?.status !== "completed" && v?.status !== "failed") next[k] = v;
        }
        return next;
      });
      await fetch("/api/render/jobs/clear-finished", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client: clientName }),
      });
      const res = await fetch(
        `/api/render/jobs/list?client=${encodeURIComponent(clientName)}`,
        { cache: "no-store" }
      );
      const json = await res.json().catch(() => ({}));
      const arr = Array.isArray(json?.items) ? (json.items as any[]) : [];
      setItems(arr);
      setStatuses(
        arr.reduce((acc: any, it: any) => {
          acc[it.jobId] = it;
          return acc;
        }, {})
      );
      setTotalActiveCount(
        typeof json?.activeCount === "number" ? json.activeCount : 0
      );
      setQueuedCount(
        typeof json?.queuedCount === "number" ? json.queuedCount : 0
      );
      setVisible(
        arr.length > 0 ||
          (typeof json?.activeCount === "number" && json.activeCount > 0)
      );
    } catch {
    } finally {
      setIsClearing(false);
    }
  };

  if (!visible) return null;

  const displayText =
    totalActiveCount > 0
      ? queuedCount > 0
        ? `${totalActiveCount} in queue (tracking ${totalActiveCount - queuedCount})`
        : `${totalActiveCount} in queue`
      : "No jobs in queue";

  return (
    <div
      className="fixed bottom-4 right-4 w-[360px] bg-white border border-gray-300 rounded-t-lg shadow-2xl z-40"
      style={{ maxHeight: "45vh" }}
    >
      <div
        className="flex items-center justify-between px-4 py-2.5 bg-black text-white cursor-pointer rounded-t-lg"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center space-x-2">
          <div className="relative">
            {totalActiveCount > 0 && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-white text-black text-[9px] font-bold rounded-full flex items-center justify-center">
                {totalActiveCount > 99 ? "99+" : totalActiveCount}
              </div>
            )}
            <Loader2
              className={`w-4 h-4 ${totalActiveCount > 0 ? "animate-spin" : ""}`}
            />
          </div>
          <div>
            <div className="text-xs font-semibold">Render Queue</div>
            <div className="text-[10px] opacity-75">{displayText}</div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] text-white hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation();
              clearFinished();
            }}
          >
            <Trash2 className="w-3 h-3 mr-1" /> Clear
          </Button>
          {isCollapsed ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </div>
      </div>

      {!isCollapsed && (
        <div className="max-h-[calc(45vh-55px)] overflow-auto p-2 space-y-1.5">
          {items.map((it, idx) => {
            const st = statuses[it.jobId] || {};
            const combinedPct = (() => {
              const cp = (st as any)?.combinedProgress;
              if (typeof cp === "number") return Math.max(0, Math.min(100, cp));
              return 0;
            })();
            const effectiveQueuePos = (() => {
              const qp = (st as any)?.queuePosition;
              if (typeof qp === "number" && qp > 0) return qp;
              return undefined;
            })();
            const isDone = st.status === "completed" || st.status === "failed";
            const isQueued = st.status === "queued" || st.status === "pending";
            const stageLabel =
              st.stage === "preparing"
                ? "Preparing"
                : st.stage === "rendering"
                  ? "Rendering"
                  : String((st as any).stage) === "queued"
                    ? "Queued"
                    : undefined;

            return (
              <div
                key={`${it.jobId}-${idx}`}
                className="p-2 rounded bg-gray-50 border border-gray-200"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="text-[13px] font-medium text-gray-900 truncate flex-1">
                    {it.modelName || "Model"}{" "}
                    {it.variantName ? `(${it.variantName})` : ""}
                    {!isDone && stageLabel && (
                      <span className="text-[10px] text-gray-500 font-normal">
                        {" "}
                        •{" "}
                        {`${stageLabel}${isQueued ? (effectiveQueuePos ? ` #${effectiveQueuePos}` : "") : ` ${combinedPct}%`}`}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center flex-shrink-0">
                    {st.status === "completed" ? (
                      <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                    ) : st.status === "failed" ? (
                      <XCircle className="w-3.5 h-3.5 text-red-500" />
                    ) : (
                      <Loader2 className="w-3.5 h-3.5 text-black animate-spin" />
                    )}
                  </div>
                </div>
                <div className="mt-0.5 text-[10px] text-gray-500">
                  {(() => {
                    const bg =
                      it.background === "transparent"
                        ? "Transparent"
                        : `#${it.background}`;
                    const fmt = it.format ? it.format.toUpperCase() : "PNG";
                    return `${bg} • ${it.resolution}px • ${fmt}`;
                  })()}
                </div>
                {!isDone && (
                  <div className="mt-1.5">
                    <div className="w-full bg-gray-200 rounded-full h-0.5 overflow-hidden">
                      <div
                        className="bg-black h-0.5 transition-all duration-300"
                        style={{ width: `${combinedPct}%` }}
                      />
                    </div>
                  </div>
                )}
                {st.status === "failed" && st.error && (
                  <div
                    className="mt-1 text-[10px] text-red-600 truncate"
                    title={st.error as any}
                  >
                    {st.error}
                  </div>
                )}
                {(() => {
                  const isCompleted = st.status === "completed";
                  const isRendering =
                    st.status === "running" || st.status === "pending";

                  const images: Array<{
                    url: string;
                    view?: string;
                    format?: string;
                  }> =
                    isCompleted && (st as any)
                      ? Array.isArray((st as any).images)
                        ? (st as any).images
                        : Array.isArray((st as any).imageUrls)
                          ? (st as any).imageUrls.map((url: string) => ({
                              url,
                            }))
                          : typeof (st as any).imageUrl === "string"
                            ? [{ url: (st as any).imageUrl }]
                            : []
                      : [];

                  const viewsArray = it.views || (it.view ? [it.view] : []);
                  const showPlaceholders = isRendering && viewsArray.length > 0;

                  if (images.length > 0 || showPlaceholders) {
                    return (
                      <>
                        <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                          {isCompleted &&
                            images.slice(0, 8).map((img, i) => {
                              const thumbnailUrl = img.url.includes("?")
                                ? `${img.url}&width=80&height=80`
                                : `${img.url}?width=80&height=80`;
                              return (
                                <div
                                  key={`${it.jobId}-img-${i}`}
                                  className="group relative"
                                >
                                  <button
                                    onClick={() => {
                                      const imageGroup = images.map((img) => ({
                                        url: img.url,
                                        view: img.view,
                                        resolution: it.resolution,
                                        format: img.format,
                                        filename: `render-${img.view || "image"}-${it.resolution}px.${img.format || "png"}`,
                                      }));
                                      const imageIndex = images.findIndex(
                                        (imgItem) => imgItem.url === img.url
                                      );
                                      setSelectedImageGroup(imageGroup);
                                      setSelectedImageIndex(imageIndex);
                                      setSelectedImage({
                                        url: img.url,
                                        view: img.view,
                                        resolution: it.resolution,
                                        format: img.format,
                                      });
                                      setCurrentJobMeta(it);
                                      setIsModalOpen(true);
                                    }}
                                    className="block cursor-zoom-in"
                                    title="Click to view fullscreen"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={thumbnailUrl}
                                      alt={`${img.view || "render"} thumbnail`}
                                      width={40}
                                      height={40}
                                      className="w-[40px] h-[40px] object-cover rounded border border-gray-300 hover:border-black hover:scale-105 transition-all"
                                      loading="lazy"
                                    />
                                  </button>
                                  {img.view && (
                                    <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 px-0.5 py-0.5 bg-black text-white text-[8px] font-medium rounded whitespace-nowrap leading-none">
                                      {formatViewName(img.view)}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          {showPlaceholders &&
                            viewsArray.map((view, i) => (
                              <div
                                key={`${it.jobId}-placeholder-${i}`}
                                className="relative"
                              >
                                <div className="w-[40px] h-[40px] rounded border border-dashed border-gray-300 bg-white flex items-center justify-center">
                                  <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />
                                </div>
                                <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 px-0.5 py-0.5 bg-gray-700 text-white text-[8px] font-medium rounded whitespace-nowrap leading-none">
                                  {view.name}
                                </div>
                              </div>
                            ))}
                        </div>
                        {/* Show download/save button for completed renders */}
                        {isCompleted && images.length > 0 && (
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-[10px]"
                              onClick={(e) => {
                                e.stopPropagation();
                                const imageArray = images.map((img) => ({
                                  url: img.url,
                                  view: img.view,
                                  resolution: it.resolution,
                                  format: img.format || it.format,
                                  filename: `${it.modelName || "render"}_${img.view || "default"}_${it.resolution || 1024}px.${img.format || it.format || "png"}`,
                                }));
                                handleDownloadJobRenders(it, imageArray);
                              }}
                              disabled={isDownloadingAll}
                            >
                              <Download className="w-3 h-3 mr-1" />
                              {isDownloadingAll
                                ? "Downloading & Saving..."
                                : "Download All"}
                            </Button>
                          </div>
                        )}
                      </>
                    );
                  }
                  return null;
                })()}
              </div>
            );
          })}
        </div>
      )}

      {/* Fullscreen Image Modal */}
      {isModalOpen && selectedImage && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4"
          onClick={() => setIsModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <button
            onClick={() => setIsModalOpen(false)}
            className="absolute top-4 right-4 text-white text-4xl hover:text-gray-300 transition-colors z-10"
            aria-label="Close fullscreen view"
          >
            &times;
          </button>

          {/* Navigation arrows - only show if there are multiple images */}
          {selectedImageGroup.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevImage();
                }}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 sm:p-3 rounded-full transition-all z-10"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-6 w-6 sm:h-8 sm:w-8" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextImage();
                }}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 sm:p-3 rounded-full transition-all z-10"
                aria-label="Next image"
              >
                <ChevronRight className="h-6 w-6 sm:h-8 sm:w-8" />
              </button>
            </>
          )}

          <div
            className="relative max-w-[90vw] max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={selectedImage.url}
              alt={`${formatViewName(selectedImage.view)} preview`}
              className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
              width={selectedImage.resolution || 2048}
              height={selectedImage.resolution || 2048}
              unoptimized
            />

            {/* Image counter - show current position */}
            {selectedImageGroup.length > 1 && (
              <div className="absolute top-2 sm:top-4 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-xs sm:text-sm">
                {selectedImageIndex + 1} / {selectedImageGroup.length}
              </div>
            )}

            <div className="absolute bottom-2 sm:bottom-4 left-1/2 transform -translate-x-1/2 flex gap-1 sm:gap-2">
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSaveToLibrary();
                }}
                disabled={isSaving}
                className="bg-green-600 hover:bg-green-700 text-white shadow-lg text-xs sm:text-sm"
                size="sm"
              >
                <Save className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                {isSaving ? "Saving..." : "Save to Library"}
              </Button>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadImage();
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg text-xs sm:text-sm"
                size="sm"
              >
                <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Download
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollapsibleRenderQueue;
