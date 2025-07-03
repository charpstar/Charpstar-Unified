"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/contexts/useUser";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/display";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/containers";
import { toast } from "@/components/ui/utilities";
import { Paperclip, X, Eye, CheckCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/display";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ReferenceImagesPage() {
  const user = useUser();
  const router = useRouter();
  const [assets, setAssets] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAssetIds, setDialogAssetIds] = useState<string[]>([]);
  const [referenceLink, setReferenceLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewDialogRefs, setViewDialogRefs] = useState<string[]>([]);
  const [viewDialogAssetId, setViewDialogAssetId] = useState<string | null>(
    null
  );
  const [completing, setCompleting] = useState(false);
  const referenceLabels = ["Top", "Front", "Back", "Left Side", "Right Side"];
  const [referenceInputs, setReferenceInputs] = useState(
    referenceLabels.map((label) => ({
      label,
      value: "",
    }))
  );

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
    setReferenceLink("");
    setDialogOpen(true);
  };

  // Save reference link(s) for all filled inputs (add dialog)
  const handleSaveReference = async () => {
    setLoading(true);
    // For each asset, append all non-empty new links to the array (if < 5)
    const updates = dialogAssetIds.map(async (id) => {
      const { data, error } = await supabase
        .from("onboarding_assets")
        .select("reference")
        .eq("id", id)
        .single();
      if (error) return { error };
      const refs = getReferenceArray(data.reference);
      const newLinks = referenceInputs
        .map((input) => input.value.trim())
        .filter(Boolean);
      if (refs.length + newLinks.length > 5)
        return { error: { message: "Max 5 references allowed." } };
      const newRefs = [...refs, ...newLinks].filter(Boolean);
      const result = await supabase
        .from("onboarding_assets")
        .update({ reference: newRefs })
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

  // Delete reference for a single asset at a given index
  const handleDeleteReference = async (assetId: string, refIdx: number) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("onboarding_assets")
      .select("reference")
      .eq("id", assetId)
      .single();
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }
    let refs = getReferenceArray(data.reference);
    // Get the reference to delete
    const refToDelete = refs[refIdx];
    // Remove that specific reference from the array
    refs = refs.filter((ref) => ref !== refToDelete);
    const { error: updateError } = await supabase
      .from("onboarding_assets")
      .update({ reference: refs })
      .eq("id", assetId);
    if (updateError) {
      toast({
        title: "Error",
        description: updateError.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Reference Removed",
        description: "Reference link deleted.",
      });
      // Update local assets state for this asset only
      setAssets((prevAssets) =>
        prevAssets.map((a) =>
          a.id === assetId ? { ...a, reference: refs } : a
        )
      );
    }
    setLoading(false);
  };

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

  // Save all 5 references for the asset
  const handleSaveReferences = async () => {
    setLoading(true);
    const newRefs = referenceInputs.map((i) => i.value.trim()).filter(Boolean);
    await supabase
      .from("onboarding_assets")
      .update({
        reference: newRefs,
      })
      .eq("id", viewDialogAssetId);
    // Refresh assets
    const { data } = await supabase
      .from("onboarding_assets")
      .select("*")
      .eq("client", user?.metadata.client);
    setAssets(data || []);
    setViewDialogOpen(false);
    setLoading(false);
  };

  // Complete reference images step and redirect to dashboard
  const handleCompleteReferenceImages = async () => {
    if (!user) return;

    setCompleting(true);
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

      // Force hard reload when redirecting to dashboard to update onboarding steps
      window.location.href = "/dashboard";
    } catch (error) {
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

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex gap-4 mb-6">
        <Button
          onClick={handleMultiReference}
          disabled={selected.size === 0}
          size="lg"
        >
          + Add Reference To Selection
        </Button>
        <Button onClick={selectAll} variant="outline" size="lg">
          Select All
        </Button>
        <Button onClick={deselectAll} variant="outline" size="lg">
          Deselect All
        </Button>
        <div className="ml-auto">
          <Button
            onClick={handleCompleteReferenceImages}
            loading={completing}
            size="lg"
            className="px-6"
          >
            Done - Complete Reference Images
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto bg-background rounded-2xl shadow-lg p-6">
        {fetching ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="animate-spin h-10 w-10 text-primary" />
          </div>
        ) : assets.length === 0 ? (
          <div className="text-center text-muted-foreground py-16 text-xl">
            No onboarding assets found.
          </div>
        ) : (
          <table className="min-w-full text-base border-separate border-spacing-y-1">
            <thead className="sticky top-0 bg-background z-10 shadow-sm">
              <tr>
                <th className="p-3 text-left">
                  <input
                    type="checkbox"
                    checked={
                      selected.size === assets.length && assets.length > 0
                    }
                    onChange={
                      selected.size === assets.length ? deselectAll : selectAll
                    }
                  />
                </th>
                <th className="p-3 text-left">Article ID</th>
                <th className="p-3 text-left">Product Name</th>
                <th className="p-3 text-left">Product Link</th>

                <th className="p-3 text-left">Category</th>
                <th className="p-3 text-left">Subcategory</th>
                <th className="p-3 text-left">Client</th>
                <th className="p-3 text-center">Reference</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset, idx) => {
                const allReferences = getReferenceArray(asset.reference);
                const filledReferences = allReferences.filter(Boolean);
                return (
                  <tr
                    key={asset.id}
                    className={`transition hover:bg-primary/10 ${idx % 2 === 0 ? "bg-muted/40" : "bg-background"}`}
                    style={{ height: 64 }}
                  >
                    <td className="p-3 align-middle">
                      <input
                        type="checkbox"
                        checked={selected.has(asset.id)}
                        onChange={() => toggleSelect(asset.id)}
                        className="h-5 w-5"
                      />
                    </td>
                    <td className="p-3 align-middle font-semibold">
                      {asset.article_id}
                    </td>
                    <td className="p-3 align-middle">{asset.product_name}</td>
                    <td className="p-3 align-middle">
                      <a
                        href={asset.product_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-blue-600 break-all"
                      >
                        {asset.product_link}
                      </a>
                    </td>

                    <td className="p-3 align-middle">{asset.category}</td>
                    <td className="p-3 align-middle">{asset.subcategory}</td>
                    <td className="p-3 align-middle">{asset.client}</td>
                    <td className="p-3 align-middle text-center">
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        {/* Reference Count Badge */}

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleViewReferences(asset.id)}
                              className="hover:bg-primary/20 rounded-full p-2"
                            >
                              <Eye className="inline h-6 w-6 text-muted-foreground hover:text-primary" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>View References</TooltipContent>
                        </Tooltip>
                        {filledReferences.length < 5 ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => handleSingleReference(asset.id)}
                                className="hover:bg-primary/20 rounded-full p-2"
                              >
                                <Paperclip className="inline h-6 w-6 text-muted-foreground hover:text-primary" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Add Reference</TooltipContent>
                          </Tooltip>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <CheckCircle className="h-6 w-6 text-green-600" />
                            </TooltipTrigger>
                            <TooltipContent>
                              Max 5 references reached
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-muted">
                          <span className="text-muted-foreground">
                            {filledReferences.length}/5
                          </span>
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

      {/* Done Button */}
      <div className="flex justify-center mt-8">
        <Button
          onClick={handleCompleteReferenceImages}
          loading={completing}
          size="lg"
          className="px-8"
        >
          Done - Complete Reference Images
        </Button>
      </div>

      {/* Reference Link Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Reference Links</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {referenceInputs.map((input, idx) => (
              <div key={input.label} className="flex items-center gap-2">
                <label className="w-28 font-medium">{input.label}</label>
                {(() => {
                  // Find the asset being edited
                  const asset = assets.find((a) => a.id === dialogAssetIds[0]);
                  const refs = getReferenceArray(asset?.reference);
                  const currentValue = refs[idx] || "";
                  if (currentValue) {
                    return (
                      <a
                        href={currentValue}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 underline text-blue-600 break-all opacity-70 cursor-not-allowed"
                        tabIndex={-1}
                      >
                        {currentValue}
                      </a>
                    );
                  }
                  return (
                    <input
                      type="url"
                      className="flex-1 border-2 border-primary rounded-lg p-3 text-lg"
                      placeholder={`Paste ${input.label.toLowerCase()} image link...`}
                      value={input.value}
                      onChange={(e) =>
                        setReferenceInputs((inputs) =>
                          inputs.map((inp, i) =>
                            i === idx ? { ...inp, value: e.target.value } : inp
                          )
                        )
                      }
                      disabled={loading}
                    />
                  );
                })()}
              </div>
            ))}
            <div className="flex justify-end gap-4">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={loading}
                size="lg"
              >
                Cancel
              </Button>
              <Button
                variant="default"
                onClick={handleSaveReference}
                loading={loading}
                disabled={referenceInputs.every((inp) => !inp.value.trim())}
                size="lg"
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* View References Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>References</DialogTitle>
          </DialogHeader>
          <ul className="space-y-2">
            {referenceLabels.map((label, idx) => (
              <li key={label} className="flex items-center gap-2">
                <span className="w-28 font-medium">{label}</span>
                {referenceInputs[idx]?.value ? (
                  <>
                    <a
                      href={referenceInputs[idx].value}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-blue-600 break-all flex-1"
                    >
                      {referenceInputs[idx].value}
                    </a>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        // Remove the link for this slot
                        const newInputs = referenceInputs.map((inp, i) =>
                          i === idx ? { ...inp, value: "" } : inp
                        );
                        setReferenceInputs(newInputs);
                        setLoading(true);

                        // Filter out empty strings when saving to database
                        const filteredRefs = newInputs
                          .map((i) => i.value.trim())
                          .filter(Boolean);

                        await supabase
                          .from("onboarding_assets")
                          .update({ reference: filteredRefs })
                          .eq("id", viewDialogAssetId);

                        // Refresh assets to update the UI
                        const { data } = await supabase
                          .from("onboarding_assets")
                          .select("*")
                          .eq("client", user?.metadata.client);
                        setAssets(data || []);

                        setLoading(false);
                      }}
                    >
                      <X className="h-4 w-4 text-red-500" />
                    </Button>
                  </>
                ) : (
                  <span className="text-muted-foreground flex-1">—</span>
                )}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
