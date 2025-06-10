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
  AlertCircle,
  Loader2,
  Image,
  Info,
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
  const [showInfo, setShowInfo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);
  const user = useUser();

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
    setRows((prev) => {
      const copy = [...prev];
      copy[idx].preview_image = file;
      return copy;
    });
  };

  const handleAddRow = () => setRows((prev) => [...prev, emptyRow()]);
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

  return (
    <div className="w-full space-y-6 p-6 bg-background min-h-screen">
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleRemoveDuplicateRows}
              className="text-yellow-600 dark:text-yellow-400 border-yellow-400 hover:bg-yellow-50/60 dark:hover:bg-yellow-950/30"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Remove Duplicates
            </Button>
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
                      : col.key.includes("link")
                        ? "Valid URL"
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
                        <Input
                          ref={(el) => {
                            if (!cellRefs.current[rowIdx])
                              cellRefs.current[rowIdx] = [];
                            cellRefs.current[rowIdx][colIdx] = el;
                          }}
                          value={row[col.key as EditableField]}
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
                              row.errors && row.errors[col.key as EditableField]
                                ? "border-destructive ring-destructive/20"
                                : isDuplicate &&
                                    (col.key === "article_id" ||
                                      col.key === "product_name")
                                  ? "border-yellow-400 ring-yellow-100 dark:ring-yellow-900/30"
                                  : "border-border focus:border-primary ring-primary/20"
                            }
                            bg-background
                          `}
                          placeholder={col.key.replace("_", " ")}
                        />
                        {/* Error Message */}
                        {row.errors && row.errors[col.key as EditableField] && (
                          <div className="flex items-center mt-1 text-xs text-destructive">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            {row.errors[col.key as EditableField]}
                          </div>
                        )}
                        {/* Duplicate Warning */}
                        {isDuplicate &&
                          (col.key === "article_id" ||
                            col.key === "product_name") && (
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
                          <Image className="w-4 h-4 mr-1" />
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
                            className="w-8 h-8 rounded shadow border border-border object-cover"
                          />
                          <span className="text-xs mt-1 text-primary">
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
