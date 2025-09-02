"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/useUser";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/containers";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/containers";
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/display";
import { Input } from "@/components/ui/inputs";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export default function ManualUploadPage() {
  const user = useUser();
  const router = useRouter();
  type Row = {
    article_id: string;
    product_name: string;
    product_link: string;
    cad_file_link: string;
    category: string;
    subcategory: string;
    notes?: string;
  };

  const [rows, setRows] = useState<Row[]>([
    {
      article_id: "",
      product_name: "",
      product_link: "",
      cad_file_link: "",
      category: "",
      subcategory: "",
      notes: "",
    },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState<Row[]>([]);

  const updateCell = (index: number, field: keyof Row, value: string) => {
    setRows((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value } as Row;
      return copy;
    });
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        article_id: "",
        product_name: "",
        product_link: "",
        cad_file_link: "",
        category: "",
        subcategory: "",
        notes: "",
      },
    ]);
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const client = user?.metadata?.client;
    if (!client) {
      toast.error("No client linked to your account. Contact support.");
      return;
    }

    const prepared = rows
      .map((r) => ({
        ...r,
        product_name: r.product_name.trim(),
        article_id: r.article_id.trim(),
      }))
      .filter(
        (r) =>
          r.product_name ||
          r.article_id ||
          r.product_link ||
          r.cad_file_link ||
          r.category ||
          r.subcategory ||
          r.notes
      );

    if (prepared.length === 0) {
      toast.error("Please add at least one row with data");
      return;
    }

    const invalid = prepared.filter((r) => !r.product_name || !r.article_id);
    if (invalid.length > 0) {
      toast.error("Each row needs Product Name and Article ID");
      return;
    }
    // Open preview dialog instead of immediate upload
    setPreviewRows(prepared);
    setPreviewOpen(true);
  };

  const handleConfirmUpload = async () => {
    const client = user?.metadata?.client;
    if (!client || previewRows.length === 0) {
      setPreviewOpen(false);
      return;
    }
    setSubmitting(true);
    try {
      const payload = previewRows.map((r) => ({
        client,
        article_id: r.article_id,
        product_name: r.product_name,
        product_link: r.product_link || null,
        cad_file_link: r.cad_file_link || null,
        category: r.category || null,
        subcategory: r.subcategory || null,
        reference: null,
        priority: 2,
      }));

      const { error } = await supabase
        .from("onboarding_assets")
        .insert(payload);
      if (error) throw error;

      if (user?.id) {
        await supabase
          .from("profiles")
          .update({ csv_uploaded: true })
          .eq("id", user.id);
      }

      toast.success(
        `${payload.length} product${payload.length > 1 ? "s" : ""} added successfully`
      );

      setPreviewOpen(false);
      setRows([
        {
          article_id: "",
          product_name: "",
          product_link: "",
          cad_file_link: "",
          category: "",
          subcategory: "",
          notes: "",
        },
      ]);

      router.push("/dashboard?refreshUser=1");
    } catch (e: any) {
      toast.error(e?.message || "Failed to add product");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Manual Product Upload</h1>
          <p className="text-muted-foreground">
            Add single products to onboarding without a CSV.
          </p>
        </div>
      </div>

      <Card className="p-6 space-y-4">
        <p className="text-xs text-muted-foreground">
          Fields marked with <span className="text-red-500">*</span> are
          required.
        </p>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  Product Name <span className="text-red-500">*</span>
                </TableHead>
                <TableHead>
                  Article ID <span className="text-red-500">*</span>
                </TableHead>
                <TableHead>Product Link</TableHead>
                <TableHead>CAD/File Link</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Subcategory</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <Input
                      value={row.product_name}
                      onChange={(e) =>
                        updateCell(idx, "product_name", e.target.value)
                      }
                      placeholder="E.g. Wooden Chair"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.article_id}
                      onChange={(e) =>
                        updateCell(idx, "article_id", e.target.value)
                      }
                      placeholder="E.g. ABC123"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.product_link}
                      onChange={(e) =>
                        updateCell(idx, "product_link", e.target.value)
                      }
                      placeholder="https://..."
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.cad_file_link}
                      onChange={(e) =>
                        updateCell(idx, "cad_file_link", e.target.value)
                      }
                      placeholder="https://..."
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.category}
                      onChange={(e) =>
                        updateCell(idx, "category", e.target.value)
                      }
                      placeholder="E.g. Furniture"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.subcategory}
                      onChange={(e) =>
                        updateCell(idx, "subcategory", e.target.value)
                      }
                      placeholder="E.g. Chair"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="cursor-pointer text-red-500"
                      onClick={() => removeRow(idx)}
                      title="Remove row"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 cursor-pointer"
            onClick={addRow}
            title="Add another row"
          >
            <Plus className="h-4 w-4" />
            Add row
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="cursor-pointer"
          >
            {submitting ? "Saving..." : "Add All"}
          </Button>
        </div>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Review products to be added</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Article ID</TableHead>
                  <TableHead>Product Link</TableHead>
                  <TableHead>CAD/File Link</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Subcategory</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">
                      {r.product_name}
                    </TableCell>
                    <TableCell>{r.article_id}</TableCell>
                    <TableCell className="truncate max-w-[240px]">
                      {r.product_link || "-"}
                    </TableCell>
                    <TableCell className="truncate max-w-[240px]">
                      {r.cad_file_link || "-"}
                    </TableCell>
                    <TableCell>{r.category || "-"}</TableCell>
                    <TableCell>{r.subcategory || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setPreviewOpen(false)}
              className="cursor-pointer"
            >
              Back
            </Button>
            <Button
              onClick={handleConfirmUpload}
              disabled={submitting}
              className="cursor-pointer"
            >
              {submitting ? "Completing..." : "Complete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
