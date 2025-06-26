import React, { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/display";
import { Input } from "@/components/ui/inputs";
import { toast } from "@/components/ui/utilities";
import { useUser } from "@/contexts/useUser";
import { createClient } from "@/utils/supabase/client";
import {
  Upload,
  Plus,
  Trash2,
  FileSpreadsheet,
  AlertCircle,
  Loader2,
  Image,
  Info,
  Camera,
  CheckCircle,
} from "lucide-react";
import { debounce } from "lodash";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/display";
import { ActivityLogger } from "@/lib/activityLogger";

interface AssetRow {
  product_name: string;
  product_link: string;
  glb_link: string;
  glb_file?: File | null;
  category: string;
  subcategory: string;
  client: string;
  materials: string;
  colors: string;
  tags: string;
  article_id: string;
  preview_image?: string | File | null;
  id: string;
  created_at?: string;
  errors?: {
    [K in EditableField]?: string;
  };
}

interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateType?: "article_id" | "product_name" | "both";
  existingAsset?: {
    id: string;
    product_name: string;
    article_id: string;
    client: string;
  };
}

const emptyRow = (): AssetRow => ({
  product_name: "",
  product_link: "",
  glb_link: "",
  category: "",
  subcategory: "",
  client: "",
  materials: "",
  colors: "",
  tags: "",
  article_id: "",
  preview_image: null,
  id: Math.random().toString(36).slice(2),
  created_at: new Date().toISOString(),
  errors: {},
});

const requiredFields: EditableField[] = [
  "article_id",
  "product_name",
  "product_link",
  "glb_link",
  "category",
  "subcategory",
  "client",
];

type EditableField =
  | "product_name"
  | "product_link"
  | "glb_link"
  | "glb_file"
  | "category"
  | "subcategory"
  | "client"
  | "materials"
  | "colors"
  | "tags"
  | "article_id"
  | "preview_image";

const editableFields: EditableField[] = [
  "product_name",
  "product_link",
  "glb_link",
  "category",
  "subcategory",
  "client",
  "materials",
  "colors",
  "tags",
  "article_id",
];

const checkDuplicates = async (
  rows: AssetRow[],
  client: string | null | undefined
): Promise<DuplicateCheckResult[]> => {
  const results: DuplicateCheckResult[] = [];

  for (const row of rows) {
    if (!row.product_name && !row.article_id) continue;

    const { data: existingAssets } = await createClient()
      .from("assets")
      .select("id, product_name, article_id, client")
      .eq("client", client || "")
      .or(
        row.article_id && row.product_name
          ? `and(article_id.eq.${row.article_id},product_name.ilike.${row.product_name}),or(article_id.eq.${row.article_id},product_name.ilike.${row.product_name})`
          : row.article_id
            ? `article_id.eq.${row.article_id}`
            : `product_name.ilike.${row.product_name}`
      );

    if (existingAssets && existingAssets.length > 0) {
      const existing = existingAssets[0];
      let duplicateType: "article_id" | "product_name" | "both" = "both";

      if (row.article_id && !row.product_name) {
        duplicateType = "article_id";
      } else if (!row.article_id && row.product_name) {
        duplicateType = "product_name";
      } else if (row.article_id && row.product_name) {
        const articleIdMatch = existing.article_id === row.article_id;
        const productNameMatch =
          existing.product_name.toLowerCase() ===
          row.product_name.toLowerCase();
        if (articleIdMatch && !productNameMatch) {
          duplicateType = "article_id";
        } else if (!articleIdMatch && productNameMatch) {
          duplicateType = "product_name";
        }
      }

      results.push({
        isDuplicate: true,
        duplicateType,
        existingAsset: existing,
      });
    } else {
      results.push({
        isDuplicate: false,
      });
    }
  }

  return results;
};

export function BatchUploadSheet({ onSuccess }: { onSuccess?: () => void }) {
  const [rows, setRows] = useState<AssetRow[]>([emptyRow()]);
  const [loading] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [duplicates, setDuplicates] = useState<{
    [key: string]: "article_id" | "product_name" | "both";
  }>({});
  const [showInfo, setShowInfo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);
  const user = useUser();
  const [generatingPreview, setGeneratingPreview] = useState<number | null>(
    null
  );
  const modelViewerRef = useRef<any>(null);
  const [modelViewerLoaded, setModelViewerLoaded] = useState(false);
  const [modelViewerKey, setModelViewerKey] = useState(0);
  const [previewQueue, setPreviewQueue] = useState<number[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [previewGenerated, setPreviewGenerated] = useState<{
    [rowIdx: number]: boolean;
  }>({});

  const cellRefs = useRef<(HTMLInputElement | null)[][]>([]);

  const focusCell = (rowIdx: number, colIdx: number) => {
    const cell = cellRefs.current[rowIdx]?.[colIdx];
    if (cell) cell.focus();
  };

  const handleKeyDown = (
    e: React.KeyboardEvent,
    rowIdx: number,
    colIdx: number
  ) => {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      if (cellRefs.current[rowIdx]?.[colIdx + 1]) {
        focusCell(rowIdx, colIdx + 1);
      } else if (cellRefs.current[rowIdx + 1]?.[0]) {
        focusCell(rowIdx + 1, 0);
      }
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleCSVFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleCSVFile = (file: File) => {
    setCsvLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length < 1) {
        setCsvLoading(false);
        return;
      }
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const newRows: AssetRow[] = lines.slice(1).map((line) => {
        const values = line.split(",");
        const obj: any = {};
        headers.forEach((h, i) => {
          obj[h] = values[i] || "";
        });
        return {
          product_name: obj["product name"] || "",
          product_link: obj["product link"] || "",
          glb_link: obj["glb link"] || "",
          category: obj["category"] || "",
          subcategory: obj["subcategory"] || "",
          client: obj["client"] || "",
          materials: obj["materials"] || "",
          colors: obj["colors"] || "",
          tags: obj["tags"] || "",
          article_id: obj["article id"] || "",
          preview_image: null,
          id: Math.random().toString(36).slice(2),
          created_at: new Date().toISOString(),
          errors: {},
        };
      });
      setRows((prev) => [...prev, ...newRows]);
      toast({ title: `Imported ${newRows.length} rows from CSV` });
      setCsvLoading(false);
    };
    reader.onerror = () => {
      toast({
        title: "Error",
        description: "Failed to read CSV file",
        variant: "destructive",
      });
      setCsvLoading(false);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleCSVFile(file);
  };

  const handleChange = (idx: number, field: EditableField, value: string) => {
    setRows((prev) => {
      const copy = [...prev];
      if (field === "preview_image" || field === "glb_file") {
        // Skip these fields as they are handled separately
        return copy;
      }
      copy[idx][field] = value;

      if (!copy[idx].errors) {
        copy[idx].errors = {};
      }

      if (editableFields.includes(field)) {
        delete copy[idx].errors![field];
      }

      if (requiredFields.includes(field)) {
        if (!value || value.trim() === "") {
          copy[idx].errors![field] = "Required";
        }
      }

      return copy;
    });
  };

  const handleFileChange = (idx: number, file: File | null) => {
    if (!file) {
      setRows((prev) => {
        const copy = [...prev];
        copy[idx].preview_image = null;
        return copy;
      });
      return;
    }
    // Upload to Bunny CDN
    const formData = new FormData();
    formData.append("file", file);
    formData.append("fileName", file.name);
    console.log("Uploading manual preview image to Bunny CDN:", file.name);
    fetch("/api/upload", {
      method: "POST",
      body: formData,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to upload preview image");
        const { url } = await response.json();
        setRows((prev) => {
          const copy = [...prev];
          copy[idx].preview_image = url;
          return copy;
        });
        console.log("Manual preview image uploaded to Bunny CDN:", url);
      })
      .catch((error) => {
        console.error("Manual preview image upload error:", error);
      });
  };

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB limit

  const handleGLBFileChange = (idx: number, file: File | null) => {
    if (file && file.size > MAX_FILE_SIZE) {
      toast({
        title: "File too large",
        description:
          "Maximum file size is 50MB. Please compress your file or use a smaller one.",
        variant: "destructive",
      });
      return;
    }
    setRows((prev) => {
      const copy = [...prev];
      copy[idx].glb_file = file;
      return copy;
    });
  };

  const handleAddRow = () => {
    const lastRow = rows[rows.length - 1];
    const newRow = emptyRow();
    if (lastRow) {
      newRow.client = lastRow.client;
    }
    setRows((prev) => [...prev, newRow]);
  };
  const handleRemoveRow = (idx: number) =>
    setRows((prev) => prev.filter((_, i) => i !== idx));

  const handleRemoveDuplicateRows = () => {
    setRows((prev) => prev.filter((row) => !duplicates[row.id]));
    setDuplicates({});
  };

  const validateRow = (row: AssetRow) => {
    const errors: AssetRow["errors"] = {};

    requiredFields.forEach((field) => {
      const value = row[field];
      if (!value || (typeof value === "string" && value.trim() === "")) {
        errors[field] = "Required";
      }
    });

    return errors;
  };

  React.useEffect(() => {
    if (user?.metadata?.client) {
      const clientValue = user.metadata.client;
      setRows((prev) =>
        prev.map((row) => ({
          ...row,
          client: clientValue,
        }))
      );
    }
  }, [user]);

  useEffect(() => {
    const debouncedCheck = debounce(async () => {
      if (rows.length === 0) return;

      const rowsToCheck = rows.filter(
        (row) => row.product_name.trim() || row.article_id.trim()
      );
      if (rowsToCheck.length === 0) return;

      setCheckingDuplicates(true);
      try {
        const results = await checkDuplicates(
          rowsToCheck,
          user?.metadata?.client
        );
        const duplicateMap: {
          [key: string]: "article_id" | "product_name" | "both";
        } = {};
        results.forEach((result, index) => {
          if (result.isDuplicate && result.duplicateType) {
            duplicateMap[rowsToCheck[index].id] = result.duplicateType;
          }
        });
        setDuplicates(duplicateMap);
      } catch (error) {
        console.error("Error checking duplicates:", error);
        toast({
          title: "Error",
          description: "Failed to check for duplicates",
          variant: "destructive",
        });
      } finally {
        setCheckingDuplicates(false);
      }
    }, 1000);

    debouncedCheck();
    return () => debouncedCheck.cancel();
  }, [rows, user?.metadata?.client]);

  const handleUploadAll = async () => {
    try {
      const supabase = createClient();
      const results = [];
      console.log("Starting batch asset upload. Rows:", rows.length);
      for (const row of rows) {
        console.log("Processing row:", row);
        if (!row.product_name || !row.category || !row.client) {
          console.log("Skipping row - missing required fields:", row);
          continue;
        }
        let glb_url = row.glb_link;
        let zip_url = null;
        let preview_image_url = row.preview_image;
        // Handle 3D file upload (GLB files)
        if (row.glb_file) {
          console.log("Uploading 3D file:", row.glb_file.name);
          try {
            const fileExtension = row.glb_file.name
              .split(".")
              .pop()
              ?.toLowerCase();
            let contentType;
            switch (fileExtension) {
              case "glb":
                contentType = "model/gltf-binary";
                break;
              case "obj":
                contentType = "text/plain";
                break;
              case "zip":
                contentType = "application/zip";
                break;
              default:
                throw new Error(
                  `Unsupported file type "${fileExtension}". Only .glb, .obj, and .zip are allowed.`
                );
            }
            const fileBuffer = await row.glb_file.arrayBuffer();
            const fileName = `${row.article_id}_${Date.now()}.${fileExtension}`;
            const filePath = `models/${fileName}`;
            console.log("Uploading 3D file to Supabase Storage:", filePath);
            const { error: uploadError } = await supabase.storage
              .from("assets")
              .upload(filePath, fileBuffer, {
                contentType,
                cacheControl: "3600",
                upsert: false,
              });
            if (uploadError) {
              console.error("Upload error:", uploadError);
              throw uploadError;
            }
            const { data: urlData } = supabase.storage
              .from("assets")
              .getPublicUrl(filePath);
            if (fileExtension === "zip") {
              zip_url = urlData.publicUrl;
            } else if (!glb_url) {
              glb_url = urlData.publicUrl;
            }
            console.log("3D file uploaded. Public URL:", urlData.publicUrl);
          } catch (error) {
            console.error("Error uploading 3D file:", error);
            toast({
              title: "Error",
              description: `Failed to upload 3D file: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
              variant: "destructive",
            });
            continue;
          }
        }
        // Handle preview image upload (should already be a URL)
        if (preview_image_url && typeof preview_image_url !== "string") {
          console.log(
            "Uploading preview image file to Bunny CDN:",
            preview_image_url.name
          );
          const formData = new FormData();
          formData.append("file", preview_image_url);
          formData.append("fileName", preview_image_url.name);
          const response = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });
          if (!response.ok) {
            console.error("Preview image upload error:", response.statusText);
            toast({
              title: "Error",
              description: "Failed to upload preview image",
              variant: "destructive",
            });
            continue;
          }
          const { url } = await response.json();
          preview_image_url = url;
          console.log("Preview image uploaded to Bunny CDN. URL:", url);
        }
        console.log("Inserting asset into database:", {
          product_name: row.product_name,
          category: row.category,
          client: row.client,
          article_id: row.article_id,
          glb_url,
          zip_url,
          preview_image_url,
        });
        const { data, error } = await supabase
          .from("assets")
          .insert([
            {
              product_name: row.product_name,
              product_link: row.product_link,
              glb_link: glb_url,
              category: row.category,
              subcategory: row.subcategory,
              client: row.client,
              materials: row.materials
                ? row.materials.split(",").map((m) => m.trim())
                : [],
              colors: row.colors
                ? row.colors.split(",").map((c) => c.trim())
                : [],
              tags: row.tags ? row.tags.split(",").map((t) => t.trim()) : [],
              article_id: row.article_id,
              preview_image:
                typeof preview_image_url === "string"
                  ? preview_image_url
                  : null,
              created_at: row.created_at || new Date().toISOString(),
            },
          ])
          .select()
          .single();
        if (error) {
          console.error("Database error:", error);
          throw error;
        }
        console.log("Successfully inserted row:", data);

        // Log the asset upload activity
        await ActivityLogger.assetUploaded(row.product_name, data.id);

        results.push(data);
      }
      if (results.length === 0) {
        toast({
          title: "No assets uploaded",
          description:
            "Please check that you have filled in all required fields",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Success",
        description: `Successfully uploaded ${results.length} assets`,
      });
      setRows([]);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    }
  };

  const errorCount = rows.reduce(
    (count, row) => count + (row.errors ? Object.keys(row.errors).length : 0),
    0
  );
  const validRows = rows.filter((row) => {
    const errors = validateRow(row);
    return Object.keys(errors).length === 0;
  }).length;

  const columns = [
    { key: "article_id", label: "Article ID", required: true, width: "120px" },
    {
      key: "product_name",
      label: "Product Name",
      required: true,
      width: "150px",
    },
    {
      key: "product_link",
      label: "Product Link",
      required: true,
      width: "150px",
    },
    { key: "glb_link", label: "GLB Link", required: true, width: "150px" },
    {
      key: "glb_file",
      label: "3D File Upload",
      required: false,
      width: "150px",
    },
    { key: "category", label: "Category", required: true, width: "120px" },
    {
      key: "subcategory",
      label: "Subcategory",
      required: true,
      width: "120px",
    },
    { key: "client", label: "Client", required: true, width: "100px" },
    { key: "materials", label: "Materials", required: false, width: "120px" },
    { key: "colors", label: "Colors", required: false, width: "100px" },
    { key: "tags", label: "Tags", required: false, width: "100px" },
    { key: "preview_image", label: "Preview", required: false, width: "100px" },
    { key: "actions", label: "", required: false, width: "60px" },
  ];

  useEffect(() => {
    const script = document.createElement("script");
    script.src =
      "https://ajax.googleapis.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js";
    script.type = "module";
    script.onload = () => setModelViewerLoaded(true);
    document.head.appendChild(script);
    return () => {
      setModelViewerLoaded(false);
      const existingScript = document.querySelector(
        `script[src="${script.src}"]`
      );
      if (existingScript) document.head.removeChild(existingScript);
    };
  }, []);

  const waitForModelLoad = async (
    modelViewer: any,
    glbLink: string
  ): Promise<void> => {
    let cleanup: (() => void) | undefined;

    try {
      return await new Promise((resolve, reject) => {
        if (!modelViewer) {
          reject(new Error("Model viewer not initialized"));
          return;
        }

        const loadTimeout = setTimeout(() => {
          reject(
            new Error(
              `Model load timeout for URL: ${glbLink}. Please check if the URL is accessible and try again.`
            )
          );
        }, 60000); // Increased to 60 seconds

        const handleLoad = () => {
          clearTimeout(loadTimeout);
          setTimeout(resolve, 2000); // Increased delay to ensure model is fully loaded
        };

        const handleError = () => {
          clearTimeout(loadTimeout);
          reject(
            new Error(
              `Failed to load 3D model. Please check if the URL is accessible and try again.`
            )
          );
        };

        modelViewer.addEventListener("load", handleLoad);
        modelViewer.addEventListener("error", handleError);

        cleanup = () => {
          clearTimeout(loadTimeout);
          modelViewer.removeEventListener("load", handleLoad);
          modelViewer.removeEventListener("error", handleError);
        };
      });
    } finally {
      if (cleanup) cleanup();
    }
  };

  const generatePreview = async (rowIdx: number) => {
    try {
      const row = rows[rowIdx];
      if (!row.glb_link) {
        toast({
          title: "Error",
          description: "Please provide a GLB link first",
          variant: "destructive",
        });
        return;
      }
      setGeneratingPreview(rowIdx);
      const modelViewer = modelViewerRef.current;
      if (!modelViewer) throw new Error("Model viewer not initialized");
      // Clear previous model
      modelViewer.src = "";
      modelViewer.dismissPoster?.();
      modelViewer.scene?.clear?.();
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // Set new model
      modelViewer.src = row.glb_link;
      await waitForModelLoad(modelViewer, row.glb_link);
      // Additional delay to ensure model is fully rendered
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const blob = await modelViewer.toBlob({
        idealAspect: true,
        mimeType: "image/png",
        qualityArgument: 1,
        dimensionLimit: 1024,
        width: 1024,
        height: 1024,
      });
      if (!blob || blob.size === 0) {
        throw new Error("Failed to generate preview image");
      }
      const file = new File(
        [blob],
        `${row.article_id || "preview"}_preview.png`,
        {
          type: "image/png",
        }
      );
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fileName", `${row.article_id || "preview"}_preview.png`);
      console.log("Uploading generated preview image to Bunny CDN:", file.name);
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error("Failed to upload preview image");
      }
      const { url } = await response.json();
      setRows((prev) => {
        const copy = [...prev];
        copy[rowIdx].preview_image = url;
        return copy;
      });
      console.log("Generated preview image uploaded to Bunny CDN:", url);
      toast({
        title: "Success",
        description: "Preview image generated and uploaded",
      });
      setPreviewGenerated((prev) => ({ ...prev, [rowIdx]: true }));
    } catch (error) {
      console.error("Preview generation/upload error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to generate preview",
        variant: "destructive",
      });
    } finally {
      setGeneratingPreview(null);
      setModelViewerKey((k) => k + 1);
    }
  };

  // Queue processor effect
  useEffect(() => {
    if (previewQueue.length > 0 && !isProcessingQueue) {
      setIsProcessingQueue(true);
      generatePreview(previewQueue[0]).finally(() => {
        setPreviewQueue((q) => q.slice(1));
        setIsProcessingQueue(false);
      });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewQueue, isProcessingQueue]);

  return (
    <div className="w-full space-y-6 p-6 bg-background min-h-screen">
      {/* Off-canvas model viewer for high-res preview generation */}
      {modelViewerLoaded && (
        // @ts-expect-error -- model-viewer is a custom element
        <model-viewer
          key={modelViewerKey}
          ref={modelViewerRef}
          style={{
            position: "absolute",
            left: "-9999px",
            top: 0,
            width: "1024px",
            height: "1024px",
            opacity: 1,
            pointerEvents: "none",
            zIndex: -1,
          }}
          tone-mapping="aces"
          shadow-intensity="0"
          camera-orbit="-20.05deg 79.38deg 6.5m"
          field-of-view="10deg"
          environment-image="https://cdn.charpstar.net/Demos/HDR_Furniture.hdr"
          exposure="1.2"
          alpha-channel="blend"
          background-color="transparent"
        />
      )}

      {/* Header */}
      <div className="bg-card rounded-lg border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Batch Asset Upload
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Upload multiple assets at once or import from CSV
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowInfo(!showInfo)}
            className="text-muted-foreground"
          >
            <Info className="w-4 h-4 mr-2" />
            Field Info
          </Button>
        </div>

        {/* Status Bar */}
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            Rows:{" "}
            <span className="font-medium text-foreground">{rows.length}</span>
          </span>
          {errorCount > 0 && (
            <span className="text-destructive">
              Errors: <span className="font-medium">{errorCount}</span>
            </span>
          )}
          {checkingDuplicates && (
            <div className="flex items-center text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
              Checking duplicates...
            </div>
          )}
          {Object.keys(duplicates).length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex items-center text-yellow-600 dark:text-yellow-400">
                <AlertCircle className="w-4 h-4 mr-1" />
                <span>Duplicates found: {Object.keys(duplicates).length}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemoveDuplicateRows}
                className="text-yellow-600 dark:text-yellow-400 border-yellow-400 hover:bg-yellow-50/60 dark:hover:bg-yellow-950/30"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remove Duplicates
              </Button>
            </div>
          )}
        </div>

        {/* Field Information */}
        {showInfo && (
          <div className="mt-4 p-4 bg-muted/50 rounded-lg border border-border">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
              {columns.slice(0, -2).map((col) => (
                <div key={col.key} className="space-y-1">
                  <div className="font-medium text-foreground flex items-center gap-1">
                    {col.label}
                    {col.required && (
                      <span className="text-destructive">*</span>
                    )}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {col.key === "materials" ||
                    col.key === "colors" ||
                    col.key === "tags"
                      ? "Comma-separated list"
                      : col.key === "glb_file"
                        ? "Upload GLB/OBJ/ZIP (max 50MB)"
                        : col.key.includes("link")
                          ? col.key === "glb_link"
                            ? "Valid GLB link"
                            : "Valid URL"
                          : "Text field"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 mt-4">
          <Button onClick={handleAddRow} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Row
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="border-border hover:bg-muted"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            className="hidden"
            onChange={handleImportCSV}
          />
          <Button
            onClick={handleUploadAll}
            disabled={loading || validRows === 0}
            className="ml-auto"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload All ({validRows})
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Table Container */}
      <div
        ref={dropZoneRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative rounded-2xl bg-card border border-border p-4 transition-all duration-200 ${
          dragActive ? "border-primary bg-primary/5" : "border-border"
        }`}
      >
        {/* Drag Overlay */}
        {dragActive && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 border-2 border-dashed border-primary rounded-2xl backdrop-blur-sm">
            <Upload className="w-12 h-12 mb-3 text-primary animate-bounce" />
            <span className="text-primary font-medium">
              Drop CSV file here to import
            </span>
          </div>
        )}

        {/* Loading Overlays */}
        {(csvLoading || loading) && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-2xl">
            <Loader2 className="w-8 h-8 mb-3 animate-spin text-primary" />
            <span className="font-medium text-foreground">
              {csvLoading ? "Processing CSV file..." : "Uploading assets..."}
            </span>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead colSpan={columns.length} className="pb-0">
                <div className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
                  <span className="text-destructive">*</span> Required field
                </div>
              </TableHead>
            </TableRow>
            <TableRow className="hover:bg-transparent">
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={`${
                    col.required ? "text-primary" : "text-muted-foreground"
                  } ${col.key === "actions" ? "w-10" : ""}`}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.required && (
                      <span className="text-destructive" title="Required">
                        *
                      </span>
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, rowIdx) => {
              const hasErrors = Object.keys(row.errors || {}).length > 0;
              const isDuplicate = duplicates[row.id];
              return (
                <TableRow
                  key={row.id}
                  className={`transition-all
                    ${rowIdx % 2 === 0 ? "bg-muted/50" : "bg-card"}
                    ${hasErrors ? "border-l-4 border-l-destructive bg-destructive/5" : ""}
                    ${isDuplicate ? "border-l-4 border-l-yellow-400 bg-yellow-50/60 dark:bg-yellow-950/30" : ""}
                    hover:bg-muted/80
                  `}
                >
                  {columns.slice(0, -2).map((col, colIdx) => (
                    <TableCell key={col.key} className="align-top">
                      <div className="relative">
                        {col.key === "glb_file" ? (
                          <div className="flex items-center gap-2">
                            <label className="relative cursor-pointer flex items-center group p-2 w-full">
                              <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-muted rounded hover:bg-primary/10 transition-colors border border-border w-full justify-center">
                                <Upload className="w-4 h-4 mr-1" />
                                {row.glb_file
                                  ? row.glb_file.name
                                  : "Upload GLB/OBJ/ZIP"}
                              </span>
                              <Input
                                type="file"
                                accept=".glb,.obj,.zip"
                                onChange={(e) =>
                                  handleGLBFileChange(
                                    rowIdx,
                                    e.target.files?.[0] || null
                                  )
                                }
                                className="sr-only"
                              />
                            </label>
                          </div>
                        ) : col.key === "glb_link" ? (
                          <div className="flex gap-2">
                            <Input
                              ref={(el) => {
                                if (!cellRefs.current[rowIdx])
                                  cellRefs.current[rowIdx] = [];
                                cellRefs.current[rowIdx][colIdx] = el;
                              }}
                              value={String(
                                row[col.key as keyof AssetRow] || ""
                              )}
                              onChange={(e) =>
                                handleChange(
                                  rowIdx,
                                  col.key as EditableField,
                                  e.target.value
                                )
                              }
                              onKeyDown={(e) =>
                                handleKeyDown(e, rowIdx, colIdx)
                              }
                              className={`rounded-lg border transition-all duration-150 text-sm shadow-sm focus:ring-2
                                ${
                                  row.errors &&
                                  row.errors[col.key as EditableField]
                                    ? "border-destructive ring-destructive/20"
                                    : isDuplicate &&
                                        ((col.key as string) === "article_id" ||
                                          (col.key as string) ===
                                            "product_name")
                                      ? "border-yellow-400 ring-yellow-100 dark:ring-yellow-900/30"
                                      : "border-border focus:border-primary ring-primary/20"
                                }
                                bg-background
                              `}
                              placeholder={col.key.replace("_", " ")}
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() =>
                                setPreviewQueue((q) =>
                                  q.includes(rowIdx) ? q : [...q, rowIdx]
                                )
                              }
                              disabled={
                                !modelViewerLoaded ||
                                generatingPreview === rowIdx ||
                                previewQueue.includes(rowIdx) ||
                                (isProcessingQueue &&
                                  previewQueue[0] === rowIdx)
                              }
                              className="shrink-0"
                              title={
                                previewQueue.includes(rowIdx) ||
                                (isProcessingQueue &&
                                  previewQueue[0] === rowIdx)
                                  ? "Queued for preview generation"
                                  : "Generate preview image from GLB"
                              }
                            >
                              {generatingPreview === rowIdx ||
                              (isProcessingQueue &&
                                previewQueue[0] === rowIdx) ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : previewQueue.includes(rowIdx) ? (
                                <span className="w-4 h-4 flex items-center justify-center text-xs font-bold">
                                  Q
                                </span>
                              ) : previewGenerated[rowIdx] ? (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              ) : (
                                <Camera className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        ) : (
                          <Input
                            ref={(el) => {
                              if (!cellRefs.current[rowIdx])
                                cellRefs.current[rowIdx] = [];
                              cellRefs.current[rowIdx][colIdx] = el;
                            }}
                            value={String(row[col.key as keyof AssetRow] || "")}
                            onChange={(e) =>
                              handleChange(
                                rowIdx,
                                col.key as EditableField,
                                e.target.value
                              )
                            }
                            onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx)}
                            className={`rounded-lg border transition-all duration-150 text-sm shadow-sm focus:ring-2
                              ${
                                row.errors &&
                                row.errors[col.key as EditableField]
                                  ? "border-destructive ring-destructive/20"
                                  : isDuplicate &&
                                      ((col.key as string) === "article_id" ||
                                        (col.key as string) === "product_name")
                                    ? "border-yellow-400 ring-yellow-100 dark:ring-yellow-900/30"
                                    : "border-border focus:border-primary ring-primary/20"
                              }
                              bg-background
                            `}
                            placeholder={col.key.replace("_", " ")}
                          />
                        )}
                        {/* Error Message */}
                        {row.errors && row.errors[col.key as EditableField] && (
                          <div className="flex items-center mt-1 text-xs text-destructive">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            {row.errors[col.key as EditableField]}
                          </div>
                        )}
                        {/* Duplicate Warning */}
                        {isDuplicate &&
                          ((col.key as string) === "article_id" ||
                            (col.key as string) === "product_name") && (
                            <div className="flex items-center mt-1 text-xs text-yellow-600 dark:text-yellow-400">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              {col.key === "article_id"
                                ? duplicates[row.id] === "article_id"
                                  ? "This Article ID already exists"
                                  : duplicates[row.id] === "both"
                                    ? "This Article ID and Product Name combination already exists"
                                    : ""
                                : duplicates[row.id] === "product_name"
                                  ? "This Product Name already exists"
                                  : duplicates[row.id] === "both"
                                    ? "This Article ID and Product Name combination already exists"
                                    : ""}
                            </div>
                          )}
                      </div>
                    </TableCell>
                  ))}
                  {/* Preview Image */}
                  <TableCell className="align-top">
                    <div className="flex items-center gap-2">
                      <label className="relative cursor-pointer flex items-center group p-2">
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-muted rounded hover:bg-primary/10 transition-colors border border-border">
                          <Image
                            className="w-4 h-4 mr-1"
                            width={16}
                            height={16}
                          />
                          Upload
                        </span>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) =>
                            handleFileChange(
                              rowIdx,
                              e.target.files?.[0] || null
                            )
                          }
                          className="sr-only"
                        />
                      </label>
                      {row.preview_image && (
                        <div className="flex flex-col items-start">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={row.preview_image}
                            alt="Preview"
                            className="w-8 h-8 rounded shadow border border-border object-cover"
                          />
                          <span className="text-xs mt-1 text-primary">
                            {typeof row.preview_image === "string"
                              ? row.preview_image.split("/").pop() || ""
                              : ""}
                          </span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  {/* Actions */}
                  <TableCell className="align-top">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveRow(rowIdx)}
                      disabled={rows.length === 1}
                      className="text-destructive hover:bg-destructive/10 transition"
                      title="Remove Row"
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      // @ts-expect-error -- model-viewer is a custom element
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          alt?: string;
          "auto-rotate"?: boolean;
          "camera-controls"?: boolean;
          "shadow-intensity"?: string;
          "camera-orbit"?: string;
          "min-camera-orbit"?: string;
          "max-camera-orbit"?: string;
          "interaction-prompt"?: string;
          "environment-image"?: string;
          exposure?: string;
          "tone-mapping"?: string;
          "field-of-view"?: string;
          "alpha-channel"?: string;
          "background-color"?: string;
        },
        HTMLElement
      >;
    }
  }
}
