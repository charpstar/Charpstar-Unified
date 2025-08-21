"use client";

import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/display";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/containers";
import { Card } from "@/components/ui/containers";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/display";
import {
  CheckCircle,
  FileDown,
  FileText,
  Eye,
  Upload,
  FileSpreadsheet,
  ArrowRight,
  Check,
  AlertCircle,
  Download,
  CloudUpload,
  X,
} from "lucide-react";
import { useUser } from "@/contexts/useUser";
import { useLoading } from "@/contexts/LoadingContext";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/utilities";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/feedback";
import { notificationService } from "@/lib/notificationService";

const steps = [
  {
    label: "Download Template",
    icon: FileDown,
    description: "Get the CSV template",
  },
  { label: "Upload CSV", icon: FileText, description: "Upload your data file" },
  { label: "Confirm Data", icon: Eye, description: "Review and confirm" },
];

export default function CsvUploadPage() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<string[][] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [removeConfirmDialogOpen, setRemoveConfirmDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState({
    downloaded: false,
    read: false,
    confirmed: false,
  });
  const user = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const { startLoading } = useLoading();

  // Animated progress effect
  useEffect(() => {
    if (isUploading && uploadProgress < 100) {
      const timer = setTimeout(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 100));
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isUploading, uploadProgress]);

  const handleFile = (file: File) => {
    setCsvFile(file);
    setProgress((p) => ({ ...p, read: true }));
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      // Simple CSV parsing (no quotes/escapes)
      const rows = text
        .split(/\r?\n/)
        .filter(Boolean)
        .map((row) => row.split(","));

      // Validate CSV structure matches template
      if (rows.length > 0 && rows[0].length < 6) {
        toast({
          title: "Invalid CSV Format",
          description:
            "CSV must have at least 6 columns: Article ID, Product Name, product_link, glb_link, Category, Subcategory",
          variant: "destructive",
        });
        return;
      }

      setCsvPreview(rows);
      setDialogOpen(true);
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

  const handleRemoveFile = () => {
    setRemoveConfirmDialogOpen(true);
  };

  const confirmRemoveFile = async () => {
    // Clear the uploaded data from database when file is removed
    if (user?.metadata?.client) {
      const { error } = await supabase
        .from("onboarding_assets")
        .delete()
        .eq("client", user.metadata.client);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to clear previous data: " + error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Data Cleared",
          description: "Previous CSV data has been removed.",
        });
      }
    }

    setCsvFile(null);
    setCsvPreview(null);
    setProgress((p) => ({
      ...p,
      read: false,
      confirmed: false,
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setRemoveConfirmDialogOpen(false);
  };

  const handleConfirm = async () => {
    setProgress((p) => ({ ...p, confirmed: true }));
    setDialogOpen(false);
    setIsUploading(true);
    setUploadProgress(0);

    if (!csvPreview || !user?.metadata?.client) return;
    const client = user.metadata.client;
    const rows = csvPreview.slice(1); // skip header
    let successCount = 0;
    let failCount = 0;

    for (const row of rows) {
      // Skip empty rows (check first 3 required fields)
      if (!row[0]?.trim() && !row[1]?.trim() && !row[2]?.trim()) continue;

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

      const { error } = await supabase.from("onboarding_assets").insert({
        client,
        article_id: article_id.trim(),
        product_name: product_name.trim(),
        product_link: product_link.trim(),
        glb_link: glb_link.trim(), // Use the actual glb_link from CSV
        category: category?.trim() || null,
        subcategory: subcategory?.trim() || null,
        reference: null, // No reference column in template
        priority: 2, // Default priority since not in template
      });
      if (error) failCount++;
      else successCount++;
    }

    setIsUploading(false);
    setUploadProgress(100);

    if (successCount > 0) {
      toast({
        title: " Upload Success!",
        description: `${successCount} assets successfully uploaded!`,
      });

      // Send notification to admin users about new product submission
      try {
        await notificationService.sendProductSubmissionNotification({
          client: user?.metadata?.client || "Unknown Client",
          batch: 1, // CSV uploads typically go to batch 1
          productCount: successCount,
          productNames: [], // CSV uploads don't have individual product names easily accessible
          submittedAt: new Date().toISOString(),
        });
        console.log("📦 CSV product submission notification sent successfully");
      } catch (notificationError) {
        console.error(
          "Failed to send CSV product submission notification:",
          notificationError
        );
        // Don't fail the CSV upload if notification fails
      }

      // Update user metadata
      const { error: userError } = await supabase
        .from("profiles")
        .update({ csv_uploaded: true })
        .eq("id", user.id);
      if (!userError) {
        // Check profile value after update!
        const { data: updatedProfile, error: profileError } = await supabase
          .from("profiles")
          .select("csv_uploaded")
          .eq("id", user.id)
          .single();
        if (profileError) {
          toast({
            title: "Profile Read Error",
            description: profileError.message,
            variant: "destructive",
          });
        } else if (updatedProfile?.csv_uploaded === true) {
          toast({
            title: " Onboarding Complete!",
            description: "CSV upload complete. Redirecting to dashboard...",
          });
          setTimeout(() => {
            startLoading(); // Start loading before redirect
            router.push("/dashboard?refreshUser=1");
          }, 1200);
        }
      } else {
        toast({
          title: "User Update Error",
          description: userError.message,
          variant: "destructive",
        });
      }
    }
    if (failCount > 0) {
      toast({
        title: " Upload Error",
        description: `${failCount} rows failed to save.`,
        variant: "destructive",
      });
    }
  };

  // Determine current step
  const currentStep = progress.confirmed
    ? 2
    : progress.read
      ? 1
      : progress.downloaded
        ? 0
        : -1;

  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      {/* Enhanced Header with Welcome Message */}
      <div className="w-full max-w-4xl mb-8">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center mb-4">
            <div className="relative">
              <FileSpreadsheet className="h-12 w-12 text-primary animate-pulse" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2">
            CSV Data Upload
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload your product data to get started with your 3D asset library.
            The template includes: Article ID, Product Name, product_link,
            glb_link, Category, and Subcategory.
          </p>
        </div>
      </div>

      {/* Enhanced Progress Stepper */}
      <div className="w-full max-w-4xl mb-8">
        <Card className="p-6 border">
          <div className="relative">
            {/* Progress Line */}
            <div className="absolute top-6 left-0 w-full h-1 bg-muted rounded-full">
              <div
                className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${((currentStep + 1) / steps.length) * 100}%`,
                }}
              />
            </div>

            {/* Steps */}
            <div className="relative flex justify-between items-center">
              {steps.map((step, idx) => (
                <div key={step.label} className="flex flex-col items-center">
                  <div
                    className={`relative z-10 h-12 w-12 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                      idx <= currentStep
                        ? "bg-primary text-primary-foreground border-primary shadow-lg scale-110"
                        : "bg-muted text-muted-foreground border-muted-foreground/30"
                    }`}
                  >
                    {idx < currentStep ? (
                      <CheckCircle className="h-6 w-6 animate-pulse" />
                    ) : idx === currentStep ? (
                      <step.icon className="h-6 w-6" />
                    ) : (
                      <step.icon className="h-6 w-6 opacity-50" />
                    )}
                  </div>
                  <div className="mt-3 text-center">
                    <p
                      className={`text-sm font-medium transition-colors duration-300 ${
                        idx <= currentStep
                          ? "text-primary"
                          : "text-muted-foreground"
                      }`}
                    >
                      {step.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Main Upload Area */}
      <div className="w-full max-w-4xl">
        <Card className="border">
          {/* Download Template Section */}
          <div className="p-8 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Download className="h-8 w-8 text-primary" />
                  <div className="absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">
                    Step 1: Download Template
                  </h3>
                  <p className="text-muted-foreground">
                    Get the CSV template with the correct column structure:
                    Article ID, Product Name, product_link, glb_link, Category,
                    Subcategory
                  </p>
                </div>
              </div>
              <a
                href="/csv-template.csv"
                download
                onClick={() => setProgress((p) => ({ ...p, downloaded: true }))}
              >
                <Button variant="default" size="lg">
                  <Download className="h-5 w-5 mr-2" />
                  Download Template
                </Button>
              </a>
            </div>
          </div>

          {/* Upload Section */}
          <div className="p-8">
            <div className="flex items-center space-x-4 mb-6">
              <div className="relative">
                <CloudUpload className="h-8 w-8 text-primary" />
                {progress.downloaded && (
                  <div className="absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full animate-pulse" />
                )}
              </div>
              <div>
                <h3 className="text-xl font-semibold">
                  Step 2: Upload Your CSV
                </h3>
                <p className="text-muted-foreground">
                  {progress.downloaded
                    ? "Drag and drop your CSV file or click to browse"
                    : "Download the template first to enable upload"}
                </p>
              </div>
            </div>

            {/* Enhanced Drag & Drop Zone */}
            <div className="relative">
              <div
                className={`relative border-2 border-dashed  rounded-xl h-90 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
                  progress.downloaded
                    ? isDragOver
                      ? "border-primary bg-primary/10 scale-105"
                      : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30"
                    : "border-muted-foreground/20 bg-muted/20 opacity-50 pointer-events-none"
                }`}
                onDrop={progress.downloaded ? handleDrop : undefined}
                onDragOver={progress.downloaded ? handleDragOver : undefined}
                onDragLeave={progress.downloaded ? handleDragLeave : undefined}
                onClick={
                  progress.downloaded
                    ? () => fileInputRef.current?.click()
                    : undefined
                }
              >
                <input
                  type="file"
                  accept=".csv"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileInput}
                  disabled={!progress.downloaded}
                />

                {/* Upload Animation */}
                {isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/90 backdrop-blur-sm rounded-xl">
                    <div className="text-center">
                      <div className="relative mb-4">
                        <div className="h-16 w-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                        <Upload className="h-8 w-8 text-primary absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                      </div>
                      <p className="text-lg font-semibold mb-2">Uploading...</p>
                      <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        {uploadProgress}%
                      </p>
                    </div>
                  </div>
                )}

                <div className="text-center">
                  <div className="mb-6">
                    <div className="relative inline-block">
                      <FileSpreadsheet className="h-16 w-16 text-muted-foreground/50 mb-4" />
                      {progress.downloaded && (
                        <div className="absolute -top-2 -right-2 h-6 w-6 bg-green-500 rounded-full flex items-center justify-center">
                          <Check className="h-4 w-4 text-white" />
                        </div>
                      )}
                    </div>
                    <h4 className="text-xl font-semibold mb-2">
                      {progress.downloaded
                        ? "Drop your CSV file here"
                        : "Download template first"}
                    </h4>
                    <p className="text-muted-foreground mb-4">
                      {progress.downloaded
                        ? "or click to browse files"
                        : "You need to download the template before uploading"}
                    </p>
                    {progress.downloaded && (
                      <Button variant="outline" size="lg">
                        <Upload className="h-5 w-5 mr-2" />
                        Choose File
                      </Button>
                    )}
                  </div>

                  {csvFile && (
                    <div className="mt-4 p-4 bg-primary/10 rounded-lg border border-primary/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <FileText className="h-5 w-5 text-primary" />
                          <div>
                            <p className="font-medium">{csvFile.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {(csvFile.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleRemoveFile}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                          title="Remove file and clear data"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Enhanced Preview Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[900px] max-h-[60vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Eye className="h-5 w-5 text-primary" />
              <span>Review Your Data</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Preview your data before confirming. Review the data below to
                ensure everything looks correct before uploading.
              </AlertDescription>
            </Alert>

            <div className="border rounded-lg overflow-hidden">
              <div
                className={`overflow-auto ${csvPreview && csvPreview.length > 11 ? "max-h-120" : "h-fit"}`}
              >
                {csvPreview ? (
                  <Table>
                    <TableHeader className="sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                      {csvPreview[0] && (
                        <TableRow className="p-4">
                          {csvPreview[0].map((cell, j) => (
                            <TableHead
                              key={j}
                              className="font-semibold text-primary bg-primary/5"
                            >
                              {cell}
                            </TableHead>
                          ))}
                        </TableRow>
                      )}
                    </TableHeader>
                    <TableBody>
                      {csvPreview.slice(1).map((row, i) => (
                        <TableRow key={i} className="p-2">
                          {row.map((cell, j) => (
                            <TableCell key={j} className="text-sm p-4">
                              {cell || (
                                <span className="text-muted-foreground italic">
                                  empty
                                </span>
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    No preview available.
                  </div>
                )}
              </div>
              {csvPreview && csvPreview.length > 11 && (
                <div className="p-3 bg-muted/30 border-t border-border text-center">
                  <p className="text-sm text-muted-foreground">
                    Showing {csvPreview.length - 1} rows • Scroll to see more
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="default" onClick={handleConfirm}>
              <ArrowRight className="h-4 w-4 mr-2" />
              Confirm Upload
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove File Confirmation Dialog */}
      <Dialog
        open={removeConfirmDialogOpen}
        onOpenChange={setRemoveConfirmDialogOpen}
      >
        <DialogContent className="w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <span>Remove CSV File</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Are you sure you want to remove this CSV file? This will also
                clear all the data that was uploaded from this file. This action
                cannot be undone.
              </AlertDescription>
            </Alert>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setRemoveConfirmDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmRemoveFile}>
              <X className="h-4 w-4 mr-2" />
              Remove & Clear Data
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
