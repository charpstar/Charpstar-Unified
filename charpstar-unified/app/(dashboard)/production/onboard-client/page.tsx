"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/containers";
import { Input } from "@/components/ui/inputs";
import { Label } from "@/components/ui/display";
import { Textarea } from "@/components/ui/inputs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/display";
import { Switch } from "@/components/ui/inputs";
import { useUser } from "@/contexts/useUser";
import { createClient } from "@/utils/supabase/client";
import { toast } from "@/components/ui/utilities";
import {
  Loader2,
  Copy,
  Download,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Building2,
  Upload,
  FileText,
} from "lucide-react";

interface Client {
  id: string;
  name: string;
  email: string;
  role: string;
  client: string;
  created_at: string;
}

interface ConvertedData {
  article_id: string;
  product_name: string;
  product_link: string;
  cad_file_link: string;
  category: string;
  subcategory: string;
  glb_link?: string;
  active?: boolean;
}

export default function OnboardClientPage() {
  const user = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [spreadsheetData, setSpreadsheetData] = useState("");
  const [convertedData, setConvertedData] = useState<ConvertedData[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingClient, setIsLoadingClient] = useState(true);
  const [bunnyStoragePath, setBunnyStoragePath] = useState("");
  const [bunnyGeneratedUrls, setBunnyGeneratedUrls] = useState<string[]>([]);
  const [useCustomStorage, setUseCustomStorage] = useState(false);
  const [customStorageUrl, setCustomStorageUrl] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isProcessingCsv, setIsProcessingCsv] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);

  // Reset all form state
  const resetForm = () => {
    setSpreadsheetData("");
    setConvertedData([]);
    setBunnyGeneratedUrls([]);
    setBunnyStoragePath("");
    setCustomStorageUrl("");
    setUseCustomStorage(false);
    setCsvFile(null);
    setIsConverting(false);
    setIsProcessingCsv(false);
    setIsUploading(false);

    // 🔥 Reset the actual <input type="file"> value
    const fileInput = document.getElementById("csv-upload") as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  useEffect(() => {
    const clientId = searchParams.get("clientId");
    // const clientName = searchParams.get("clientName"); // Not currently used

    if (!clientId) {
      router.push("/production/clients");
      return;
    }

    fetchClient(clientId);
  }, [searchParams, router]);

  const fetchClient = async (clientId: string) => {
    try {
      const response = await fetch(`/api/production/client-users`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch client details");
      }

      // Find the specific client user by ID
      const clientUser = result.clients.find(
        (user: any) => user.id === clientId
      );

      if (!clientUser) {
        throw new Error("Client user not found");
      }

      setClient(clientUser);
    } catch (error: any) {
      console.error("Error fetching client:", error);
      toast({
        title: "Error",
        description: "Failed to fetch client details",
        variant: "destructive",
      });
      router.push("/production/clients");
    } finally {
      setIsLoadingClient(false);
    }
  };

  // Check if user is admin or production
  if (
    user?.metadata?.role !== "admin" &&
    user?.metadata?.role !== "production"
  ) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-2xl font-semibold mb-2">Access Denied</h2>
              <p className="text-muted-foreground">
                You don&apos;t have permission to access this page.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoadingClient) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading client...</span>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-2xl font-semibold mb-2">Client Not Found</h2>
              <p className="text-muted-foreground">
                The selected client could not be found.
              </p>
              <Button
                onClick={() => router.push("/production/clients")}
                className="mt-4"
              >
                Back to Clients
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const convertSpreadsheetToCSV = async () => {
    // Check if we have CSV file to process
    if (csvFile) {
      await processCsvFile();
      return;
    }

    if (!spreadsheetData.trim()) {
      toast({
        title: "Error",
        description: "Please paste spreadsheet data or upload a CSV file",
        variant: "destructive",
      });
      return;
    }

    setIsConverting(true);

    try {
      // Add timeout to prevent infinite hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch("/api/production/convert-spreadsheet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          spreadsheetData: spreadsheetData,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Conversion failed");
      }

      setConvertedData(result.data);
      // Clear any existing generated URLs since we have new data
      setBunnyGeneratedUrls([]);
      toast({
        title: "Success",
        description: `Converted ${result.data.length} rows to CSV format`,
      });
    } catch (error: any) {
      console.error("💥 Error converting data:", error);

      let errorMessage = "Failed to convert spreadsheet data";
      if (error.name === "AbortError") {
        errorMessage = "Request timed out. Please try again.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsConverting(false);
    }
  };

  const downloadCSV = () => {
    if (convertedData.length === 0) return;

    const csvContent = [
      "Article ID,Product Name,Product Link,CAD/File Link,Category,Subcategory,GLB Link,Active",
      ...convertedData.map(
        (row) =>
          `"${row.article_id}","${row.product_name}","${row.product_link}","${row.cad_file_link}","${row.category}","${row.subcategory}","${row.glb_link || ""}","${row.active !== undefined ? row.active : true}"`
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${client.name}-assets.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const showPreview = () => {
    if (convertedData.length === 0) {
      toast({
        title: "Error",
        description: "No converted data to upload",
        variant: "destructive",
      });
      return;
    }
    setShowPreviewDialog(true);
  };

  const uploadToOnboardingAssets = async () => {
    setShowPreviewDialog(false);

    setIsUploading(true);
    try {
      const supabase = await createClient();

      // Prepare data for onboarding_assets table
      const assetsToUpload = convertedData.map((item, index) => ({
        client: client?.client || "",
        article_id: item.article_id,
        product_name: item.product_name,
        product_link: item.product_link,
        glb_link: item.glb_link || null, // Use Bunny CDN URL if available
        category: item.category,
        subcategory: item.subcategory || null,
        reference: null,
        status: "not_started" as const,
        delivery_date: null,
        batch: 1,
        priority: 1, // Default to highest priority
        revision_count: 0,
        preview_images: null,
        cad_file_link: item.cad_file_link || null,
        new_upload: true,
        subcategory_missing:
          !item.subcategory || item.subcategory.trim() === "",
        upload_order: index + 1,
        pricing_option_id: null,
        price: 0,
        pricing_comment: null,
        tags: null,
        transferred: false,
        active: item.active !== undefined ? item.active : true, // Default to true if not specified
      }));

      const { error } = await supabase
        .from("onboarding_assets")
        .insert(assetsToUpload)
        .select();

      if (error) {
        console.error("❌ Upload error:", error);
        throw error;
      }

      toast({
        title: "Success",
        description: `Uploaded ${assetsToUpload.length} assets to onboarding system`,
      });

      // Clear the converted data after successful upload
      setConvertedData([]);
      setSpreadsheetData("");
      setCsvFile(null);
    } catch (error: any) {
      console.error("💥 Error uploading assets:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload assets",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const generateBunnyUrls = () => {
    if (convertedData.length === 0) {
      toast({
        title: "Error",
        description:
          "No data available. Please convert spreadsheet data or upload a CSV file first.",
        variant: "destructive",
      });
      return;
    }

    let generatedUrls: string[] = [];

    if (useCustomStorage) {
      // Custom storage URL
      if (!customStorageUrl.trim()) {
        toast({
          title: "Error",
          description: "Please enter a custom storage URL",
          variant: "destructive",
        });
        return;
      }

      // Extract base URL and path from custom URL
      // Example: https://mm.charpstar.net/Android/LCEGOT206.glb
      // Extract: https://mm.charpstar.net/Android/
      const urlParts = customStorageUrl.split("/");
      const baseUrl = urlParts.slice(0, 3).join("/"); // https://mm.charpstar.net
      const path = urlParts.slice(3, -1).join("/"); // Android

      generatedUrls = convertedData.map((item) => {
        const cleanArticleId = item.article_id.replace(/[^a-zA-Z0-9-_]/g, "");
        return `${baseUrl}/${path}/${cleanArticleId}.glb`;
      });
    } else {
      // Bunny CDN
      if (!bunnyStoragePath.trim()) {
        toast({
          title: "Error",
          description: "Please enter a storage path",
          variant: "destructive",
        });
        return;
      }

      const baseUrl = "https://maincdn.b-cdn.net";
      generatedUrls = convertedData.map((item) => {
        const cleanArticleId = item.article_id.replace(/[^a-zA-Z0-9-_]/g, "");
        return `${baseUrl}/${bunnyStoragePath}/${cleanArticleId}.glb`;
      });
    }

    setBunnyGeneratedUrls(generatedUrls);

    toast({
      title: "Success",
      description: `Generated ${generatedUrls.length} ${useCustomStorage ? "custom storage" : "Bunny CDN"} URLs`,
    });
  };

  const updateAssetsWithBunnyUrls = () => {
    if (bunnyGeneratedUrls.length === 0) {
      toast({
        title: "Error",
        description: "No generated URLs available. Please generate URLs first.",
        variant: "destructive",
      });
      return;
    }

    if (convertedData.length === 0) {
      toast({
        title: "Error",
        description: "No data available to apply URLs to.",
        variant: "destructive",
      });
      return;
    }

    const updatedData = convertedData.map((item, index) => ({
      ...item,
      glb_link: bunnyGeneratedUrls[index] || item.glb_link,
    }));

    setConvertedData(updatedData);

    // Clear the generated URLs since they're now applied
    setBunnyGeneratedUrls([]);

    toast({
      title: "Success",
      description: `Applied ${useCustomStorage ? "custom storage" : "Bunny CDN"} URLs to ${updatedData.length} assets. URLs will be included when you upload to onboarding.`,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Text copied to clipboard",
    });
  };

  const downloadTemplate = () => {
    const templateData = [
      "Article ID,Product Name,Product Link,CAD/File Link,Category,Subcategory,GLB Link,Active",
      "EXAMPLE-001,Sample Product 1,https://example.com/product1,https://example.com/cad1,Furniture,Chairs,https://cdn.example.com/models/EXAMPLE-001.glb,true",
      "EXAMPLE-002,Sample Product 2,https://example.com/product2,https://example.com/cad2,Furniture,Tables,https://cdn.example.com/models/EXAMPLE-002.glb,true",
      "EXAMPLE-003,Sample Product 3,https://example.com/product3,https://example.com/cad3,Lighting,Floor Lamps,https://cdn.example.com/models/EXAMPLE-003.glb,false",
    ].join("\n");

    const blob = new Blob([templateData], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "asset-onboarding-template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Template Downloaded",
      description: "CSV template downloaded successfully",
    });
  };

  const handleCsvFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast({
        title: "Error",
        description: "Please select a CSV file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "File size must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setCsvFile(file);
  };

  const processCsvFile = async () => {
    if (!csvFile) return;

    setIsProcessingCsv(true);
    try {
      const text = await csvFile.text();

      // Parse CSV content
      const lines = text.split("\n").filter((line) => line.trim());
      if (lines.length < 2) {
        throw new Error(
          "CSV file must have at least a header row and one data row"
        );
      }

      // Parse header to determine column indices
      const headerLine = lines[0];
      const headers = headerLine
        .split(",")
        .map((h) => h.trim().replace(/"/g, "").toLowerCase());

      // Map column names to indices
      const columnMap: Record<string, number> = {};
      headers.forEach((header, index) => {
        columnMap[header] = index;
      });

      // Parse data rows (skip header)
      const csvData: ConvertedData[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));

        if (values.length < 2) {
          continue; // Skip rows with less than 2 columns
        }

        // Map values to expected format using column map
        const row: ConvertedData = {
          article_id: values[columnMap["article id"]] || "",
          product_name: values[columnMap["product name"]] || "",
          product_link: values[columnMap["product link"]] || "",
          cad_file_link: values[columnMap["cad/file link"]] || "",
          category: values[columnMap["category"]] || "",
          subcategory: values[columnMap["subcategory"]] || "",
          glb_link: values[columnMap["glb link"]] || undefined,
          active:
            columnMap["active"] !== undefined && values[columnMap["active"]]
              ? values[columnMap["active"]].toLowerCase() === "true"
              : true,
        };

        // Only require article_id and product_name (make category optional)
        if (row.article_id && row.product_name) {
          csvData.push(row);
        } else {
        }
      }

      if (csvData.length === 0) {
        throw new Error(
          "No valid data rows found in CSV file. Please check that your CSV has at least 'Article ID' and 'Product Name' columns with data."
        );
      }

      setConvertedData(csvData);
      // Clear any existing generated URLs since we have new data
      setBunnyGeneratedUrls([]);
      toast({
        title: "Success",
        description: `Loaded ${csvData.length} rows from CSV file`,
      });
    } catch (error: any) {
      console.error("Error loading CSV:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load CSV file",
        variant: "destructive",
      });
    } finally {
      setIsProcessingCsv(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      <div className="p-6 max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="bg-white dark:bg-slate-800 rounded-lg p-8 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => router.push("/production/clients")}
                variant="outline"
                size="sm"
                className="hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Clients
              </Button>
              <div className="h-8 w-px bg-slate-300 dark:bg-slate-600"></div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                  Asset Onboarding
                </h1>
                <p className="text-slate-600 dark:text-slate-400 mt-1">
                  Convert spreadsheet data to assets for{" "}
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {client.name}
                  </span>
                </p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-md">
              <div className="w-2 h-2 bg-slate-500 rounded-full"></div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Ready to Process
              </span>
            </div>
          </div>
        </div>

        {/* Client Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="border border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
                    <Building2 className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                  </div>
                  Client Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      User Name
                    </Label>
                    <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                      {client.name}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      Client Company
                    </Label>
                    <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                      {client.client}
                    </p>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      Email Address
                    </Label>
                    <p className="text-lg text-slate-700 dark:text-slate-300">
                      {client.email}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="border border-slate-200 dark:border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                  </div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                    Status
                  </h3>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                  Ready to process assets for this client
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <div className="w-2 h-2 bg-slate-500 rounded-full"></div>
                  <span>Active Client</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Spreadsheet Converter */}
        <Card className="border border-slate-200 dark:border-slate-700">
          <CardHeader className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <CardTitle className="flex items-center gap-3 text-2xl">
              <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
                <Download className="h-6 w-6 text-slate-600 dark:text-slate-400" />
              </div>
              Convert Spreadsheet to CSV
            </CardTitle>
            <p className="text-slate-600 dark:text-slate-400 mt-2">
              Transform your spreadsheet data into the perfect format for asset
              onboarding
            </p>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label
                    htmlFor="spreadsheet"
                    className="text-lg font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Data Input
                  </Label>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Paste spreadsheet data or upload a CSV file
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={downloadTemplate}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download Template
                  </Button>
                  <div
                    className={`px-3 py-1 rounded-md text-xs font-medium ${
                      spreadsheetData.length > 5800
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        : spreadsheetData.length > 5000
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {spreadsheetData.length}/5800 characters
                  </div>
                  {spreadsheetData.length > 5000 && (
                    <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-xs font-medium">
                        Approaching limit
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* CSV Upload Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label
                      htmlFor="csv-upload"
                      className="text-sm font-medium text-slate-700 dark:text-slate-300"
                    >
                      Or Upload CSV File
                    </Label>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Upload a CSV file with columns: Article ID, Product Name,
                      Product Link, CAD/File Link, Category, Subcategory, GLB
                      Link (optional), Active (true/false, optional)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="csv-upload"
                      type="file"
                      accept=".csv"
                      onChange={handleCsvFileUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        document.getElementById("csv-upload")?.click()
                      }
                      className="flex items-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Choose CSV
                    </Button>
                    {csvFile && (
                      <Button
                        type="button"
                        onClick={processCsvFile}
                        disabled={isProcessingCsv}
                        className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white"
                        size="sm"
                      >
                        {isProcessingCsv ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          <>
                            <FileText className="h-4 w-4" />
                            Load CSV
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {csvFile && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {csvFile.name}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          ({(csvFile.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={resetForm}
                        className="text-slate-500 hover:text-slate-700"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <Textarea
                  id="spreadsheet"
                  value={spreadsheetData}
                  onChange={(e) => setSpreadsheetData(e.target.value)}
                  placeholder="Paste your spreadsheet data here (Excel, Google Sheets, etc.)"
                  rows={10}
                  className="font-mono text-sm border border-slate-200 dark:border-slate-600 focus:border-slate-400 dark:focus:border-slate-500 rounded-lg resize-none transition-colors"
                />
                {spreadsheetData && (
                  <div className="absolute top-2 right-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={resetForm}
                      className="text-slate-500 hover:text-slate-700 h-7 px-2"
                    >
                      Clear
                    </Button>
                  </div>
                )}
                {!spreadsheetData && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center text-slate-400 dark:text-slate-500">
                      <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                        <Download className="h-8 w-8" />
                      </div>
                      <p className="text-sm font-medium">
                        Ready to process your data
                      </p>
                      <p className="text-xs">
                        Paste your spreadsheet content above
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                onClick={convertSpreadsheetToCSV}
                disabled={
                  isConverting ||
                  isProcessingCsv ||
                  spreadsheetData.length > 5800
                }
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white h-12 text-lg font-semibold"
                size="lg"
              >
                {isConverting ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                    Converting with AI...
                  </>
                ) : csvFile ? (
                  <>
                    <FileText className="h-5 w-5 mr-3" />
                    Load CSV File
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5 mr-3" />
                    Convert Spreadsheet
                  </>
                )}
              </Button>

              {convertedData.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={downloadCSV}
                    variant="outline"
                    className="border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 h-12 px-6"
                    size="lg"
                  >
                    <Download className="h-5 w-5 mr-2" />
                    Download CSV
                  </Button>
                  <Button
                    onClick={showPreview}
                    disabled={isUploading}
                    className="bg-slate-900 hover:bg-slate-800 text-white h-12 px-6"
                    size="lg"
                  >
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Preview & Upload
                  </Button>
                </div>
              )}
            </div>

            {convertedData.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Converted Data ({convertedData.length} rows)
                  </span>
                  <Badge variant="secondary">Ready for Upload</Badge>
                </div>

                {/* CDN URL Generator */}
                <Card className="border border-slate-200 dark:border-slate-700">
                  <CardHeader className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <CardTitle className="flex items-center gap-3 text-xl">
                      <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
                        <Building2 className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                      </div>
                      CDN URL Generator
                    </CardTitle>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">
                      Generate CDN URLs for your 3D assets automatically
                    </p>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    {/* Storage Type Toggle */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600">
                      <div className="flex items-center space-x-3">
                        <Switch
                          id="custom-storage"
                          checked={useCustomStorage}
                          onCheckedChange={setUseCustomStorage}
                        />
                        <div>
                          <Label
                            htmlFor="custom-storage"
                            className="text-sm font-semibold text-slate-700 dark:text-slate-300"
                          >
                            Use custom storage URL
                          </Label>
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            Toggle between Bunny CDN and custom storage
                          </p>
                        </div>
                      </div>
                      <div
                        className={`px-3 py-1 rounded-md text-xs font-medium ${
                          useCustomStorage
                            ? "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {useCustomStorage ? "Custom Storage" : "Bunny CDN"}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {useCustomStorage ? (
                        <div className="lg:col-span-2 space-y-3">
                          <div>
                            <Label
                              htmlFor="custom-url"
                              className="text-sm font-semibold text-slate-700 dark:text-slate-300"
                            >
                              Custom Storage URL
                            </Label>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                              Provide an example URL to extract the base URL and
                              folder path
                            </p>
                          </div>
                          <Input
                            id="custom-url"
                            placeholder="e.g., https://mm.charpstar.net/Android/LCEGOT206.glb"
                            value={customStorageUrl}
                            onChange={(e) =>
                              setCustomStorageUrl(e.target.value)
                            }
                            className="border border-slate-200 dark:border-slate-600 focus:border-slate-400 dark:focus:border-slate-500 rounded-lg h-12"
                          />
                        </div>
                      ) : (
                        <div className="lg:col-span-2 space-y-3">
                          <div>
                            <Label
                              htmlFor="storage-path"
                              className="text-sm font-semibold text-slate-700 dark:text-slate-300"
                            >
                              Bunny CDN Storage Path
                            </Label>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                              Enter the client folder path in your Bunny CDN
                              storage
                            </p>
                          </div>
                          <Input
                            id="storage-path"
                            placeholder="e.g., Polhus/Config"
                            value={bunnyStoragePath}
                            onChange={(e) =>
                              setBunnyStoragePath(e.target.value)
                            }
                            className="border border-slate-200 dark:border-slate-600 focus:border-slate-400 dark:focus:border-slate-500 rounded-lg h-12"
                          />
                        </div>
                      )}
                      <div className="space-y-3">
                        <Button
                          onClick={generateBunnyUrls}
                          disabled={
                            useCustomStorage
                              ? !customStorageUrl.trim()
                              : !bunnyStoragePath.trim()
                          }
                          className="w-full bg-slate-900 hover:bg-slate-800 text-white h-12"
                          size="lg"
                        >
                          <Building2 className="h-5 w-5 mr-2" />
                          Generate URLs
                        </Button>
                        <Button
                          onClick={updateAssetsWithBunnyUrls}
                          disabled={bunnyGeneratedUrls.length === 0}
                          className="w-full bg-slate-900 hover:bg-slate-800 text-white h-12"
                          size="lg"
                        >
                          <CheckCircle className="h-5 w-5 mr-2" />
                          Apply to Assets
                        </Button>
                      </div>
                    </div>

                    {bunnyGeneratedUrls.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
                              <CheckCircle className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                            </div>
                            <div>
                              <Label className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                                Generated URLs ({bunnyGeneratedUrls.length})
                              </Label>
                              <p className="text-sm text-slate-600 dark:text-slate-400">
                                Ready to apply to your assets
                              </p>
                            </div>
                          </div>
                          <Button
                            onClick={() =>
                              copyToClipboard(bunnyGeneratedUrls.join("\n"))
                            }
                            className="bg-slate-900 hover:bg-slate-800 text-white"
                            size="sm"
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Copy All
                          </Button>
                        </div>
                        <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-600 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50">
                          <div className="space-y-2">
                            {bunnyGeneratedUrls
                              .slice(0, 5)
                              .map((url, index) => (
                                <div
                                  key={index}
                                  className="text-sm font-mono text-slate-700 dark:text-slate-300 p-2 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600"
                                >
                                  {url}
                                </div>
                              ))}
                            {bunnyGeneratedUrls.length > 5 && (
                              <div className="text-center py-2 text-sm text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 rounded-lg">
                                ... and {bunnyGeneratedUrls.length - 5} more
                                URLs
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-600">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-lg">
                      <CheckCircle className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        Ready to Upload
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        These{" "}
                        <span className="font-bold">
                          {convertedData.length}
                        </span>{" "}
                        assets will be added to the onboarding system for{" "}
                        <strong className="text-slate-900 dark:text-slate-100">
                          {client?.name}
                        </strong>{" "}
                        and will appear in their client review dashboard.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-600 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50">
                  <div className="space-y-2">
                    {convertedData.slice(0, 3).map((row, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-mono text-slate-700 dark:text-slate-300">
                            {row.article_id} | {row.product_name} |{" "}
                            {row.category}
                          </span>
                        </div>
                        {row.glb_link && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-600 rounded-md">
                            <CheckCircle className="h-3 w-3 text-slate-600 dark:text-slate-400" />
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                              CDN
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                    {convertedData.length > 3 && (
                      <div className="text-center py-3 text-sm text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 rounded-lg">
                        ... and {convertedData.length - 3} more assets
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="border border-slate-200 dark:border-slate-700">
          <CardHeader className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
                <CheckCircle className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              How to Use This Tool
            </CardTitle>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Follow these simple steps to onboard assets for your client
            </p>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-slate-600 dark:text-slate-400">
                    1
                  </span>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    Input Data
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Paste spreadsheet data from Excel/Google Sheets or upload a
                    CSV file with the required columns.
                  </p>
                </div>
              </div>

              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-slate-600 dark:text-slate-400">
                    2
                  </span>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    Convert with AI
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Click &quot;Convert to CSV&quot; to let AI convert the data
                    to the required format with proper columns.
                  </p>
                </div>
              </div>

              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-slate-600 dark:text-slate-400">
                    3
                  </span>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    Upload Assets
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Upload the converted assets directly to the onboarding
                    system for this client.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="min-w-7xl w-[95vw] max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <CheckCircle className="h-6 w-6" />
              Preview Upload - {convertedData.length} Assets
            </DialogTitle>
            <DialogDescription>
              Review the data before uploading to the onboarding system for{" "}
              <strong>{client?.name}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto border-t border-b px-6 max-h-[calc(100vh-500px)]">
            <Table>
              <TableHeader className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10">
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead className="min-w-[120px]">Article ID</TableHead>
                  <TableHead className="min-w-[200px]">Product Name</TableHead>
                  <TableHead className="min-w-[120px]">Category</TableHead>
                  <TableHead className="min-w-[120px]">Subcategory</TableHead>
                  <TableHead className="min-w-[80px]">Priority</TableHead>
                  <TableHead className="min-w-[100px]">GLB Link</TableHead>
                  <TableHead className="min-w-[80px]">Active</TableHead>
                  <TableHead className="min-w-[200px]">Product Link</TableHead>
                  <TableHead className="min-w-[200px]">CAD Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {convertedData.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium text-slate-500">
                      {index + 1}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {item.article_id}
                    </TableCell>
                    <TableCell className="max-w-[250px] truncate">
                      {item.product_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{item.category}</Badge>
                    </TableCell>
                    <TableCell>
                      {item.subcategory ? (
                        <Badge variant="outline">{item.subcategory}</Badge>
                      ) : (
                        <span className="text-xs text-amber-600 dark:text-amber-400">
                          Missing
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          index < 10
                            ? "default"
                            : index < 50
                              ? "secondary"
                              : "outline"
                        }
                      >
                        1
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.glb_link ? (
                        <div className="flex items-center gap-1">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-xs text-green-600 dark:text-green-400">
                            Set
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.active !== false ? "default" : "secondary"
                        }
                      >
                        {item.active !== false ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      {item.product_link ? (
                        <a
                          href={item.product_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate block"
                        >
                          {item.product_link}
                        </a>
                      ) : (
                        <span className="text-xs text-slate-500">-</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      {item.cad_file_link ? (
                        <a
                          href={item.cad_file_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate block"
                        >
                          {item.cad_file_link}
                        </a>
                      ) : (
                        <span className="text-xs text-slate-500">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-3 px-6 py-4">
            <div className="flex-1 text-sm text-slate-600 dark:text-slate-400">
              <p>
                <strong>{convertedData.length}</strong> assets will be uploaded
                with:
              </p>
              <ul className="list-disc list-inside text-xs mt-1 space-y-1">
                <li>
                  Status: <strong>not_started</strong>
                </li>
                <li>
                  Priority: <strong>1</strong> (Highest)
                </li>
                <li>
                  Batch: <strong>1</strong>
                </li>
                <li>
                  GLB Links:{" "}
                  <strong>
                    {convertedData.filter((d) => d.glb_link).length}
                  </strong>{" "}
                  set
                </li>
                <li>
                  Missing Subcategories:{" "}
                  <strong className="text-amber-600 dark:text-amber-400">
                    {
                      convertedData.filter(
                        (d) => !d.subcategory || d.subcategory.trim() === ""
                      ).length
                    }
                  </strong>
                </li>
                <li>
                  Inactive Assets:{" "}
                  <strong className="text-slate-600 dark:text-slate-400">
                    {convertedData.filter((d) => d.active === false).length}
                  </strong>
                </li>
              </ul>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowPreviewDialog(false)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={uploadToOnboardingAssets}
                disabled={isUploading}
                className="bg-slate-900 hover:bg-slate-800 text-white cursor-pointer"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirm & Upload
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
