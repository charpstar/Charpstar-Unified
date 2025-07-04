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
} from "lucide-react";
import { useUser } from "@/contexts/useUser";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/utilities";
import { useRouter } from "next/navigation";

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
      if (!row[0] && !row[1] && !row[2]) continue; // skip empty rows
      const [
        article_id,
        product_name,
        product_link,
        glb_link,
        category,
        subcategory,
        ,
        reference,
      ] = row;
      const { error } = await supabase.from("onboarding_assets").insert({
        client,
        article_id,
        product_name,
        product_link,
        glb_link,
        category,
        subcategory,
        reference,
      });
      if (error) failCount++;
      else successCount++;
    }

    setIsUploading(false);
    setUploadProgress(100);

    if (successCount > 0) {
      toast({
        title: "🎉 Upload Success!",
        description: `${successCount} assets successfully uploaded!`,
      });
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
            title: "🚀 Onboarding Complete!",
            description: "CSV upload complete. Redirecting to dashboard...",
          });
          setTimeout(() => router.push("/dashboard?refreshUser=1"), 1200);
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
        title: "⚠️ Upload Error",
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
    <div className="h-full bg-gradient-to-br from-background via-background to-muted/20 flex flex-col items-center justify-center p-8">
      {/* Enhanced Header with Welcome Message */}
      <div className="w-full max-w-4xl mb-8">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center mb-4">
            <div className="relative">
              <FileSpreadsheet className="h-12 w-12 text-primary animate-pulse" />
            </div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent mb-2">
            CSV Data Upload
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload your product data to get started with your 3D asset library
          </p>
        </div>
      </div>

      {/* Enhanced Progress Stepper */}
      <div className="w-full max-w-4xl mb-8">
        <Card className="p-6 bg-background/80 backdrop-blur-sm border-primary/20">
          <div className="relative">
            {/* Progress Line */}
            <div className="absolute top-6 left-0 w-full h-1 bg-muted rounded-full">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all duration-700 ease-out"
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
        <Card className="relative overflow-hidden bg-gradient-to-br from-background via-background to-primary/5 border-primary/20">
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
                    Get the CSV template to format your data correctly
                  </p>
                </div>
              </div>
              <a
                href="/csv-template.csv"
                download
                onClick={() => setProgress((p) => ({ ...p, downloaded: true }))}
              >
                <Button
                  variant="default"
                  size="lg"
                  className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-300 shadow-lg hover:shadow-xl cursor-pointer"
                >
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
                className={`relative border-2 border-dashed rounded-xl h-80 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
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
                          className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all duration-300"
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
                      <Button
                        variant="outline"
                        size="lg"
                        className="group cursor-pointer"
                      >
                        <Upload className="h-5 w-5 mr-2 group-hover:animate-bounce" />
                        Choose File
                      </Button>
                    )}
                  </div>

                  {csvFile && (
                    <div className="mt-4 p-4 bg-primary/10 rounded-lg border border-primary/20">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium">{csvFile.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(csvFile.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
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
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium">
                  Preview your data before confirming
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Review the data below to ensure everything looks correct before
                uploading.
              </p>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div
                className={`overflow-auto ${csvPreview && csvPreview.length > 11 ? "max-h-120" : "h-fit"}`}
              >
                {csvPreview ? (
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 border-b border-border">
                      {csvPreview[0] && (
                        <tr>
                          {csvPreview[0].map((cell, j) => (
                            <th
                              key={j}
                              className="px-4 py-3 text-left font-semibold text-primary bg-primary/5"
                            >
                              {cell}
                            </th>
                          ))}
                        </tr>
                      )}
                    </thead>
                    <tbody className="divide-y divide-border">
                      {csvPreview.slice(1).map((row, i) => (
                        <tr
                          key={i}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          {row.map((cell, j) => (
                            <td key={j} className="px-4 py-3 text-sm">
                              {cell || (
                                <span className="text-muted-foreground italic">
                                  empty
                                </span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleConfirm}
              className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 cursor-pointer"
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              Confirm Upload
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
