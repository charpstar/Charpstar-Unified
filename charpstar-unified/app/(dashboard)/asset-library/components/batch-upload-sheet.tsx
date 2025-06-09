import React, { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { useUser } from "@/contexts/useUser";
import { createClient } from "@/utils/supabase/client";
import {
  Upload,
  Plus,
  Trash2,
  FileSpreadsheet,
  Check,
  AlertCircle,
  Loader2,
  ImageIcon,
} from "lucide-react";
import { debounce } from "lodash";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AssetRow {
  product_name: string;
  product_link: string;
  glb_link: string;
  category: string;
  subcategory: string;
  client: string;
  materials: string;
  colors: string;
  tags: string;
  article_id: string;
  preview_image?: File | null;
  id: string;
  errors?: {
    [K in
      | "product_name"
      | "product_link"
      | "glb_link"
      | "category"
      | "subcategory"
      | "client"
      | "materials"
      | "colors"
      | "tags"
      | "article_id"]?: string;
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
  | "category"
  | "subcategory"
  | "client"
  | "materials"
  | "colors"
  | "tags"
  | "article_id";

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
        // Check which one matches
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
  const [loading, setLoading] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [duplicates, setDuplicates] = useState<{
    [key: string]: "article_id" | "product_name" | "both";
  }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const user = useUser();

  // Keyboard navigation
  const cellRefs = useRef<(HTMLInputElement | null)[][]>([]);

  // Focus next cell on Enter/Tab
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
      // Move to next cell or next row
      if (cellRefs.current[rowIdx]?.[colIdx + 1]) {
        focusCell(rowIdx, colIdx + 1);
      } else if (cellRefs.current[rowIdx + 1]?.[0]) {
        focusCell(rowIdx + 1, 0);
      }
    }
  };

  // Drag-and-drop CSV import
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

  // Add new state for CSV loading
  const [csvLoading, setCsvLoading] = useState(false);

  // Update the handleCSVFile function
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
    console.log(`Changing ${field} to:`, value);
    setRows((prev) => {
      const copy = [...prev];
      copy[idx][field] = value;

      // Initialize errors object if it doesn't exist
      if (!copy[idx].errors) {
        copy[idx].errors = {};
      }

      // Clear error for this cell
      if (editableFields.includes(field)) {
        delete copy[idx].errors![field];
      }

      // Only validate if the field is required
      if (requiredFields.includes(field)) {
        if (!value || value.trim() === "") {
          copy[idx].errors![field] = "Required";
        }
      }

      return copy;
    });
  };

  const handleFileChange = (idx: number, file: File | null) => {
    setRows((prev) => {
      const copy = [...prev];
      copy[idx].preview_image = file;
      return copy;
    });
  };

  const handleAddRow = () => setRows((prev) => [...prev, emptyRow()]);
  const handleRemoveRow = (idx: number) =>
    setRows((prev) => prev.filter((_, i) => i !== idx));

  // Per-cell validation
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

  // Set client from user metadata when component mounts
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

  // Update the useEffect
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
    const clientValue = user?.metadata?.client;
    if (!clientValue) {
      toast({
        title: "Error",
        description: "No client found in user profile",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    let anyError = false;

    // Add console log to debug rows before upload
    console.log("Rows before upload:", rows);

    const results = await Promise.all(
      rows.map(async (row, idx) => {
        const errors = validateRow(row);
        console.log(`Row ${idx} validation errors:`, errors);

        if (Object.keys(errors).length > 0) {
          setRows((prev) => {
            const copy = [...prev];
            copy[idx].errors = errors;
            return copy;
          });
          anyError = true;
          return null;
        }

        const formData = new FormData();
        formData.append("product_name", row.product_name.trim());
        formData.append("product_link", row.product_link.trim());
        formData.append("glb_link", row.glb_link.trim());
        formData.append("category", row.category.trim());
        formData.append("subcategory", row.subcategory.trim());
        formData.append("client", clientValue);
        formData.append("article_id", row.article_id.trim());
        formData.append(
          "materials",
          JSON.stringify(
            row.materials
              .split(",")
              .map((m) => m.trim())
              .filter(Boolean)
          )
        );
        formData.append(
          "colors",
          JSON.stringify(
            row.colors
              .split(",")
              .map((c) => c.trim())
              .filter(Boolean)
          )
        );
        formData.append(
          "tags",
          JSON.stringify(
            row.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          )
        );
        if (row.preview_image) {
          formData.append("preview_image", row.preview_image);
        }

        try {
          const res = await fetch("/api/assets", {
            method: "POST",
            body: formData,
          });
          if (!res.ok) {
            throw new Error("Failed to upload");
          }
          setRows((prev) => {
            const copy = [...prev];
            copy[idx].errors = {};
            return copy;
          });
          return true;
        } catch (err) {
          console.error(`Error uploading row ${idx}:`, err);
          setRows((prev) => {
            const copy = [...prev];
            copy[idx].errors = { product_name: "Upload failed" };
            return copy;
          });
          anyError = true;
          return false;
        }
      })
    );

    setLoading(false);
    if (!anyError) {
      toast({
        title: "All assets uploaded successfully!",
        description: `${rows.length} assets uploaded`,
      });
      setRows([emptyRow()]);
      if (onSuccess) onSuccess();
    } else {
      toast({
        title: "Some uploads failed",
        description: "Please check errors and try again",
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

  return (
    <div className="w-full space-y-7">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-muted-50  dark:from-muted-950/20  rounded-2xl p-7 border border-muted-200 dark:border-muted-800 shadow-md flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl font-extrabold text-muted-900 dark:text-white mb-1 tracking-tight">
              Batch Asset Upload
            </h2>
            <p className="text-muted-600 dark:text-muted-300 text-sm font-medium">
              Upload multiple assets at once or import from CSV
            </p>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <div className="bg-white dark:bg-background px-4 py-2 rounded-xl border border-muted-100 dark:border-muted-800 shadow-sm flex items-center gap-1">
              <span className="text-muted-500">Total Rows:</span>
              <span className="font-semibold text-muted-600 dark:text-muted-200">
                {rows.length}
              </span>
            </div>

            {errorCount > 0 && (
              <div className="bg-white dark:bg-muted-800 px-4 py-2 rounded-xl border border-red-100 dark:border-red-800 shadow-sm flex items-center gap-1">
                <span className="text-muted-500">Errors:</span>
                <span className="font-semibold text-red-600 dark:text-red-400">
                  {errorCount}
                </span>
              </div>
            )}
            {checkingDuplicates && (
              <div className="bg-white dark:bg-background px-4 py-2 rounded-xl border border-blue-100 dark:border-blue-900 shadow-sm flex items-center gap-1">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                <span className="text-muted-500">Checking duplicates...</span>
              </div>
            )}
          </div>
        </div>

        {/* Field Information Box */}
        <div className="mt-4 bg-white/50 dark:bg-background backdrop-blur-sm rounded-xl border border-muted-200 dark:border-muted-700 p-4">
          <h3 className="text-sm font-semibold text-muted-900 dark:text-muted-100 mb-3">
            Field Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-muted-900 dark:text-muted-100">
                  Article ID
                </span>
                <span className="text-xs text-red-500">*</span>
              </div>
              <p className="text-xs text-muted-600 dark:text-muted-300">
                Unique identifier for the product (required)
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-muted-900 dark:text-muted-100">
                  Product Name
                </span>
                <span className="text-xs text-red-500">*</span>
              </div>
              <p className="text-xs text-muted-600 dark:text-muted-300">
                Name of the product
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-muted-900 dark:text-muted-100">
                  Product Link
                </span>
                <span className="text-xs text-red-500">*</span>
              </div>
              <p className="text-xs text-muted-600 dark:text-muted-300">
                URL to the product page
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-muted-900 dark:text-muted-100">
                  GLB Link
                </span>
                <span className="text-xs text-red-500">*</span>
              </div>
              <p className="text-xs text-muted-600 dark:text-muted-300">
                URL to the 3D model file
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-muted-900 dark:text-muted-100">
                  Category
                </span>
                <span className="text-xs text-red-500">*</span>
              </div>
              <p className="text-xs text-muted-600 dark:text-muted-300">
                Main category of the product
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-muted-900 dark:text-muted-100">
                  Subcategory
                </span>
                <span className="text-xs text-red-500">*</span>
              </div>
              <p className="text-xs text-muted-600 dark:text-muted-300">
                Subcategory of the product
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-muted-900 dark:text-muted-100">
                  Client
                </span>
                <span className="text-xs text-red-500">*</span>
              </div>
              <p className="text-xs text-muted-600 dark:text-muted-300">
                Client name or identifier
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-muted-900 dark:text-muted-100">
                  Materials
                </span>
                <span className="text-xs text-muted-500">*</span>
              </div>
              <p className="text-xs text-muted-600 dark:text-muted-300">
                Comma-separated list of materials
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-muted-900 dark:text-muted-100">
                  Colors
                </span>
                <span className="text-xs text-muted-500">*</span>
              </div>
              <p className="text-xs text-muted-600 dark:text-muted-300">
                Comma-separated list of colors
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-muted-900 dark:text-muted-100">
                  Tags
                </span>
                <span className="text-xs text-muted-500">*</span>
              </div>
              <p className="text-xs text-muted-600 dark:text-muted-300">
                Comma-separated list of tags
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-muted-900 dark:text-muted-100">
                  Preview Image
                </span>
                <span className="text-xs text-muted-500">*</span>
              </div>
              <p className="text-xs text-muted-600 dark:text-muted-300">
                Product preview image file
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1 text-muted-600 dark:text-muted-300">
              <span className="text-red-500">*</span>
              <span>Required</span>
            </div>
            <div className="flex items-center gap-1 text-muted-600 dark:text-muted-300">
              <span className="text-muted-500">*</span>
              <span>Optional</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={handleAddRow}
          className="bg-primary hover:bg-primary/90 dark:hover:bg-primary/30 text-white shadow-md dark:bg-muted dark:text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Row
        </Button>
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-muted-300 hover:border-primary hover:bg-primary/10 dark:border-muted-600 dark:text-white"
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
          className="bg-primary hover:bg-primary/90 text-white shadow-lg disabled:bg-muted-300 dark:bg-muted dark:text-white dark:hover:bg-primary/30"
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

      {/* Drag and Drop Zone */}
      <div
        ref={dropZoneRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative rounded-2xl border-2 transition-all duration-200 overflow-hidden
          ${
            dragActive
              ? "border-muted-400 bg-muted-50 dark:bg-muted-950/20 shadow-xl animate-pulse"
              : "border-background-200 dark:border-background-700 bg-background dark:bg-background-900 shadow-sm"
          }`}
      >
        {/* Drag Overlay */}
        {dragActive && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-muted-50/90 dark:bg-muted-950/80 border-2 border-dashed border-muted-400 rounded-2xl backdrop-blur-sm">
            <Upload className="w-14 h-14 mb-3 text-muted-500 animate-bounce" />
            <span className="text-muted-800 dark:text-muted-200 text-lg font-semibold">
              Drop CSV file here to import
            </span>
          </div>
        )}

        {/* Add CSV Loading Overlay */}
        {csvLoading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/85 dark:bg-muted-900/85 backdrop-blur-sm rounded-2xl">
            <Loader2 className="w-10 h-10 mb-3 animate-spin text-muted-500" />
            <span className="text-base font-semibold text-muted-700 dark:text-muted-200">
              Processing CSV file...
            </span>
          </div>
        )}

        {/* Uploading Overlay */}
        {loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/85 dark:bg-muted-900/85 backdrop-blur-sm rounded-2xl">
            <Loader2 className="w-10 h-10 mb-3 animate-spin text-muted-500" />
            <span className="text-base font-semibold text-muted-700 dark:text-muted-200">
              Uploading assets...
            </span>
          </div>
        )}

        {/* Table Container */}
        <div className="rounded-2xl shadow-lg bg-white dark:bg-muted-900 border border-muted-200 dark:border-muted-800 p-4">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {[
                  { key: "article_id", label: "Article ID", required: true },
                  {
                    key: "product_name",
                    label: "Product Name",
                    required: true,
                  },
                  {
                    key: "product_link",
                    label: "Product Link",
                    required: true,
                  },
                  { key: "glb_link", label: "GLB Link", required: true },
                  { key: "category", label: "Category", required: true },
                  { key: "subcategory", label: "Subcategory", required: true },
                  { key: "client", label: "Client", required: true },
                  { key: "materials", label: "Materials", required: false },
                  { key: "colors", label: "Colors", required: false },
                  { key: "tags", label: "Tags", required: false },
                  { key: "preview_image", label: "Preview", required: false },
                  { key: "actions", label: "", required: false },
                ].map((col) => (
                  <TableHead
                    key={col.key}
                    className={`${
                      col.required ? "text-primary" : "text-muted-400"
                    } ${col.key === "actions" ? "w-10" : ""}`}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {col.required && (
                        <span className="text-red-500" title="Required">
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
                      ${rowIdx % 2 === 0 ? "bg-muted-100 dark:bg-muted-800/40" : "bg-white dark:bg-muted-900"}
                      ${hasErrors ? "border-l-4 border-l-red-400 bg-red-50/60 dark:bg-red-950/30" : ""}
                      ${isDuplicate ? "border-l-4 border-l-yellow-400 bg-yellow-50/60 dark:bg-yellow-950/30" : ""}
                      hover:bg-muted-50 dark:hover:bg-muted-800/60
                    `}
                  >
                    {(
                      [
                        "article_id",
                        "product_name",
                        "product_link",
                        "glb_link",
                        "category",
                        "subcategory",
                        "client",
                        "materials",
                        "colors",
                        "tags",
                      ] as EditableField[]
                    ).map((field, colIdx) => (
                      <TableCell key={field} className="align-top">
                        <div className="relative">
                          <Input
                            ref={(el) => {
                              if (!cellRefs.current[rowIdx])
                                cellRefs.current[rowIdx] = [];
                              cellRefs.current[rowIdx][colIdx] = el;
                            }}
                            value={row[field]}
                            onChange={(e) =>
                              handleChange(rowIdx, field, e.target.value)
                            }
                            onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx)}
                            required={requiredFields.includes(field)}
                            className={`rounded-lg border transition-all duration-150 text-sm shadow-sm focus:ring-2
                              ${
                                row.errors && row.errors[field]
                                  ? "border-red-400 ring-red-100"
                                  : isDuplicate &&
                                      (field === "article_id" ||
                                        field === "product_name")
                                    ? "border-yellow-400 ring-yellow-100"
                                    : "border-muted-300 focus:border-primary ring-primary/20"
                              }
                              bg-white dark:bg-muted-900
                            `}
                            placeholder={`Enter ${field.replace("_", " ")}`}
                          />
                          {/* Error Message */}
                          {row.errors && row.errors[field] && (
                            <div className="flex items-center mt-1 text-xs text-red-600">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              {row.errors[field]}
                            </div>
                          )}
                          {/* Duplicate Warning */}
                          {isDuplicate &&
                            (field === "article_id" ||
                              field === "product_name") && (
                              <div className="flex items-center mt-1 text-xs text-yellow-600">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                {field === "article_id"
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
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-muted-200 dark:bg-muted-700 rounded hover:bg-primary/10 transition-colors border border-muted-300 dark:border-muted-600">
                            <ImageIcon className="w-4 h-4 mr-1" />
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
                            <img
                              src={URL.createObjectURL(row.preview_image)}
                              alt="Preview"
                              className="w-8 h-8 rounded shadow border border-muted-300 object-cover"
                            />
                            <span className="text-xs mt-1 text-green-600">
                              {row.preview_image.name}
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
                        className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900 transition"
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
    </div>
  );
}
