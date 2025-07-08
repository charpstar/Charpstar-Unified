"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/useUser";
import { supabase } from "@/lib/supabaseClient";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Input, Textarea } from "@/components/ui/inputs";
import { Badge } from "@/components/ui/feedback";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeletons";
import { useLoading } from "@/contexts/LoadingContext";
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
} from "lucide-react";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        toast.error("Failed to add products. Please try again.");
        return;
      }

      toast.success(
        `Successfully added ${validProducts.length} product(s) to batch ${currentBatch}!`
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

  const handleFile = (file: File) => {
    setCsvFile(file);
    setCsvLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      // Simple CSV parsing (no quotes/escapes)
      const rows = text
        .split(/\r?\n/)
        .filter(Boolean)
        .map((row) => row.split(","));
      setCsvPreview(rows);
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

  const handleCsvUpload = async () => {
    if (!csvPreview || !user?.metadata?.client) return;

    setLoading(true);
    const client = user.metadata.client;
    const rows = csvPreview.slice(1); // skip header
    let successCount = 0;
    let failCount = 0;

    for (const row of rows) {
      if (!row[0] && !row[1] && !row[2]) continue; // skip empty rows
      const [
        article_id,
        product_name,
        product_link,
        category,
        subcategory,
        priority,
      ] = row;

      const { error } = await supabase.from("onboarding_assets").insert({
        client,
        batch: currentBatch,
        article_id,
        product_name,
        product_link,
        glb_link: product_link || null, // product_link column contains the GLB link
        category: category || null,
        subcategory: subcategory || null,
        reference: null, // No reference column in new format
        priority: priority ? parseInt(priority) || 2 : 2,
        status: "not_started",
        delivery_date: null,
      });

      if (error) failCount++;
      else successCount++;
    }

    setLoading(false);
    setCsvFile(null);
    setCsvPreview(null);

    if (successCount > 0) {
      toast.success(`Successfully uploaded ${successCount} products!`);
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
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
                <div className="h-8 w-8 bg-muted rounded animate-pulse mx-auto mb-2" />
                <div className="h-4 w-32 bg-muted rounded animate-pulse mx-auto mb-1" />
                <div className="h-3 w-24 bg-muted rounded animate-pulse mx-auto mb-3" />
                <div className="h-8 w-24 bg-muted rounded animate-pulse mx-auto" />
              </div>
              <div className="h-10 w-full bg-muted rounded animate-pulse" />
              <div className="pt-4 border-t border-slate-200">
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
    <div className="h-full bg-gradient-to-br from-background via-background to-muted/20 flex flex-col p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/review")}
            className="hover:bg-slate-100/60 transition-all duration-200 rounded-xl cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Add Products</h1>
            <p className="text-slate-600">
              Add new products to your asset library
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-sm">
            Batch #{currentBatch}
          </Badge>
          <span className="text-sm text-slate-500">
            Products will be added to batch {currentBatch}
          </span>
        </div>
      </div>

      <div className="flex-1 flex gap-6">
        {/* Main Form */}
        <div className="flex-1">
          <Card className="h-full">
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
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                      >
                        Remove
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-2 block">
                        Article ID *
                      </label>
                      <Input
                        value={product.article_id}
                        onChange={(e) =>
                          updateProduct(index, "article_id", e.target.value)
                        }
                        placeholder="ART001"
                        className="cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-2 block">
                        Product Name *
                      </label>
                      <Input
                        value={product.product_name}
                        onChange={(e) =>
                          updateProduct(index, "product_name", e.target.value)
                        }
                        placeholder="Product Name"
                        className="cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-2 block">
                        Product Link *
                      </label>
                      <Input
                        value={product.product_link}
                        onChange={(e) =>
                          updateProduct(index, "product_link", e.target.value)
                        }
                        placeholder="https://example.com/product"
                        className="cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-2 block">
                        GLB Link
                      </label>
                      <Input
                        value={product.glb_link}
                        onChange={(e) =>
                          updateProduct(index, "glb_link", e.target.value)
                        }
                        placeholder="https://example.com/model.glb"
                        className="cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-2 block">
                        Category
                      </label>
                      <Input
                        value={product.category}
                        onChange={(e) =>
                          updateProduct(index, "category", e.target.value)
                        }
                        placeholder="Furniture"
                        className="cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-2 block">
                        Subcategory
                      </label>
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
                    <label className="text-sm font-medium text-slate-700 mb-2 block">
                      Priority (1-3)
                    </label>
                    <Input
                      type="number"
                      min="1"
                      max="3"
                      value={product.priority}
                      onChange={(e) =>
                        updateProduct(
                          index,
                          "priority",
                          parseInt(e.target.value) || 2
                        )
                      }
                      placeholder="2"
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-slate-500 mt-1">
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
                  onClick={handleSubmit}
                  disabled={loading}
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
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Drag & Drop Zone */}
              <div
                ref={fileInputRef}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
                  isDragOver
                    ? "border-primary bg-primary/5"
                    : "border-slate-300 hover:border-slate-400"
                }`}
              >
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileInput}
                  className="hidden"
                />

                {csvLoading ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                    <p className="text-sm text-slate-600">Processing CSV...</p>
                  </div>
                ) : csvFile ? (
                  <div className="flex flex-col items-center">
                    <CheckCircle className="h-8 w-8 text-green-500 mb-2" />
                    <p className="text-sm font-medium text-slate-900">
                      {csvFile.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {csvPreview
                        ? `${csvPreview.length - 1} products ready to upload`
                        : "Processing..."}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCsvFile(null);
                        setCsvPreview(null);
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
                    <p className="text-sm font-medium text-slate-900 mb-1">
                      Drop CSV file here
                    </p>
                    <p className="text-xs text-slate-500 mb-3">
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

              {/* Upload Button */}
              {csvPreview && (
                <Button
                  onClick={handleCsvUpload}
                  disabled={loading}
                  className="w-full cursor-pointer"
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
              )}

              {/* Template Download */}
              <div className="pt-4 border-t border-slate-200">
                <p className="text-sm text-slate-600 mb-3">
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
                <p className="text-sm font-medium text-slate-700">
                  Current Batch
                </p>
                <p className="text-2xl font-bold text-primary">
                  {currentBatch}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">
                  Products in Form
                </p>
                <p className="text-2xl font-bold text-slate-900">
                  {products.length}
                </p>
              </div>
              <div className="text-xs text-slate-500">
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
            <CardContent className="space-y-3 text-sm text-slate-600">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                <p>Fill in the required fields (marked with *)</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                <p>Optional fields can be left empty</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                <p>Products will be added to the current batch number</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                <p>Batch number auto-increments after each submission</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
