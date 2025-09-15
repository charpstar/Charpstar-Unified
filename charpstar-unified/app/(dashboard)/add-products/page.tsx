"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/useUser";
import { supabase } from "@/lib/supabaseClient";
import { notificationService } from "@/lib/notificationService";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Button, Label } from "@/components/ui/display";
import { Input } from "@/components/ui/inputs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs/select";
import { Badge, Alert, AlertDescription } from "@/components/ui/feedback";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/display";
import { toast } from "sonner";
import { useLoading } from "@/contexts/LoadingContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/containers/dialog";
import {
  Plus,
  ArrowLeft,
  Package,
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle,
  Loader2,
  X,
  Eye,
  AlertTriangle,
} from "lucide-react";

import * as saveAs from "file-saver";

interface ProductForm {
  article_id: string;
  product_name: string;
  product_link: string;
  glb_link: string;
  category: string;
  subcategory: string;
  priority: number;
}

export default function AddProductsPage() {
  const user = useUser();
  const { startLoading, stopLoading } = useLoading();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [currentBatch, setCurrentBatch] = useState<number>(1);
  const [products, setProducts] = useState<ProductForm[]>([
    {
      article_id: "",
      product_name: "",
      product_link: "",
      glb_link: "",
      category: "",
      subcategory: "",
      priority: 2,
    },
  ]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<string[][] | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvErrors, setCsvErrors] = useState<
    { row: number; message: string }[]
  >([]);
  const [csvWarnings, setCsvWarnings] = useState<
    {
      row: number;
      message: string;
      type: "duplicate_article_id" | "missing_fields";
    }[]
  >([]);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editedCsvData, setEditedCsvData] = useState<string[][] | null>(null);
  //eslint-disable-next-line
  const [scrapingImages, setScrapingImages] = useState(false);

  // Helper function to reset file input
  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      // Force a small delay to ensure the browser processes the reset
      setTimeout(() => {
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }, 10);
    }
  };

  // Function to scrape images for the client
  const scrapeImages = async () => {
    if (!user?.metadata?.client) {
      console.warn("Client information not available for image scraping");
      return;
    }

    setScrapingImages(true);
    const loadingToast = toast.loading("Scraping images...", {
      description:
        "This may take a few minutes depending on the number of products",
    });

    try {
      const clientName = user.metadata.client;
      const response = await fetch(
        `http://45.32.156.145:8000/process-client/${encodeURIComponent(clientName)}`,
        {
          method: "POST",
          // Add timeout to prevent hanging
          signal: AbortSignal.timeout(30000), // 30 second timeout
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      toast.success("Images scraped successfully!", {
        id: loadingToast,
        description:
          result.message ||
          "Images have been processed and saved to the database",
        duration: 5000,
      });
    } catch (error) {
      console.error("Error scraping images:", error);

      // Don't show error toast to user since this runs in background
      // Just log it and silently fail
      toast.dismiss(loadingToast);

      // Only show a warning in console, not to user
      console.warn(
        "Image scraping failed silently - this won't affect your product upload"
      );
    } finally {
      setScrapingImages(false);
    }
  };

  // Fetch current batch number for this client
  useEffect(() => {
    async function fetchCurrentBatch() {
      if (!user?.metadata?.client) return;

      startLoading();
      try {
        const { data, error } = await supabase
          .from("onboarding_assets")
          .select("batch")
          .eq("client", user.metadata.client)
          .order("batch", { ascending: false })
          .limit(1);

        if (!error && data && data.length > 0) {
          setCurrentBatch(data[0].batch + 1);
        } else {
          setCurrentBatch(1);
        }
      } catch (error) {
        console.error("Error fetching current batch:", error);
        setCurrentBatch(1);
      } finally {
        setPageLoading(false);
        stopLoading();
      }
    }

    fetchCurrentBatch();
  }, [user?.metadata?.client]);

  const addProduct = () => {
    setProducts([
      ...products,
      {
        article_id: "",
        product_name: "",
        product_link: "",
        glb_link: "",
        category: "",
        subcategory: "",
        priority: 2,
      },
    ]);
  };

  const removeProduct = (index: number) => {
    if (products.length > 1) {
      setProducts(products.filter((_, i) => i !== index));
    }
  };

  const updateProduct = (
    index: number,
    field: keyof ProductForm,
    value: string | number
  ) => {
    const updatedProducts = [...products];
    updatedProducts[index] = { ...updatedProducts[index], [field]: value };
    setProducts(updatedProducts);
  };

  const handleSubmit = async () => {
    if (!user?.metadata?.client) {
      toast.error("User not authenticated");
      return;
    }

    // Validate required fields
    const validProducts = products.filter(
      (product) =>
        product.article_id.trim() &&
        product.product_name.trim() &&
        product.product_link.trim()
    );

    if (validProducts.length === 0) {
      toast.error("Please add at least one product with required fields");
      return;
    }

    setLoading(true);

    // Show loading toast
    const loadingToast = toast.loading("Adding products...", {
      description: `Adding ${validProducts.length} product${validProducts.length === 1 ? "" : "s"} to batch ${currentBatch}`,
    });

    try {
      const productsToInsert = validProducts.map((product) => ({
        client: user.metadata.client,
        batch: currentBatch,
        article_id: product.article_id.trim(),
        product_name: product.product_name.trim(),
        product_link: product.product_link.trim(),
        glb_link: product.glb_link.trim() || null,
        category: product.category.trim() || null,
        subcategory: product.subcategory.trim() || null,
        reference: null, // No reference field in new format
        priority: product.priority,
        status: "not_started",
        delivery_date: null,
      }));

      const { error } = await supabase
        .from("onboarding_assets")
        .insert(productsToInsert);

      if (error) {
        console.error("Error inserting products:", error);
        toast.error("Failed to add products. Please try again.", {
          id: loadingToast,
        });
        return;
      }

      // Send notification to admin users about new product submission
      try {
        await notificationService.sendProductSubmissionNotification({
          client: user.metadata.client,
          batch: currentBatch,
          productCount: validProducts.length,
          productNames: validProducts.map((p) => p.product_name),
          submittedAt: new Date().toISOString(),
        });
      } catch (notificationError) {
        console.error(
          "Failed to send product submission notification:",
          notificationError
        );
        // Don't fail the product submission if notification fails
      }

      // Automatically scrape images in the background (fire and forget)
      scrapeImages().catch((error) => {
        console.warn("Background image scraping failed:", error);
      });

      toast.success(
        ` Successfully added ${validProducts.length} product${validProducts.length === 1 ? "" : "s"} to batch ${currentBatch}!`,
        {
          id: loadingToast,
          description: `Your products are now ready for review. Image scraping will be attempted in the background.`,
          duration: 5000,
        }
      );

      // Reset form
      setProducts([
        {
          article_id: "",
          product_name: "",
          product_link: "",
          glb_link: "",
          category: "",
          subcategory: "",

          priority: 2,
        },
      ]);

      // Increment batch number for next use
      setCurrentBatch((prev) => prev + 1);
    } catch (error) {
      console.error("Error adding products:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    // Create a link to the actual CSV template file
    const a = document.createElement("a");
    a.href = "/csv-template.csv";
    a.download = "product-template.csv";
    a.click();
  };

  const getValidProducts = () => {
    return products.filter(
      (product) =>
        product.article_id.trim() &&
        product.product_name.trim() &&
        product.product_link.trim() &&
        product.category.trim()
    );
  };

  const handleFile = (file: File) => {
    setCsvFile(file);
    setCsvLoading(true);
    setCsvErrors([]);
    setCsvWarnings([]);
    setEditingRow(null);
    setEditedCsvData(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      // Improved CSV parsing with better handling of edge cases
      const rows = text
        .split(/\r?\n/)
        .filter(Boolean)
        .map((row) => {
          // Split by comma but handle quoted fields
          const result = [];
          let current = "";
          let inQuotes = false;

          for (let i = 0; i < row.length; i++) {
            const char = row[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === "," && !inQuotes) {
              result.push(current.trim());
              current = "";
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        });

      // Validate rows for errors and warnings
      const errors: { row: number; message: string }[] = [];
      const warnings: {
        row: number;
        message: string;
        type: "duplicate_article_id" | "missing_fields";
      }[] = [];

      // Check for missing required fields
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row[0] || !row[1] || !row[2] || !row[3]) {
          errors.push({
            row: i + 1,
            message:
              "Missing required fields (Article ID, Product Name, Product Link, GLB Link)",
          });
        }
      }

      // Check for duplicate article IDs
      const articleIds = new Map<string, number[]>();
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const articleId = row[0]?.trim();
        if (articleId) {
          if (!articleIds.has(articleId)) {
            articleIds.set(articleId, []);
          }
          articleIds.get(articleId)!.push(i + 1);
        }
      }

      // Add warnings for duplicate article IDs
      for (const [articleId, rowNumbers] of articleIds.entries()) {
        if (rowNumbers.length > 1) {
          for (const rowNum of rowNumbers) {
            warnings.push({
              row: rowNum,
              message: `Duplicate Article ID: "${articleId}" appears in ${rowNumbers.length} rows`,
              type: "duplicate_article_id",
            });
          }
        }
      }

      setCsvPreview(rows);
      setEditedCsvData([...rows]); // Initialize edited data
      setCsvErrors(errors);
      setCsvWarnings(warnings);
      setCsvLoading(false);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const startEditing = (rowIndex: number) => {
    setEditingRow(rowIndex);
  };

  const saveEdit = (rowIndex: number, columnIndex: number, value: string) => {
    if (!editedCsvData) return;

    const newData = [...editedCsvData];
    newData[rowIndex][columnIndex] = value;
    setEditedCsvData(newData);

    // Update csvPreview to reflect changes
    setCsvPreview(newData);

    // Re-validate after edit
    validateCsvData(newData);
  };

  const cancelEdit = () => {
    setEditingRow(null);
    // Restore original data
    if (csvPreview) {
      setEditedCsvData([...csvPreview]);
    }
  };

  const validateCsvData = (data: string[][]) => {
    const errors: { row: number; message: string }[] = [];
    const warnings: {
      row: number;
      message: string;
      type: "duplicate_article_id" | "missing_fields";
    }[] = [];

    // Check for missing required fields
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0] || !row[1] || !row[2] || !row[3]) {
        errors.push({
          row: i + 1,
          message:
            "Missing required fields (Article ID, Product Name, Product Link, GLB Link)",
        });
      }
    }

    // Check for duplicate article IDs
    const articleIds = new Map<string, number[]>();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const articleId = row[0]?.trim();
      if (articleId) {
        if (!articleIds.has(articleId)) {
          articleIds.set(articleId, []);
        }
        articleIds.get(articleId)!.push(i + 1);
      }
    }

    // Add warnings for duplicate article IDs
    for (const [articleId, rowNumbers] of articleIds.entries()) {
      if (rowNumbers.length > 1) {
        for (const rowNum of rowNumbers) {
          warnings.push({
            row: rowNum,
            message: `Duplicate Article ID: "${articleId}" appears in ${rowNumbers.length} rows`,
            type: "duplicate_article_id",
          });
        }
      }
    }

    setCsvErrors(errors);
    setCsvWarnings(warnings);
  };

  const handleCsvUpload = async () => {
    if (!csvPreview || !user?.metadata?.client) return;

    setLoading(true);
    const client = user.metadata.client;
    // Use edited data if available, otherwise use original preview
    const dataToUpload = editedCsvData || csvPreview;
    const rows = dataToUpload.slice(1); // skip header

    // Show initial loading toast
    const loadingToast = toast.loading("Preparing products for upload...", {
      description: "Validating and processing your CSV data",
    });

    // Prepare all valid products for batch insert
    const productsToInsert = [];
    let failCount = 0;

    for (const row of rows) {
      // Skip empty rows (check first 4 required fields)
      if (
        !row[0]?.trim() &&
        !row[1]?.trim() &&
        !row[2]?.trim() &&
        !row[3]?.trim()
      ) {
        continue;
      }

      const [
        article_id,
        product_name,
        product_link,
        glb_link,
        category,
        subcategory,
      ] = row;

      // Validate required fields
      if (
        !article_id?.trim() ||
        !product_name?.trim() ||
        !product_link?.trim() ||
        !glb_link?.trim()
      ) {
        failCount++;
        continue;
      }

      // Add to batch insert array
      productsToInsert.push({
        client,
        batch: currentBatch,
        article_id: article_id.trim(),
        product_name: product_name.trim(),
        product_link: product_link.trim(),
        glb_link: glb_link.trim(), // Use the actual glb_link from CSV
        category: category?.trim() || null,
        subcategory: subcategory?.trim() || null,
        reference: null, // No reference column in new format
        priority: 2, // Default priority since not in template
        status: "not_started",
        delivery_date: null,
      });
    }

    // Update loading toast
    toast.loading("Uploading products to database...", {
      id: loadingToast,
      description: `Uploading ${productsToInsert.length} products`,
    });

    // Batch insert all products at once
    let successCount = 0;
    if (productsToInsert.length > 0) {
      const { error } = await supabase
        .from("onboarding_assets")
        .insert(productsToInsert);

      if (error) {
        console.error("Error batch inserting products:", error);
        toast.error("Failed to upload products. Please try again.", {
          id: loadingToast,
        });
        setLoading(false);
        return;
      }
      successCount = productsToInsert.length;
    }

    setLoading(false);
    setCsvFile(null);
    setCsvPreview(null);
    setCsvErrors([]);
    setCsvWarnings([]);
    setEditingRow(null);
    setEditedCsvData(null);
    setShowPreviewDialog(false); // Close the preview dialog after upload
    resetFileInput();

    if (successCount > 0) {
      // Send notification to admin users about new product submission via CSV
      try {
        const dataToUpload = editedCsvData || csvPreview;
        const rows = dataToUpload.slice(1); // skip header
        const productNames = rows
          .filter((row) => row[1]?.trim()) // filter rows with product names
          .map((row) => row[1].trim())
          .slice(0, successCount); // only include successful uploads

        await notificationService.sendProductSubmissionNotification({
          client: user.metadata.client,
          batch: currentBatch,
          productCount: successCount,
          productNames: productNames,
          submittedAt: new Date().toISOString(),
        });
      } catch (notificationError) {
        console.error(
          "Failed to send CSV product submission notification:",
          notificationError
        );
        // Don't fail the product submission if notification fails
      }

      // Automatically scrape images in the background (fire and forget)
      scrapeImages().catch((error) => {
        console.warn("Background image scraping failed:", error);
      });

      toast.success(
        `🎉 Successfully uploaded ${successCount} product${successCount === 1 ? "" : "s"}!`,
        {
          id: loadingToast,
          description: `Your products have been added to batch ${currentBatch} and are ready for review. Image scraping will be attempted in the background.`,
          duration: 5000,
        }
      );
      // Increment batch number for next use
      setCurrentBatch((prev) => prev + 1);
    }
    if (failCount > 0) {
      toast.error(`${failCount} rows failed to upload.`);
    }
  };

  if (!user) {
    return null;
  }

  const AddProductsSkeleton = () => (
    <div className="h-full bg-gradient-to-br from-background via-background to-muted/20 flex flex-col p-6">
      {/* Header Skeleton */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="h-8 w-8 bg-muted rounded animate-pulse" />
          <div>
            <div className="h-8 w-48 bg-muted rounded animate-pulse mb-2" />
            <div className="h-4 w-64 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-6 w-20 bg-muted rounded animate-pulse" />
          <div className="h-4 w-48 bg-muted rounded animate-pulse" />
        </div>
      </div>

      <div className="flex-1 flex gap-6">
        {/* Main Form Skeleton */}
        <div className="flex-1">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 bg-muted rounded animate-pulse" />
                <div className="h-6 w-32 bg-muted rounded animate-pulse" />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="h-5 w-24 bg-muted rounded animate-pulse" />
                    <div className="h-6 w-16 bg-muted rounded animate-pulse" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <div key={j}>
                        <div className="h-4 w-20 bg-muted rounded animate-pulse mb-2" />
                        <div className="h-10 w-full bg-muted rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="h-4 w-24 bg-muted rounded animate-pulse mb-2" />
                    <div className="h-10 w-full bg-muted rounded animate-pulse" />
                  </div>
                  <div>
                    <div className="h-4 w-20 bg-muted rounded animate-pulse mb-2" />
                    <div className="h-10 w-full bg-muted rounded animate-pulse" />
                  </div>
                </div>
              ))}
              <div className="h-10 w-full bg-muted rounded animate-pulse" />
              <div className="h-10 w-full bg-muted rounded animate-pulse" />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Skeleton */}
        <div className="w-80 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 bg-muted rounded animate-pulse" />
                <div className="h-6 w-24 bg-muted rounded animate-pulse" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 dark:border-primary rounded-lg p-6 text-center">
                <div className="h-8 w-8 bg-muted rounded animate-pulse mx-auto mb-2" />
                <div className="h-4 w-32 bg-muted rounded animate-pulse mx-auto mb-1" />
                <div className="h-3 w-24 bg-muted rounded animate-pulse mx-auto mb-3" />
                <div className="h-8 w-24 bg-muted rounded animate-pulse mx-auto" />
              </div>
              <div className="h-10 w-full bg-muted rounded animate-pulse" />
              <div className="pt-4 border-t border-slate-200 dark:border-primary">
                <div className="h-3 w-48 bg-muted rounded animate-pulse mb-3" />
                <div className="h-8 w-full bg-muted rounded animate-pulse" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 bg-muted rounded animate-pulse" />
                <div className="h-6 w-32 bg-muted rounded animate-pulse" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="h-4 w-24 bg-muted rounded animate-pulse mb-2" />
                <div className="h-8 w-16 bg-muted rounded animate-pulse" />
              </div>
              <div>
                <div className="h-4 w-28 bg-muted rounded animate-pulse mb-2" />
                <div className="h-8 w-20 bg-muted rounded animate-pulse" />
              </div>
              <div className="h-3 w-48 bg-muted rounded animate-pulse" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );

  if (pageLoading) {
    return <AddProductsSkeleton />;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/client-review")}
            className="hover:bg-primary/8 transition-all duration-200 rounded-lg cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </Button>
          <Badge variant="outline" className="text-sm">
            Batch #{currentBatch}
          </Badge>
        </div>
      </div>

      <div className="flex-1 flex gap-6">
        {/* Main Form */}
        <div className="flex-1 overflow-y-auto max-h-[calc(100vh-15rem)]">
          <Card className="h-fit shadow-none border-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Product Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {products.map((product, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Product {index + 1}</h3>
                    {products.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeProduct(index)}
                        className="text-error hover:text-error/80 hover:bg-error-muted cursor-pointer"
                      >
                        Remove
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                        Article ID *
                      </Label>
                      <Input
                        value={product.article_id}
                        onChange={(e) =>
                          updateProduct(index, "article_id", e.target.value)
                        }
                        placeholder="ART001"
                      />
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                        Product Name *
                      </Label>
                      <Input
                        value={product.product_name}
                        onChange={(e) =>
                          updateProduct(index, "product_name", e.target.value)
                        }
                        placeholder="Product Name"
                      />
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                        Product Link *
                      </Label>
                      <Input
                        value={product.product_link}
                        onChange={(e) =>
                          updateProduct(index, "product_link", e.target.value)
                        }
                        placeholder="https://example.com/product"
                      />
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                        GLB Link
                      </Label>
                      <Input
                        value={product.glb_link}
                        onChange={(e) =>
                          updateProduct(index, "glb_link", e.target.value)
                        }
                        placeholder="https://example.com/model.glb"
                      />
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                        Category *
                      </Label>
                      <Input
                        value={product.category}
                        required={true}
                        onChange={(e) =>
                          updateProduct(index, "category", e.target.value)
                        }
                        placeholder="Furniture"
                      />
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                        Subcategory
                      </Label>
                      <Input
                        value={product.subcategory}
                        onChange={(e) =>
                          updateProduct(index, "subcategory", e.target.value)
                        }
                        placeholder="Chairs"
                        className="cursor-pointer"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Priority
                    </Label>
                    <Select
                      value={product.priority.toString()}
                      onValueChange={(value) =>
                        updateProduct(index, "priority", parseInt(value))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 - Highest Priority</SelectItem>
                        <SelectItem value="2">2 - Medium Priority</SelectItem>
                        <SelectItem value="3">3 - Lowest Priority</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      1 = Highest priority, 3 = Lowest priority
                    </p>
                  </div>
                </div>
              ))}

              <Button
                onClick={addProduct}
                variant="outline"
                className="w-full cursor-pointer"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another Product
              </Button>

              <div className="flex gap-4 pt-4">
                <Button
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={loading || getValidProducts().length === 0}
                  className="flex-1 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Adding Products...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Add Products to Batch {currentBatch}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="w-80 space-y-6">
          {/* CSV Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                CSV Upload
                {csvWarnings.length > 0 && (
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground mb-2">
                Upload a CSV to add multiple products at once.
              </div>
              {/* Drag & Drop Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
                  isDragOver
                    ? "border-primary bg-primary/5"
                    : "border-slate-300 dark:border-primary hover:border-slate-400"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileInput}
                  className="hidden"
                />

                {csvLoading ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Processing CSV...
                    </p>
                  </div>
                ) : csvFile ? (
                  <div className="flex flex-col items-center">
                    <CheckCircle className="h-8 w-8 text-green-500 mb-2" />
                    <p className="text-sm font-medium text-primary">
                      {csvFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {csvPreview
                        ? `${csvPreview.length - 1} products ready to upload`
                        : "Processing..."}
                    </p>
                    {csvWarnings.length > 0 && (
                      <p className="text-xs text-amber-600 font-medium mt-1">
                        ⚠️{" "}
                        {
                          csvWarnings.filter(
                            (w) => w.type === "duplicate_article_id"
                          ).length
                        }{" "}
                        duplicate Article IDs detected
                      </p>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCsvFile(null);
                        setCsvPreview(null);
                        setCsvErrors([]);
                        setCsvWarnings([]);
                        setEditingRow(null);
                        setEditedCsvData(null);
                        resetFileInput();
                      }}
                      className="mt-2 cursor-pointer"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Upload className="h-8 w-8 text-slate-400 mb-2" />
                    <p className="text-sm font-medium text-primary mb-1">
                      Drop CSV file here
                    </p>
                    <p className="text-xs text-muted-foreground mb-3">
                      or click to browse
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="cursor-pointer"
                    >
                      Choose File
                    </Button>
                  </div>
                )}
              </div>

              {/* Preview and Upload Buttons */}
              {csvPreview && csvPreview.length > 1 && (
                <div className="space-y-3">
                  <Button
                    onClick={() => setShowPreviewDialog(true)}
                    variant="outline"
                    className="w-full cursor-pointer"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Preview {csvPreview.length - 1} Products
                  </Button>

                  <Button
                    onClick={handleCsvUpload}
                    disabled={loading}
                    className="w-full cursor-pointer"
                    title={
                      csvWarnings.length > 0
                        ? "Warning: Some products have duplicate Article IDs"
                        : ""
                    }
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload {csvPreview.length - 1} Products
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Template Download */}
              <div className="pt-4 border-t border-slate-200 dark:border-primary">
                <p className="text-sm text-muted-foreground mb-3">
                  Download the CSV template to format your data
                </p>
                <Button
                  onClick={downloadTemplate}
                  variant="outline"
                  size="sm"
                  className="w-full cursor-pointer"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Batch Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Batch Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Batch
                </p>
                <p className="text-2xl font-bold text-primary">
                  {currentBatch}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Products in Form
                </p>
                <p className="text-2xl font-bold text-primary">
                  {products.length}
                </p>
              </div>
              <div className="text-xs text-muted-foreground">
                Products will be automatically assigned to batch {currentBatch}{" "}
                when added
              </div>
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                <p>Fill in the required fields (marked with *)</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                <p>Optional fields can be left empty</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CSV Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="min-w-[70vw] max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              CSV Preview ({csvPreview?.length ? csvPreview.length - 1 : 0}{" "}
              products)
              {editedCsvData && (
                <Badge variant="outline" className="text-xs">
                  Editable
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {csvPreview?.length
                ? `${csvPreview.length - 1} products found. Please review before confirming.`
                : ""}
            </span>
            <div className="flex items-center gap-2">
              {editedCsvData && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditedCsvData([...csvPreview!]);
                    setEditingRow(null);
                    validateCsvData(csvPreview!);
                  }}
                  className="cursor-pointer"
                  title="Reset all changes to original values"
                >
                  Reset Changes
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCsvFile(null);
                  setCsvPreview(null);
                  setCsvErrors([]);
                  setCsvWarnings([]);
                  setEditingRow(null);
                  setEditedCsvData(null);
                  setShowPreviewDialog(false);
                  resetFileInput();
                }}
                className="cursor-pointer"
              >
                <X className="h-4 w-4 mr-1" />
                Remove file & re-upload
              </Button>
            </div>
          </div>
          {csvErrors.length > 0 && (
            <Alert variant="destructive" className="mb-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex items-center gap-2">
                <span>Some rows are missing required fields.</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!csvPreview) return;
                    const errorCsv = [
                      csvPreview[0],
                      ...csvErrors.map((e) => [e.row, e.message]),
                    ]
                      .map((r) => r.join(","))
                      .join("\n");
                    const blob = new Blob([errorCsv], { type: "text/csv" });
                    saveAs.saveAs(blob, "csv-errors.csv");
                  }}
                >
                  Download error report
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {csvWarnings.length > 0 && (
            <Alert
              variant="default"
              className="mb-2 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800"
            >
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="flex items-center gap-2">
                <span>
                  Some rows have duplicate Article IDs. Please review before
                  proceeding.
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!csvPreview) return;
                    const warningCsv = [
                      csvPreview[0],
                      ...csvWarnings.map((w) => [w.row, w.message]),
                    ]
                      .map((r) => r.join(","))
                      .join("\n");
                    const blob = new Blob([warningCsv], { type: "text/csv" });
                    saveAs.saveAs(blob, "csv-warnings.csv");
                  }}
                >
                  Download warning report
                </Button>
              </AlertDescription>
            </Alert>
          )}
          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Article ID</TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Product Link</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvPreview?.slice(1).map((row, index) => {
                    const [
                      articleId,
                      productName,
                      productLink,
                      category,
                      subcategory,
                    ] = row;
                    const hasError = csvErrors.some((e) => e.row === index + 2);
                    const hasWarning = csvWarnings.some(
                      (w) => w.row === index + 2
                    );
                    const rowClassName = hasError
                      ? "bg-red-50"
                      : hasWarning
                        ? "bg-amber-50 dark:bg-amber-950/20"
                        : "";
                    const isEditing = editingRow === index;

                    return (
                      <TableRow key={index} className={rowClassName}>
                        <TableCell className="font-medium">
                          {isEditing ? (
                            <Input
                              value={
                                editedCsvData?.[index + 1]?.[0] ||
                                articleId ||
                                ""
                              }
                              onChange={(e) =>
                                saveEdit(index + 1, 0, e.target.value)
                              }
                              className="h-8 text-sm"
                              placeholder="Article ID"
                            />
                          ) : (
                            articleId || "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              value={
                                editedCsvData?.[index + 1]?.[1] ||
                                productName ||
                                ""
                              }
                              onChange={(e) =>
                                saveEdit(index + 1, 1, e.target.value)
                              }
                              className="h-8 text-sm"
                              placeholder="Product Name"
                            />
                          ) : (
                            productName || "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              value={
                                editedCsvData?.[index + 1]?.[2] ||
                                productLink ||
                                ""
                              }
                              onChange={(e) =>
                                saveEdit(index + 1, 2, e.target.value)
                              }
                              className="h-8 text-sm"
                              placeholder="Product Link"
                            />
                          ) : (
                            <div className="flex items-center">
                              {productLink ? (
                                <a
                                  href={productLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-info hover:text-info/80 underline truncate block max-w-48"
                                  title={productLink}
                                >
                                  {productLink.length > 50
                                    ? `${productLink.substring(0, 50)}...`
                                    : productLink}
                                </a>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <div className="space-y-1">
                              <Input
                                value={
                                  editedCsvData?.[index + 1]?.[4] ||
                                  category ||
                                  ""
                                }
                                onChange={(e) =>
                                  saveEdit(index + 1, 4, e.target.value)
                                }
                                className="h-8 text-sm"
                                placeholder="Category"
                              />
                              <Input
                                value={
                                  editedCsvData?.[index + 1]?.[5] ||
                                  subcategory ||
                                  ""
                                }
                                onChange={(e) =>
                                  saveEdit(index + 1, 5, e.target.value)
                                }
                                className="h-8 text-sm"
                                placeholder="Subcategory"
                              />
                            </div>
                          ) : (
                            <div>
                              <span className="font-medium">
                                {category || "-"}
                              </span>
                              {subcategory && (
                                <span className="text-xs text-muted-foreground block">
                                  {subcategory}
                                </span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isEditing ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setEditingRow(null)}
                                  className="h-6 px-2 text-xs"
                                >
                                  Done
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={cancelEdit}
                                  className="h-6 px-2 text-xs text-muted-foreground"
                                >
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => startEditing(index)}
                                className="h-6 px-2 text-xs"
                              >
                                Edit
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 mt-4 items-center">
            <Button
              variant="outline"
              onClick={() => setShowPreviewDialog(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCsvUpload}
              disabled={loading || csvErrors.length > 0}
              className="cursor-pointer"
              title={
                csvWarnings.length > 0
                  ? "Warning: Some products have duplicate Article IDs"
                  : ""
              }
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Confirming...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm & Add to Batch {currentBatch}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Products Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="min-w-[70vw] max-h-[calc(74vh-15rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Review Products Before Adding to Batch {currentBatch}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto min-h-[calc(74vh-15rem)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Article ID</TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Product Link</TableHead>
                    <TableHead>GLB Link</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Priority</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getValidProducts().map((product, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {product.article_id || "-"}
                      </TableCell>
                      <TableCell>
                        <div
                          className="truncate  cursor-help"
                          title={product.product_name || "-"}
                        >
                          {product.product_name &&
                          product.product_name.length > 25
                            ? product.product_name.substring(0, 25) + "..."
                            : product.product_name || "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {product.product_link ? (
                          <a
                            href={product.product_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-info hover:text-info/80 underline truncate block max-w-48"
                            title={product.product_link}
                          >
                            {product.product_link.length > 50
                              ? `${product.product_link.substring(0, 50)}...`
                              : product.product_link}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {product.glb_link ? (
                          <a
                            href={product.glb_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-info hover:text-info/80 underline truncate block max-w-48"
                            title={product.glb_link}
                          >
                            {product.glb_link.length > 50
                              ? `${product.glb_link.substring(0, 50)}...`
                              : product.glb_link}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">
                            {product.category || "-"}
                          </span>
                          {product.subcategory && (
                            <span className="text-xs text-muted-foreground block">
                              {product.subcategory}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            product.priority === 1
                              ? "destructive"
                              : product.priority === 2
                                ? "secondary"
                                : product.priority === 3
                                  ? "default"
                                  : "outline"
                          }
                          className="text-xs"
                        >
                          {product.priority}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex  justify-end gap-3 pt-4 border-t border-border max-h-[100px] items-center">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowConfirmDialog(false);
                handleSubmit();
              }}
              disabled={loading}
              className="cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Confirming...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm & Add to Batch {currentBatch}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
