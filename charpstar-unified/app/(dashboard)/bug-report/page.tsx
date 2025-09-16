"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/contexts/useUser";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Input } from "@/components/ui/inputs";
import { Textarea } from "@/components/ui/inputs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs";
import { Label } from "@/components/ui/display";
import { ImageUpload } from "@/components/ui/inputs/image-upload";
import {
  ArrowLeft,
  Bug,
  Send,
  User,
  Calendar,
  Monitor,
  Globe,
} from "lucide-react";

const BUG_CATEGORIES = [
  "UI/UX Issue",
  "Functionality Bug",
  "Performance Issue",
  "Data Issue",
  "Authentication Problem",
  "Navigation Issue",
  "Feature Request",
  "Other",
];

interface BugReportForm {
  title: string;
  description: string;
  category: string;
  stepsToReproduce: string;
  expectedBehavior: string;
  actualBehavior: string;
  additionalInfo: string;
  userAgent: string;
  url: string;
  timestamp: string;
  images: string[];
}

export default function BugReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useUser();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<BugReportForm>({
    title: "",
    description: "",
    category: "",
    stepsToReproduce: "",
    expectedBehavior: "",
    actualBehavior: "",
    additionalInfo: "",
    userAgent: "",
    url: "",
    timestamp: "",
    images: [],
  });

  useEffect(() => {
    // Prefill form with URL parameters
    const url = searchParams.get("url") || window.location.href;
    const pageTitle = searchParams.get("page") || document.title;

    setFormData((prev) => ({
      ...prev,
      url: decodeURIComponent(url),
      title: `Bug Report: ${pageTitle}`,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    }));
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.description.trim()) {
      toast.error("Please fill in the title and description");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/bug-reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          category: formData.category,
          stepsToReproduce: formData.stepsToReproduce,
          expectedBehavior: formData.expectedBehavior,
          actualBehavior: formData.actualBehavior,
          additionalInfo: formData.additionalInfo,
          userEmail: user?.email || null,
          userAgent: formData.userAgent,
          url: formData.url,
          pageTitle: document.title,
          images: formData.images,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit bug report");
      }

      toast.success("Bug report submitted successfully!", {
        description:
          "Thank you for helping us improve the platform. We'll review your report and get back to you if needed.",
        duration: 5000,
      });

      // Reset form
      setFormData({
        title: "",
        description: "",
        category: "",
        stepsToReproduce: "",
        expectedBehavior: "",
        actualBehavior: "",
        additionalInfo: "",
        userAgent: "",
        url: "",
        timestamp: "",
        images: [],
      });

      // Redirect back to dashboard after a short delay
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (error) {
      console.error("Error submitting bug report:", error);
      toast.error("Failed to submit bug report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (
    field: keyof BugReportForm,
    value: string | string[]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="hover:bg-primary/8 transition-all duration-200 rounded-lg cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </Button>
          <div className="flex items-center gap-2">
            <Bug className="h-6 w-6 text-red-500" />
            <h1 className="text-2xl font-bold">Report a Bug</h1>
          </div>
        </div>
        <p className="text-muted-foreground">
          Help us improve the Charpstar Platform by reporting bugs and issues
          you encounter.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Title *
                </Label>
                <Input
                  value={formData.title}
                  onChange={(e) => updateFormData("title", e.target.value)}
                  placeholder="Brief description of the issue"
                  required
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Category *
                </Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => updateFormData("category", value)}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUG_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block">
                Description *
              </Label>
              <Textarea
                value={formData.description}
                onChange={(e) => updateFormData("description", e.target.value)}
                placeholder="Please describe the issue in detail..."
                rows={4}
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* Bug Details */}
        <Card>
          <CardHeader>
            <CardTitle>Bug Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Steps to Reproduce
              </Label>
              <Textarea
                value={formData.stepsToReproduce}
                onChange={(e) =>
                  updateFormData("stepsToReproduce", e.target.value)
                }
                placeholder="1. Go to...&#10;2. Click on...&#10;3. See error..."
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Expected Behavior
                </Label>
                <Textarea
                  value={formData.expectedBehavior}
                  onChange={(e) =>
                    updateFormData("expectedBehavior", e.target.value)
                  }
                  placeholder="What should have happened?"
                  rows={3}
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Actual Behavior
                </Label>
                <Textarea
                  value={formData.actualBehavior}
                  onChange={(e) =>
                    updateFormData("actualBehavior", e.target.value)
                  }
                  placeholder="What actually happened?"
                  rows={3}
                />
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block">
                Additional Information
              </Label>
              <Textarea
                value={formData.additionalInfo}
                onChange={(e) =>
                  updateFormData("additionalInfo", e.target.value)
                }
                placeholder="Any other relevant information, screenshots, or context..."
                rows={3}
              />
            </div>

            <div>
              <ImageUpload
                images={formData.images}
                //es-lint-disable-next-line
                onImagesChange={(images) => updateFormData("images", images)}
              />
            </div>
          </CardContent>
        </Card>

        {/* System Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              System Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">User</Label>
                <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {user?.email || "Not logged in"}
                  </span>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Timestamp
                </Label>
                <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{new Date().toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block">Page URL</Label>
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-mono text-xs break-all">
                  {formData.url}
                </span>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block">
                User Agent
              </Label>
              <div className="p-2 bg-muted rounded-md">
                <span className="text-xs font-mono break-all">
                  {formData.userAgent}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="cursor-pointer">
            {loading ? (
              <>
                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit Bug Report
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
