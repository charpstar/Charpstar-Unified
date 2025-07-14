"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/contexts/useUser";
import { useLoading } from "@/contexts/LoadingContext";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/display";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/containers";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Badge, Alert, AlertDescription } from "@/components/ui/feedback";
import { toast } from "@/components/ui/utilities";
import {
  Paperclip,
  X,
  Eye,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Target,
  Image,
  Plus,
  Trophy,
  Star,
  Camera,
  Layers,
  Save,
  Upload,
  File,
  FileText,
  FileImage,
  FileArchive,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/display";
import { Loader2 } from "lucide-react";

import { Input } from "@/components/ui";
import { useRouter } from "next/navigation";

export default function ReferenceImagesPage() {
  const user = useUser();
  const { startLoading } = useLoading();
  const router = useRouter();

  const [assets, setAssets] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAssetIds, setDialogAssetIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewDialogAssetId, setViewDialogAssetId] = useState<string | null>(
    null
  );
  const [completing, setCompleting] = useState(false);
  const [showCompletionAnimation, setShowCompletionAnimation] = useState(false);
  const referenceLabels = ["Top", "Front", "Back", "Left Side", "Right Side"];
  const [referenceInputs, setReferenceInputs] = useState(
    referenceLabels.map((label) => ({
      label,
      value: "",
    }))
  );
  const [uploadingFiles, setUploadingFiles] = useState<{
    [key: string]: boolean;
  }>({});
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Fetch assets for this client
  useEffect(() => {
    const fetchAssets = async () => {
      if (!user?.metadata?.client) return;
      setFetching(true);
      const { data, error } = await supabase
        .from("onboarding_assets")
        .select("*")
        .eq("client", user.metadata.client);
      if (error)
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      else setAssets(data || []);
      setFetching(false);
    };
    fetchAssets();
  }, [user]);

  // Helper to always get references as an array
  function getReferenceArray(ref: string | string[] | undefined): string[] {
    if (Array.isArray(ref)) return ref;
    if (typeof ref === "string" && ref.startsWith("[")) {
      try {
        return JSON.parse(ref);
      } catch {
        return [];
      }
    }
    return ref ? [ref] : [];
  }

  // Handle single asset reference
  const handleSingleReference = (assetId: string) => {
    setDialogAssetIds([assetId]);
    setReferenceInputs(
      referenceLabels.map((label) => ({
        label,
        value: "",
      }))
    );
    setDialogOpen(true);
  };

  // Handle multi asset reference
  const handleMultiReference = () => {
    setDialogAssetIds(Array.from(selected));
    setDialogOpen(true);
  };

  // Save reference link(s) for all filled inputs (add dialog)
  const handleSaveReference = async () => {
    setLoading(true);
    // For each asset, maintain the order of references based on their position
    const updates = dialogAssetIds.map(async (id) => {
      const { error } = await supabase
        .from("onboarding_assets")
        .select("reference")
        .eq("id", id)
        .single();
      if (error) return { error };

      // Create a new array that maintains the order of references
      const newRefs: string[] = [];
      referenceInputs.forEach((input, index) => {
        newRefs[index] = input.value.trim();
      });

      // Ensure we don't exceed 5 references and maintain position
      const finalRefs = newRefs.slice(0, 5);
      if (finalRefs.filter(Boolean).length > 5) {
        return { error: { message: "Max 5 references allowed." } };
      }

      const result = await supabase
        .from("onboarding_assets")
        .update({ reference: finalRefs })
        .eq("id", id);

      // Always fetch the latest asset data for the view dialog if open
      if (viewDialogOpen && viewDialogAssetId === id) {
        const { data: updatedAsset } = await supabase
          .from("onboarding_assets")
          .select("reference")
          .eq("id", id)
          .single();
        const updatedRefs = getReferenceArray(updatedAsset?.reference);
        setReferenceInputs(
          referenceLabels.map((label, idx) => ({
            label,
            value: updatedRefs[idx] || "",
          }))
        );
      }
      return result;
    });
    const results = await Promise.all(updates);
    const hasError = results.some((r) => r.error);
    if (hasError) {
      toast({
        title: "Error",
        description:
          "Failed to update some assets or max 5 references reached.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Reference Added",
        description: "Reference link(s) saved.",
      });
      // Refresh assets
      const { data } = await supabase
        .from("onboarding_assets")
        .select("*")
        .eq("client", user?.metadata.client);
      setAssets(data || []);
      setSelected(new Set());
    }
    setDialogOpen(false);
    setLoading(false);
  };

  // Toggle selection
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Select all
  const selectAll = () => {
    setSelected(new Set(assets.map((a) => a.id)));
  };
  const deselectAll = () => setSelected(new Set());

  // Open view dialog for references
  const handleViewReferences = (assetId: string) => {
    const asset = assets.find((a) => a.id === assetId);
    const refs = getReferenceArray(asset?.reference);
    setReferenceInputs(
      referenceLabels.map((label, idx) => ({
        label,
        value: refs[idx] || "",
      }))
    );
    setViewDialogAssetId(assetId);
    setViewDialogOpen(true);
  };

  // File upload functions
  const handleFileUpload = async (file: File, index: number) => {
    if (!user?.metadata?.client) return;

    const fileId = `${index}_${Date.now()}`;
    setUploadingFiles((prev) => ({ ...prev, [fileId]: true }));

    try {
      // Upload file to Supabase Storage
      const fileName = `reference-files/${user.metadata.client}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("assets")
        .upload(fileName, file);

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("assets")
        .getPublicUrl(fileName);

      // Update the reference input with the file URL
      setReferenceInputs((prev) =>
        prev.map((input, i) =>
          i === index ? { ...input, value: urlData.publicUrl } : input
        )
      );

      toast({
        title: "File uploaded successfully",
        description: `${file.name} has been uploaded.`,
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingFiles((prev) => ({ ...prev, [fileId]: false }));
    }
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(null);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0], index);
    }
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverIndex(null);
  };

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFileUpload(files[0], index);
    }
    e.target.value = ""; // Reset input
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "")) {
      return <FileImage className="h-4 w-4" />;
    } else if (["pdf"].includes(ext || "")) {
      return <FileText className="h-4 w-4" />;
    } else if (["zip", "rar", "7z"].includes(ext || "")) {
      return <FileArchive className="h-4 w-4" />;
    } else if (["glb", "gltf", "obj", "fbx", "stl"].includes(ext || "")) {
      return <File className="h-4 w-4" />;
    }
    return <File className="h-4 w-4" />;
  };

  // Complete reference images step and redirect to dashboard
  const handleCompleteReferenceImages = async () => {
    if (!user) return;

    setCompleting(true);
    setShowCompletionAnimation(true);

    try {
      // Update user's onboarding progress using the proper API endpoint
      const response = await fetch("/api/users/complete-reference-images", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        toast({
          title: "Error",
          description:
            errorData.error || "Failed to update progress. Please try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Reference Images Complete!",
        description: "You've successfully completed the reference images step.",
      });

      // Wait for animation, then redirect with page reload to refresh user metadata
      setTimeout(() => {
        startLoading(); // Start loading before redirect
        router.push("/dashboard?refreshUser=1");
      }, 2000);
    } catch {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCompleting(false);
    }
  };

  if (!user) {
    return null;
  }

  // Calculate progress
  const totalAssets = assets.length;
  const assetsWithReferences = assets.filter((asset) => {
    const refs = getReferenceArray(asset.reference);
    return refs.length > 0;
  }).length;
  const progressPercentage =
    totalAssets > 0 ? (assetsWithReferences / totalAssets) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Completion Animation Overlay */}
      {showCompletionAnimation && (
        <div className="fixed inset-0 bg-gradient-to-b from-transparent to-background/80 z-50 flex items-center justify-center">
          <div className="text-center space-y-6">
            <div className="relative">
              <div className="h-24 w-24 mx-auto rounded-full bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center shadow-lg">
                <Trophy className="h-12 w-12 text-white" />
              </div>
              <Sparkles className="h-8 w-8 text-yellow-500 absolute -top-3 -right-3 animate-pulse" />
              <Sparkles className="h-6 w-6 text-yellow-500 absolute -bottom-2 -left-2 animate-pulse delay-300" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-foreground mb-2">
                Reference Images Complete! 🎉
              </h3>
              <p className="text-muted-foreground">
                Redirecting to onboarding dashboard...
              </p>
            </div>
          </div>
        </div>
      )}

      <div className=" mx-auto p-6 space-y-8">
        {/* Enhanced Header */}
        <Card className="relative overflow-hidden bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-primary/20">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent" />
          <CardContent className="relative pt-8 pb-8">
            <div className="text-center space-y-6">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center">
                  <Image className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  Reference Images Upload
                </h1>
              </div>

              <p className="max-w-7xl text-lg text-muted-foreground mx-auto leading-relaxed">
                <strong>
                  Reference images are optional but highly recommended!
                </strong>{" "}
                Adding reference images from different angles helps our 3D
                modelers understand your requirements and creates much better
                results. You can skip this step if needed, but it significantly
                improves the quality of your 3D models.
              </p>

              {/* Progress Overview */}
              <div className="flex items-center justify-center gap-6 mt-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Target className="h-4 w-4" />
                  <span>{totalAssets} products</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4" />
                  <span>{assetsWithReferences} with references</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Camera className="h-4 w-4" />
                  <span
                    className={`font-medium ${
                      progressPercentage === 0
                        ? "text-gray-500"
                        : progressPercentage < 25
                          ? "text-red-600"
                          : progressPercentage < 50
                            ? "text-yellow-600"
                            : progressPercentage < 75
                              ? "text-yellow-600"
                              : "text-green-600"
                    }`}
                  >
                    {Math.round(progressPercentage)}% complete
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Progress Bar */}
        <Card className="bg-gradient-to-r from-background to-muted/20 border-primary/10">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Overall Progress</span>
                <span className="text-sm text-muted-foreground">
                  {assetsWithReferences} of {totalAssets} products have
                  references
                </span>
              </div>
              <Alert>
                <AlertDescription>
                  💡 <strong>Tip:</strong> Reference images are optional but
                  highly recommended. They help our 3D modelers create much
                  better results. You can complete this step even with 0%
                  progress if needed.
                </AlertDescription>
              </Alert>
              <div className="relative">
                <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-3 rounded-full transition-all duration-700 ease-out ${
                      progressPercentage === 0
                        ? "bg-gray-400"
                        : progressPercentage < 25
                          ? "bg-gradient-to-r from-red-500 to-red-600"
                          : progressPercentage < 50
                            ? "bg-gradient-to-r from-yellow-500 to-yellow-600"
                            : progressPercentage < 75
                              ? "bg-gradient-to-r from-yellow-500 to-green-500"
                              : "bg-gradient-to-r from-green-500 to-green-600"
                    }`}
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                {progressPercentage > 0 && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <Button
            onClick={handleMultiReference}
            disabled={selected.size === 0}
            size="lg"
            className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add References ({selected.size})
          </Button>

          <Button
            onClick={handleCompleteReferenceImages}
            loading={completing}
            size="lg"
            className="gap-2 px-8 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg cursor-pointer"
          >
            {completing ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Completing...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                Complete Reference Images
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>

        {/* Enhanced Assets Table */}
        <Card className="bg-gradient-to-r from-background to-muted/20 border-primary/10 overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Product Assets ({totalAssets})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {fetching ? (
                <div className="flex justify-center items-center h-64">
                  <div className="text-center space-y-4">
                    <Loader2 className="animate-spin h-12 w-12 text-primary mx-auto" />
                    <p className="text-muted-foreground">
                      Loading your products...
                    </p>
                  </div>
                </div>
              ) : assets.length === 0 ? (
                <div className="text-center py-16 space-y-4">
                  <div className="h-16 w-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                    <Image className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      No products found
                    </h3>
                    <p className="text-muted-foreground">
                      Upload your CSV file first to see products here.
                    </p>
                  </div>
                </div>
              ) : (
                <table className="min-w-full text-base ">
                  <thead className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 border-b border-border">
                    <tr>
                      <th className="p-4 text-left">
                        <input
                          type="checkbox"
                          checked={
                            selected.size === assets.length && assets.length > 0
                          }
                          onChange={
                            selected.size === assets.length
                              ? deselectAll
                              : selectAll
                          }
                          className="h-4 w-4 cursor-pointer"
                        />
                      </th>
                      <th className="p-4 text-left font-semibold">
                        Article ID
                      </th>
                      <th className="p-4 text-left font-semibold">
                        Product Name
                      </th>
                      <th className="p-4 text-left font-semibold">
                        Product Link
                      </th>
                      <th className="p-4 text-left font-semibold">Category</th>
                      <th className="p-4 text-left font-semibold">
                        Subcategory
                      </th>
                      <th className="p-4 text-center font-semibold">
                        References
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border  text-sm text-muted-foreground overflow-scroll">
                    {assets.map((asset) => {
                      const allReferences = getReferenceArray(asset.reference);
                      const filledReferences = allReferences.filter(Boolean);
                      const hasReferences = filledReferences.length > 0;

                      return (
                        <tr
                          key={asset.id}
                          className={`transition-all duration-200 hover:bg-primary/5 ${
                            selected.has(asset.id) ? "bg-primary/10" : ""
                          }`}
                        >
                          <td className="p-4 align-middle">
                            <input
                              type="checkbox"
                              checked={selected.has(asset.id)}
                              onChange={() => toggleSelect(asset.id)}
                              className="h-4 w-4 cursor-pointer"
                            />
                          </td>
                          <td className="p-4 align-middle">
                            <Badge variant="outline" className="font-mono">
                              {asset.article_id}
                            </Badge>
                          </td>
                          <td className="p-4 align-middle font-medium">
                            {asset.product_name}
                          </td>
                          <td className="p-4 align-middle">
                            <a
                              href={asset.product_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-700 underline break-all text-sm cursor-pointer"
                            >
                              {asset.product_link}
                            </a>
                          </td>
                          <td className="p-4 align-middle">
                            <Badge variant="secondary" className="text-xs">
                              {asset.category}
                            </Badge>
                          </td>
                          <td className="p-4 align-middle">
                            <Badge variant="outline" className="text-xs">
                              {asset.subcategory}
                            </Badge>
                          </td>
                          <td className="p-4 align-middle">
                            <div className="flex items-center justify-center gap-3">
                              {/* Reference Status */}
                              <div className="flex items-center gap-2">
                                {hasReferences ? (
                                  <div className="flex items-center gap-1">
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                    <span className="text-xs text-green-600 font-medium">
                                      {filledReferences.length}/5
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <Star className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">
                                      0/5
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        handleViewReferences(asset.id)
                                      }
                                      className="h-8 w-8 p-0 hover:bg-primary/10 cursor-pointer"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    View References
                                  </TooltipContent>
                                </Tooltip>

                                {filledReferences.length < 5 ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          handleSingleReference(asset.id)
                                        }
                                        className="h-8 w-8 p-0 hover:bg-primary/10 cursor-pointer"
                                      >
                                        <Paperclip className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Add Reference
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="h-8 w-8 flex items-center justify-center">
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Max references reached
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bottom Completion Button */}
        {assets.length > 10 && (
          <div className="flex justify-center">
            <Button
              onClick={handleCompleteReferenceImages}
              loading={completing}
              size="lg"
              className="gap-2 px-8 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg cursor-pointer"
            >
              {completing ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Completing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Complete Reference Images
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        )}

        {/* Enhanced Reference Link Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Image className="h-5 w-5 text-primary" />
                Add Reference Files
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm text-muted-foreground">
                  <strong>Optional but highly recommended:</strong> Add
                  reference files from different angles. Supports images, PDFs,
                  3D files, and archives.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {referenceInputs.map((input, idx) => {
                  // Custom ordering: Front (span 2), then Back, Left, Right, Top
                  const orderMap = {
                    Front: 0,
                    Back: 1,
                    Left: 2,
                    Right: 3,
                    Top: 5,
                  };
                  const order =
                    orderMap[input.label as keyof typeof orderMap] || 0;

                  return (
                    <div
                      key={input.label}
                      className={`border border-border rounded-lg p-4 space-y-3 ${
                        input.label === "Front" ? "md:col-span-2" : ""
                      }`}
                      style={{ order: order }}
                    >
                      <div className="flex items-center gap-2">
                        <Camera className="h-4 w-4 text-primary" />
                        <label className="text-sm font-medium">
                          {input.label} View
                        </label>
                      </div>

                      {(() => {
                        // Find the asset being edited
                        const asset = assets.find(
                          (a) => a.id === dialogAssetIds[0]
                        );
                        const refs = getReferenceArray(asset?.reference);
                        const currentValue = refs[idx] || input.value;

                        if (currentValue) {
                          return (
                            <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-md">
                              <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                              <a
                                href={currentValue}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-700 underline break-all text-xs cursor-pointer"
                              >
                                {currentValue.includes("/")
                                  ? currentValue.split("/").pop() ||
                                    currentValue
                                  : currentValue}
                              </a>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-3">
                            {/* URL Input */}
                            <Input
                              type="url"
                              className="border border-primary/20 focus:border-primary rounded-md p-2 text-sm"
                              placeholder={`Paste ${input.label.toLowerCase()} URL...`}
                              value={input.value}
                              onChange={(e) =>
                                setReferenceInputs((inputs) =>
                                  inputs.map((inp, i) =>
                                    i === idx
                                      ? { ...inp, value: e.target.value }
                                      : inp
                                  )
                                )
                              }
                              disabled={loading}
                            />

                            {/* Divider */}
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-px bg-border"></div>
                              <span className="text-xs text-muted-foreground">
                                OR
                              </span>
                              <div className="flex-1 h-px bg-border"></div>
                            </div>

                            {/* Drag & Drop Zone */}
                            <div
                              className={`relative border-2 border-dashed rounded-md p-4 text-center transition-all duration-200 ${
                                dragOverIndex === idx
                                  ? "border-primary bg-primary/10 scale-105"
                                  : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30"
                              }`}
                              onDrop={(e) => handleDrop(e, idx)}
                              onDragOver={(e) => handleDragOver(e, idx)}
                              onDragLeave={handleDragLeave}
                            >
                              <input
                                type="file"
                                id={`file-input-${idx}`}
                                className="hidden"
                                accept="image/*,.pdf,.zip,.rar,.7z,.glb,.gltf,.obj,.fbx,.stl"
                                onChange={(e) => handleFileSelect(e, idx)}
                                disabled={loading}
                              />

                              {uploadingFiles[`${idx}_${Date.now()}`] ? (
                                <div className="space-y-2">
                                  <div className="h-6 w-6 mx-auto border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                                  <p className="text-xs text-muted-foreground">
                                    Uploading...
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
                                  <div>
                                    <p className="text-xs font-medium">
                                      Drop files here
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      or click to browse
                                    </p>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      document
                                        .getElementById(`file-input-${idx}`)
                                        ?.click()
                                    }
                                    className="cursor-pointer text-xs h-7 px-2"
                                  >
                                    Browse
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={loading}
                  size="sm"
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  onClick={handleSaveReference}
                  loading={loading}
                  disabled={referenceInputs.every((inp) => !inp.value.trim())}
                  size="sm"
                  className="gap-2 cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  Save References
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Enhanced View References Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-3xl h-fit">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Eye className="h-5 w-5 text-primary" />
                Reference Images
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-4">
                {referenceLabels.map((label, idx) => (
                  <div
                    key={label}
                    className="flex items-center gap-4 p-4 border border-border rounded-lg"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Camera className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="font-medium text-sm">{label}</span>
                    </div>

                    {referenceInputs[idx]?.value ? (
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-1">
                          {getFileIcon(referenceInputs[idx].value)}
                          <a
                            href={referenceInputs[idx].value}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 underline break-all text-sm cursor-pointer"
                          >
                            {referenceInputs[idx].value.includes("/")
                              ? referenceInputs[idx].value.split("/").pop() ||
                                referenceInputs[idx].value
                              : referenceInputs[idx].value}
                          </a>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            const newInputs = referenceInputs.map((inp, i) =>
                              i === idx ? { ...inp, value: "" } : inp
                            );
                            setReferenceInputs(newInputs);
                            setLoading(true);

                            const filteredRefs = newInputs
                              .map((i) => i.value.trim())
                              .filter(Boolean);

                            await supabase
                              .from("onboarding_assets")
                              .update({ reference: filteredRefs })
                              .eq("id", viewDialogAssetId);

                            const { data } = await supabase
                              .from("onboarding_assets")
                              .select("*")
                              .eq("client", user?.metadata.client);
                            setAssets(data || []);

                            setLoading(false);
                          }}
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm flex-1">
                        No reference added
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
