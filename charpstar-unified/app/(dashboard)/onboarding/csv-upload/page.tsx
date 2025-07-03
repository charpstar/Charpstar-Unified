"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/display";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/containers";
import { CheckCircle, FileDown, FileText, Eye } from "lucide-react";
import { useUser } from "@/contexts/useUser";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/utilities";
import { useRouter } from "next/navigation";

const steps = [
  { label: "Downloaded Template", icon: FileDown },
  { label: "CSV File Uploaded", icon: FileText },
  { label: "Confirmed Preview", icon: Eye },
];

export default function CsvUploadPage() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<string[][] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState({
    downloaded: false,
    read: false,
    confirmed: false,
  });
  const user = useUser();
  const { toast } = useToast();
  const router = useRouter();

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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleConfirm = async () => {
    setProgress((p) => ({ ...p, confirmed: true }));
    setDialogOpen(false);
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
    if (successCount > 0) {
      toast({
        title: "Upload Success",
        description: `${successCount} assets saved!`,
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
            title: "Onboarding Complete",
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
        title: "Upload Error",
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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
      {/* Progress Bar in its own div */}
      <div className="w-full max-w-3xl flex flex-col items-center mb-4">
        <div className="relative w-full flex flex-col items-center">
          {/* Checkpoints (icons) on top */}
          <div className="relative flex justify-between items-center w-full h-8 z-20 mb-1">
            {steps.map((step, idx) => (
              <div
                key={step.label}
                className="flex flex-col items-center w-1/3"
              >
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center border-2 mb-1
                    ${idx <= currentStep ? "bg-green-500 text-white border-green-500" : "bg-muted text-muted-foreground border-muted-foreground/30"}
                  `}
                >
                  {idx < currentStep ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : idx === currentStep ? (
                    <step.icon className="h-5 w-5" />
                  ) : (
                    <step.icon className="h-5 w-5 opacity-50" />
                  )}
                </div>
              </div>
            ))}
          </div>
          {/* Progress bar background and fill below icons */}
          <div className="relative w-full h-2 mb-2">
            <div className="absolute left-0 w-full h-2 bg-muted-foreground/20 rounded-full z-0" />
            <div
              className="absolute left-0 h-2 bg-green-500 rounded-full z-10 transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
          {/* Step Labels below bar */}
          <div className="relative flex justify-between items-center w-full mt-1">
            {steps.map((step, idx) => (
              <span
                key={step.label}
                className={`text-xs text-center w-1/3 ${idx <= currentStep ? "text-green-700 font-semibold" : "text-muted-foreground"}`}
              >
                {step.label}
              </span>
            ))}
          </div>
        </div>
      </div>
      {/* Main Card */}
      <div className="w-full max-w-3xl bg-background rounded-xl shadow-lg p-8 relative">
        {/* Download Template Button */}
        <div className="absolute top-6 right-6">
          <a
            href="/csv-template.csv"
            download
            onClick={() => setProgress((p) => ({ ...p, downloaded: true }))}
          >
            <Button variant="default" size="sm">
              Download CSV Template
            </Button>
          </a>
        </div>
        <h2 className="text-2xl font-bold mb-6">Upload CSV File</h2>
        {/* Drag & Drop Zone */}
        <div className="relative">
          <div
            className={`border-2 border-dashed border-muted-foreground rounded-lg h-64 flex flex-col items-center justify-center cursor-pointer bg-muted/50 hover:bg-muted/70 transition mb-4 ${!progress.downloaded ? "pointer-events-none opacity-50" : ""}`}
            onDrop={progress.downloaded ? handleDrop : undefined}
            onDragOver={
              progress.downloaded ? (e) => e.preventDefault() : undefined
            }
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
            <div className="text-center">
              <p className="font-semibold text-lg mb-2">
                Drag & Drop CSV Here or
              </p>
              <Button
                variant="secondary"
                size="sm"
                disabled={!progress.downloaded}
              >
                Browse Files
              </Button>
            </div>
            {!progress.downloaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10 rounded-lg">
                <span className="text-muted-foreground font-medium">
                  Download the CSV template to enable upload
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>CSV Preview</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto max-h-96 min-w-[400px] border rounded mb-4">
            {csvPreview ? (
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-background z-10">
                  {csvPreview[0] && (
                    <tr className="font-bold">
                      {csvPreview[0].map((cell, j) => (
                        <th
                          key={j}
                          className="px-2 py-1 border-b border-muted-foreground/10 whitespace-nowrap text-left"
                        >
                          {cell}
                        </th>
                      ))}
                    </tr>
                  )}
                </thead>
                <tbody>
                  {csvPreview.slice(1).map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td
                          key={j}
                          className="px-2 py-1 border-b border-muted-foreground/10 whitespace-nowrap"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-muted-foreground">No preview available.</div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="default" onClick={handleConfirm}>
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
