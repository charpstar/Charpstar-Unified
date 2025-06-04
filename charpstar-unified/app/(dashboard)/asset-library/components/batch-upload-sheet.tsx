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
} from "lucide-react";
import { debounce } from "lodash";

interface AssetRow {
  product_name: string;
  product_link: string;
  glb_link: string;
  category: string;
  subcategory: string;
  client: string;
  materials: string;
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
      | "materials"]?: string;
  };
}

interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingAsset?: {
    id: string;
    name: string;
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
  preview_image: null,
  id: Math.random().toString(36).slice(2),
  errors: {},
});

const requiredFields: EditableField[] = [
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
  | "materials";

const editableFields: EditableField[] = [
  "product_name",
  "product_link",
  "glb_link",
  "category",
  "subcategory",
  "client",
  "materials",
];

export function BatchUploadSheet({ onSuccess }: { onSuccess?: () => void }) {
  const [rows, setRows] = useState<AssetRow[]>([emptyRow()]);
  const [loading, setLoading] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [duplicates, setDuplicates] = useState<{ [key: string]: boolean }>({});
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

  const handleCSVFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length < 1) return;
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
          preview_image: null,
          id: Math.random().toString(36).slice(2),
          errors: {},
        };
      });
      setRows((prev) => [...prev, ...newRows]);
      toast({ title: `Imported ${newRows.length} rows from CSV` });
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

  // Add duplicate check function
  const checkDuplicates = async (
    rows: AssetRow[]
  ): Promise<DuplicateCheckResult[]> => {
    const results: DuplicateCheckResult[] = [];

    for (const row of rows) {
      if (!row.product_name) continue;

      const { data: existingAssets } = await createClient()
        .from("assets")
        .select("id, name, client")
        .ilike("name", row.product_name)
        .eq("client", user?.metadata?.client || "");

      results.push({
        isDuplicate: Boolean(existingAssets && existingAssets.length > 0),
        existingAsset: existingAssets?.[0],
      });
    }

    return results;
  };

  // Update the useEffect
  useEffect(() => {
    const debouncedCheck = debounce(async () => {
      if (rows.length === 0) return;

      setCheckingDuplicates(true);
      try {
        const duplicateResults = await checkDuplicates(rows);
        const newDuplicates: { [key: string]: boolean } = {};
        duplicateResults.forEach((result, index) => {
          if (result.isDuplicate && result.existingAsset) {
            newDuplicates[rows[index].id] = true;
          }
        });
        setDuplicates(newDuplicates);
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
    }, 500);

    debouncedCheck();
    return () => debouncedCheck.cancel();
  }, [rows, checkDuplicates]);

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
        formData.append(
          "materials",
          JSON.stringify(
            row.materials
              .split(",")
              .map((m) => m.trim())
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
            <div className="bg-white dark:bg-background px-4 py-2 rounded-xl border border-green-100 dark:border-green-900 shadow-sm flex items-center gap-1">
              <span className="text-muted-500">Valid:</span>
              <span className="font-semibold text-green-600 dark:text-green-400">
                {validRows}
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
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full">
            <thead className="sticky top-0 z-10 bg-muted-50 dark:bg-muted-800 border-b border-muted-200 dark:border-muted-700">
              <tr>
                {[
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
                  {
                    key: "preview_image",
                    label: "Preview Image",
                    required: false,
                  },
                  { key: "actions", label: "Actions", required: false },
                ].map((col) => (
                  <th
                    key={col.key}
                    className="px-4 py-3 text-left text-xs font-semibold text-muted-600 dark:text-muted-300 uppercase tracking-wider"
                  >
                    <div className="flex items-center space-x-1">
                      <span>{col.label}</span>
                      {col.required && <span className="text-red-500">*</span>}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-muted-200 dark:divide-muted-700">
              {rows.map((row, rowIdx) => {
                const hasErrors = Object.keys(row.errors || {}).length > 0;
                const isDuplicate = duplicates[row.id];
                return (
                  <tr
                    key={row.id}
                    className={`transition-colors ${
                      hasErrors
                        ? "bg-red-50 dark:bg-red-950/20 border-l-4 border-l-red-400"
                        : isDuplicate
                          ? "bg-yellow-50 dark:bg-yellow-950/20 border-l-4 border-l-yellow-400"
                          : "hover:bg-muted-50 dark:hover:bg-muted-950/10"
                    }`}
                  >
                    {(
                      [
                        "product_name",
                        "product_link",
                        "glb_link",
                        "category",
                        "subcategory",
                        "client",
                        "materials",
                      ] as EditableField[]
                    ).map((field, colIdx) => (
                      <td className="px-4 py-3 align-top" key={field}>
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
                            className={`transition-all duration-200 text-sm shadow-sm
                              ${
                                row.errors && row.errors[field]
                                  ? "border-red-400 focus:border-red-500 focus:ring-red-200"
                                  : isDuplicate
                                    ? "border-yellow-400 focus:border-yellow-500 focus:ring-yellow-200"
                                    : "border-muted-300 focus:border-primary focus:ring-primary/20"
                              }`}
                            placeholder={`Enter ${field.replace("_", " ")}`}
                          />
                          {row.errors && row.errors[field] && (
                            <div className="flex items-center mt-1 text-xs text-red-600">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              {row.errors[field]}
                            </div>
                          )}
                          {isDuplicate && (
                            <div className="flex items-center mt-1 text-xs text-yellow-600">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              This product name already exists
                            </div>
                          )}
                        </div>
                      </td>
                    ))}
                    {/* Preview Image */}
                    <td className="px-4 py-3 align-top">
                      <div className="relative">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) =>
                            handleFileChange(
                              rowIdx,
                              e.target.files?.[0] || null
                            )
                          }
                          className="text-sm"
                        />
                        {row.preview_image && (
                          <div className="flex items-center mt-1 text-xs text-green-600">
                            <Check className="w-3 h-3 mr-1" />
                            {row.preview_image.name}
                          </div>
                        )}
                      </div>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3 align-top">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveRow(rowIdx)}
                        disabled={rows.length === 1}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                        title="Remove Row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
