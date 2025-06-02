import React, { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import {
  Upload,
  Plus,
  Trash2,
  FileSpreadsheet,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";

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
  errors?: Partial<
    Record<keyof Omit<AssetRow, "id" | "preview_image">, string>
  >;
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

const requiredFields: (keyof AssetRow)[] = [
  "product_name",
  "product_link",
  "glb_link",
  "category",
  "subcategory",
  "client",
];

type EditableField = keyof AssetRow;

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [dragActive, setDragActive] = useState(false);

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

  const handleChange = (idx: number, field: keyof AssetRow, value: any) => {
    setRows((prev) => {
      const copy = [...prev];
      copy[idx][field] = value;
      // Clear error for this cell
      if (copy[idx].errors && editableFields.includes(field as EditableField)) {
        copy[idx].errors![field as EditableField] = undefined;
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
      if (!row[field]) {
        errors[field] = "Required";
      }
    });
    return errors;
  };

  const handleUploadAll = async () => {
    setLoading(true);
    let anyError = false;
    const results = await Promise.all(
      rows.map(async (row, idx) => {
        const errors = validateRow(row);
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
        formData.append("product_name", row.product_name);
        formData.append("product_link", row.product_link);
        formData.append("glb_link", row.glb_link);
        formData.append("category", row.category);
        formData.append("subcategory", row.subcategory);
        formData.append("client", row.client);
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
    (count, row) => count + Object.keys(row.errors || {}).length,
    0
  );
  const validRows = rows.filter(
    (row) => Object.keys(row.errors || {}).length === 0
  ).length;

  return (
    <div className="w-full space-y-6">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-100 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Batch Asset Upload
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              Upload multiple assets at once or import from CSV
            </p>
          </div>
          <div className="flex items-center space-x-4 text-sm">
            <div className="bg-white dark:bg-gray-800 px-3 py-2 rounded-lg border">
              <span className="text-gray-500">Total Rows:</span>
              <span className="font-semibold ml-1">{rows.length}</span>
            </div>
            <div className="bg-white dark:bg-gray-800 px-3 py-2 rounded-lg border">
              <span className="text-gray-500">Valid:</span>
              <span className="font-semibold ml-1 text-green-600">
                {validRows}
              </span>
            </div>
            {errorCount > 0 && (
              <div className="bg-white dark:bg-gray-800 px-3 py-2 rounded-lg border">
                <span className="text-gray-500">Errors:</span>
                <span className="font-semibold ml-1 text-red-600">
                  {errorCount}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={handleAddRow}
          className="bg-green-600 hover:bg-green-700 text-white shadow-md"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Row
        </Button>
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50"
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
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-md disabled:bg-gray-400"
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
        className={`relative bg-white dark:bg-gray-900 rounded-xl border-2 shadow-sm transition-all duration-200 ${
          dragActive
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20 shadow-lg"
            : "border-gray-200 dark:border-gray-700"
        }`}
      >
        {dragActive && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-blue-50/90 dark:bg-blue-950/90 border-2 border-dashed border-blue-400 rounded-xl backdrop-blur-sm">
            <div className="text-center">
              <Upload className="w-12 h-12 mx-auto mb-3 text-blue-500" />
              <span className="text-blue-700 dark:text-blue-300 text-lg font-semibold">
                Drop CSV file here to import
              </span>
            </div>
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-xl">
            <div className="text-center">
              <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-blue-500" />
              <span className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                Uploading assets...
              </span>
            </div>
          </div>
        )}

        {/* Table Container */}
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
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
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider"
                  >
                    <div className="flex items-center space-x-1">
                      <span>{col.label}</span>
                      {col.required && <span className="text-red-500">*</span>}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {rows.map((row, rowIdx) => {
                const hasErrors = Object.keys(row.errors || {}).length > 0;
                return (
                  <tr
                    key={row.id}
                    className={`transition-colors ${
                      hasErrors
                        ? "bg-red-50 dark:bg-red-950/20 border-l-4 border-l-red-400"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
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
                      ] as (keyof AssetRow)[]
                    ).map((field, colIdx) => (
                      <td className="px-4 py-3" key={field}>
                        <div className="relative">
                          <Input
                            ref={(el) => {
                              if (!cellRefs.current[rowIdx])
                                cellRefs.current[rowIdx] = [];
                              cellRefs.current[rowIdx][colIdx] = el;
                            }}
                            value={row[field] as string}
                            onChange={(e) =>
                              handleChange(rowIdx, field, e.target.value)
                            }
                            onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx)}
                            required={requiredFields.includes(field)}
                            className={`transition-all duration-200 ${
                              row.errors && row.errors[field]
                                ? "border-red-400 focus:border-red-500 focus:ring-red-200"
                                : "border-gray-300 focus:border-blue-500 focus:ring-blue-200"
                            }`}
                            placeholder={`Enter ${field.replace("_", " ")}`}
                          />
                          {row.errors && row.errors[field] && (
                            <div className="flex items-center mt-1 text-xs text-red-600">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              {row.errors[field]}
                            </div>
                          )}
                        </div>
                      </td>
                    ))}
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveRow(rowIdx)}
                        disabled={rows.length === 1}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
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
