"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import {
  Bot,
  Camera,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  X,
  Play,
  Sparkles,
  Upload,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import ScreenshotCapture from "./ScreenshotCapture";
import QAResults from "./QAResults";

interface QAWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  glbUrl: string;
  assetId: string;
  referenceImages: string[];
  modelViewerRef: React.RefObject<any>;
  onComplete?: (results: any) => void;
  autoStart?: boolean;
  onReferenceImagesUpdate?: (newImages: string[]) => void;
  clientName?: string;
}

type QAState = "idle" | "capturing" | "analyzing" | "complete" | "error";

const QAWorkflowModal: React.FC<QAWorkflowModalProps> = ({
  isOpen,
  onClose,
  glbUrl,
  assetId,
  referenceImages,
  modelViewerRef,
  onComplete,
  autoStart = false,
  onReferenceImagesUpdate,
  clientName,
}) => {
  const [qaState, setQaState] = useState<QAState>("idle");
  const [qaJobId, setQaJobId] = useState<string | null>(null);
  const [qaResults, setQaResults] = useState<any>(null);
  const [uploadingReferences, setUploadingReferences] = useState(false);
  const [currentReferenceImages, setCurrentReferenceImages] = useState<string[]>(referenceImages);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const previousGlbUrlRef = React.useRef<string>(glbUrl);

  // Reset QA state when modal closes or GLB URL changes (new model uploaded)
  React.useEffect(() => {
    if (!isOpen) {
      // Reset when modal closes
      setQaState("idle");
      setQaJobId(null);
      setQaResults(null);
    }
  }, [isOpen]);

  // Reset QA state when GLB URL changes (new model uploaded)
  React.useEffect(() => {
    if (glbUrl !== previousGlbUrlRef.current) {
      // GLB URL changed - reset all QA state for new model
      setQaState("idle");
      setQaJobId(null);
      setQaResults(null);
      previousGlbUrlRef.current = glbUrl;
    }
  }, [glbUrl]);

  // Update local state when referenceImages prop changes
  React.useEffect(() => {
    setCurrentReferenceImages(referenceImages);
  }, [referenceImages]);

  const handleUploadReferenceImages = async (files: FileList) => {
    if (!files || files.length === 0) return;

    setUploadingReferences(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        // Check if file is an image
        if (!file.type.startsWith("image/")) {
          throw new Error(`${file.name} is not an image file`);
        }

        // Always use direct upload for reference images (handles both small and large files)
        // This automatically saves to the database via upload-large-file API
        const { DirectFileUploader } = await import("@/lib/directUpload");
        const uploader = new DirectFileUploader();
        const result = await uploader.uploadFile(
          file,
          assetId,
          "reference",
          clientName
        );

        if (!result.success) {
          throw new Error(result.error || "Upload failed");
        }

        return result.cdnUrl || "";
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      const newReferenceImages = [...currentReferenceImages, ...uploadedUrls];
      
      setCurrentReferenceImages(newReferenceImages);
      
      // Notify parent component to update reference images
      if (onReferenceImagesUpdate) {
        onReferenceImagesUpdate(newReferenceImages);
      }

      toast.success(`${uploadedUrls.length} reference image(s) uploaded successfully!`);
    } catch (error) {
      console.error("Error uploading reference images:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload reference images");
    } finally {
      setUploadingReferences(false);
    }
  };

  const startQA = async () => {
    if (!glbUrl) {
      toast.error("No GLB file available for QA analysis");
      return;
    }

    if (currentReferenceImages.length === 0) {
      toast.error("Please upload at least one reference image before starting QA");
      return;
    }

    setQaState("capturing");
    setQaJobId(null);
    setQaResults(null);

    try {
      // The ScreenshotCapture component will handle the actual capture
      // and trigger the analysis
    } catch (error) {
      console.error("Error starting QA:", error);
      toast.error("Failed to start QA analysis");
      setQaState("error");
    }
  };

  // Auto-start QA when modal opens and autoStart is true
  React.useEffect(() => {
    console.log("🎯 QA Modal auto-start check:", {
      isOpen,
      autoStart,
      qaState,
      hasGlbUrl: !!glbUrl,
      referenceImagesCount: currentReferenceImages.length,
    });

    if (isOpen && autoStart && qaState === "idle" && glbUrl && currentReferenceImages.length > 0) {
      console.log("✅ QA Modal: All conditions met, starting QA...");
      // Small delay to ensure modal is fully rendered
      const timer = setTimeout(() => {
        console.log("🚀 QA Modal: Calling startQA()");
        startQA();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoStart, qaState, glbUrl, currentReferenceImages.length]);

  const handleScreenshotsCaptured = async (
    screenshots: string[],
    stats: any,
    failedResult?: any
  ) => {
    // If there's a failed result from validation, handle it immediately
    if (failedResult) {
      setQaState("complete");
      setQaResults(failedResult);
      // Don't call onComplete immediately - let user see results first
      return;
    }

    setQaState("analyzing");

    try {
      const requestBody = {
        renders: screenshots,
        references: currentReferenceImages,
        modelStats: stats,
      };

      const response = await fetch("/api/qa-jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("QA job error response:", errorText);
        throw new Error(`Failed to submit QA job: ${response.statusText}`);
      }

      const result = await response.json();
      setQaJobId(result.jobId);

      // Poll for completion
      pollForCompletion(result.jobId);
    } catch (error) {
      console.error("Error starting QA analysis:", error);
      toast.error("Failed to submit QA job");
      setQaState("error");
    }
  };

  const pollForCompletion = async (jobId: string) => {
    const maxAttempts = 60; // 5 minutes max
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/qa-jobs?jobId=${jobId}`);
        const result = await response.json();

        if (result.status === "complete") {
          setQaState("complete");
          setQaResults(result.qaResults);
          // Don't call onComplete immediately - let user see results first
        } else if (result.status === "failed") {
          setQaState("error");
          toast.error("QA analysis failed");
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 5000); // Poll every 5 seconds
        } else {
          setQaState("error");
          toast.error("QA analysis timed out");
        }
      } catch (error) {
        console.error("Error polling QA status:", error);
        setQaState("error");
      }
    };

    poll();
  };

  const resetQA = () => {
    setQaState("idle");
    setQaJobId(null);
  };

  const getStateIcon = () => {
    switch (qaState) {
      case "idle":
        return <Play className="h-5 w-5" />;
      case "capturing":
        return <Camera className="h-5 w-5 animate-pulse" />;
      case "analyzing":
        return <Bot className="h-5 w-5 animate-spin" />;
      case "complete":
        return <CheckCircle className="h-5 w-5 text-gray-600" />;
      case "error":
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default:
        return <Play className="h-5 w-5" />;
    }
  };

  const getStateColor = () => {
    switch (qaState) {
      case "idle":
        return "bg-gray-100 text-gray-800 border-gray-200";
      case "capturing":
        return "bg-gray-100 text-gray-800 border-gray-200";
      case "analyzing":
        return "bg-gray-100 text-gray-800 border-gray-200";
      case "complete":
        return "bg-gray-100 text-gray-800 border-gray-200";
      case "error":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStateText = () => {
    switch (qaState) {
      case "idle":
        return "Ready to Start";
      case "capturing":
        return "Capturing Screenshots";
      case "analyzing":
        return "AI Analysis in Progress";
      case "complete":
        return "Analysis Complete";
      case "error":
        return "Analysis Failed";
      default:
        return "Unknown State";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full max-h-[85vh] overflow-hidden">
        <DialogHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Bot className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">
                  Automated QA Analysis
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  AI-powered quality assurance for your 3D model
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={`${getStateColor()} border`}>
                {getStateIcon()}
                <span className="ml-2">{getStateText()}</span>
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {qaState === "idle" && (
            <div className="space-y-6">
              {/* Hero Section */}
              <div className="text-center py-8 bg-gray-50 rounded-xl">
                <div className="p-3 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-gray-600" />
                </div>
                <h2 className="text-2xl font-bold mb-2">
                  Ready for QA Analysis
                </h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Our AI will capture screenshots from multiple angles and
                  compare them against your reference images to ensure quality.
                </p>
              </div>

              {/* Reference Images Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Reference Images</h3>
                  <span className="text-sm text-muted-foreground">
                    {currentReferenceImages.length} image{currentReferenceImages.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {currentReferenceImages.length === 0 ? (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 bg-gray-50">
                    <div className="text-center space-y-4">
                      <ImageIcon className="h-12 w-12 text-gray-400 mx-auto" />
                      <div>
                        <h4 className="text-base font-semibold mb-2">
                          No Reference Images Found
                        </h4>
                        <p className="text-sm text-muted-foreground mb-4">
                          Upload reference images to compare against your 3D model
                        </p>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files) {
                            handleUploadReferenceImages(e.target.files);
                          }
                        }}
                      />
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingReferences}
                        variant="outline"
                        className="w-full"
                      >
                        {uploadingReferences ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Reference Images
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Display uploaded reference images */}
                    <div className="grid grid-cols-3 gap-3">
                      {currentReferenceImages.map((url, index) => (
                        <div
                          key={index}
                          className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-100"
                        >
                          <Image
                            src={url}
                            alt={`Reference ${index + 1}`}
                            width={200}
                            height={200}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                    {/* Add more button */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files) {
                          handleUploadReferenceImages(e.target.files);
                        }
                      }}
                    />
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingReferences}
                      variant="outline"
                      className="w-full"
                    >
                      {uploadingReferences ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Add More Reference Images
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="text-center space-y-4">
                <Button
                  onClick={startQA}
                  className="h-12 px-8 text-lg"
                  size="lg"
                  disabled={currentReferenceImages.length === 0 || uploadingReferences}
                >
                  <Play className="h-5 w-5 mr-2" />
                  Start QA Analysis
                </Button>

                <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${currentReferenceImages.length > 0 ? "bg-gray-400" : "bg-red-500"}`}></div>
                    <span>Reference Images: {currentReferenceImages.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${glbUrl ? "bg-gray-400" : "bg-red-500"}`}
                    ></div>
                    <span>Model: {glbUrl ? "Loaded" : "Not Available"}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {qaState === "capturing" && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <h3 className="text-lg font-semibold mb-2">
                  Capturing Screenshots
                </h3>
                <p className="text-muted-foreground">
                  Positioning camera and capturing from multiple angles...
                </p>
              </div>
              <ScreenshotCapture
                glbUrl={glbUrl}
                assetId={assetId}
                modelViewerRef={modelViewerRef}
                onScreenshotsCaptured={handleScreenshotsCaptured}
              />
            </div>
          )}

          {(qaState === "analyzing" ||
            qaState === "complete" ||
            qaState === "error") &&
            qaJobId && (
              <div className="space-y-4">
                <div className="text-center py-4">
                  <h3 className="text-lg font-semibold mb-2">
                    {qaState === "analyzing"
                      ? "AI Analysis in Progress"
                      : qaState === "complete"
                        ? "Analysis Complete"
                        : "Analysis Failed"}
                  </h3>
                  {qaState === "analyzing" && (
                    <p className="text-muted-foreground">
                      Comparing screenshots against reference images...
                    </p>
                  )}
                </div>
                <QAResults jobId={qaJobId} />

                {/* Action buttons for completed analysis */}
                {qaState === "complete" && qaResults && (
                  <div className="flex gap-3 justify-center pt-4 border-t">
                    {qaResults.status === "Approved" ? (
                      <Button
                        onClick={() => {
                          if (onComplete) {
                            onComplete(qaResults);
                          }
                          onClose();
                        }}
                        className="flex items-center gap-2"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Close & Deliver Model
                      </Button>
                    ) : (
                      <Button
                        onClick={onClose}
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <X className="h-4 w-4" />
                        Close
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

          {qaState === "error" && !qaJobId && (
            <div className="text-center py-12">
              <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Analysis Failed</h3>
              <p className="text-muted-foreground mb-6">
                Something went wrong during the QA analysis. Please try again.
              </p>
              <Button onClick={resetQA} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Asset ID: {assetId} | Reference Images: {currentReferenceImages.length}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QAWorkflowModal;
