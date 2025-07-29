"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/display";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Badge } from "@/components/ui/feedback";
import { Input } from "@/components/ui/inputs";
import { Label } from "@/components/ui/display";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs";
import { Textarea } from "@/components/ui/inputs";
import { Alert, AlertDescription } from "@/components/ui/feedback";
import {
  Upload,
  Package,
  FileText,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  X,
  FolderOpen,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/ui/utilities";

interface UploadedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: "uploading" | "success" | "error";
  error?: string;
}

interface ModelData {
  product_name: string;
  category: string;
  subcategory: string;
  description: string;
  materials: string[];
  colors: string[];
  tags: string[];
  client: string;
}

export default function AddModelsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [modelData, setModelData] = useState<ModelData>({
    product_name: "",
    category: "",
    subcategory: "",
    description: "",
    materials: [],
    colors: [],
    tags: [],
    client: "",
  });

  // Predefined categories and subcategories
  const categories = [
    {
      id: "furniture",
      name: "Furniture",
      subcategories: ["Chairs", "Tables", "Sofas", "Beds", "Storage", "Other"],
    },
    {
      id: "lighting",
      name: "Lighting",
      subcategories: [
        "Ceiling Lights",
        "Table Lamps",
        "Floor Lamps",
        "Wall Lights",
        "Other",
      ],
    },
    {
      id: "decor",
      name: "Decor",
      subcategories: ["Vases", "Artwork", "Mirrors", "Plants", "Other"],
    },
    {
      id: "kitchen",
      name: "Kitchen",
      subcategories: ["Appliances", "Utensils", "Storage", "Other"],
    },
    {
      id: "bathroom",
      name: "Bathroom",
      subcategories: ["Fixtures", "Accessories", "Storage", "Other"],
    },
    {
      id: "outdoor",
      name: "Outdoor",
      subcategories: ["Garden Furniture", "Planters", "Lighting", "Other"],
    },
  ];

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files) return;

      const newFiles: UploadedFile[] = Array.from(files).map((file) => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        progress: 0,
        status: "uploading" as const,
      }));

      setUploadedFiles((prev) => [...prev, ...newFiles]);

      // Simulate upload progress
      newFiles.forEach((file) => {
        const interval = setInterval(() => {
          setUploadedFiles((prev) =>
            prev.map((f) =>
              f.id === file.id
                ? { ...f, progress: Math.min(f.progress + 10, 100) }
                : f
            )
          );
        }, 200);

        setTimeout(() => {
          clearInterval(interval);
          setUploadedFiles((prev) =>
            prev.map((f) =>
              f.id === file.id ? { ...f, status: "success" as const } : f
            )
          );
        }, 2000);
      });
    },
    []
  );

  const removeFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleInputChange = (field: keyof ModelData, value: any) => {
    setModelData((prev) => ({ ...prev, [field]: value }));
  };

  const handleArrayInputChange = (
    field: "materials" | "colors" | "tags",
    value: string
  ) => {
    const items = value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    setModelData((prev) => ({ ...prev, [field]: items }));
  };

  const handleSubmit = async () => {
    if (uploadedFiles.length === 0) {
      toast({
        title: "No files selected",
        description: "Please upload at least one 3D model file.",
        variant: "destructive",
      });
      return;
    }

    if (!modelData.product_name || !modelData.category) {
      toast({
        title: "Missing required fields",
        description: "Please fill in the product name and category.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      toast({
        title: "Models uploaded successfully!",
        description: `${uploadedFiles.length} model(s) have been added to your library.`,
      });

      // Redirect to asset library
      router.push("/asset-library");
    } catch {
      toast({
        title: "Upload failed",
        description:
          "There was an error uploading your models. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split(".").pop()?.toLowerCase();
    switch (extension) {
      case "glb":
      case "gltf":
        return <Package className="h-4 w-4" />;
      case "obj":
      case "fbx":
        return <FileText className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard")}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Add 3D Models</h1>
          <p className="text-muted-foreground">
            Upload and organize your 3D models
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-4 mb-8">
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex items-center gap-2">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep >= step
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {currentStep > step ? <CheckCircle className="h-4 w-4" /> : step}
            </div>
            <span
              className={`text-sm font-medium ${
                currentStep >= step
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {step === 1
                ? "Upload Files"
                : step === 2
                  ? "Model Details"
                  : "Review & Submit"}
            </span>
            {step < 3 && (
              <div
                className={`h-px w-8 ${
                  currentStep > step ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: File Upload */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload 3D Model Files
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                Drop your 3D model files here
              </h3>
              <p className="text-muted-foreground mb-4">
                Supported formats: GLB, GLTF, OBJ, FBX (Max 100MB per file)
              </p>
              <Button asChild>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    multiple
                    accept=".glb,.gltf,.obj,.fbx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Choose Files
                </label>
              </Button>
            </div>

            {uploadedFiles.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium">
                  Uploaded Files ({uploadedFiles.length})
                </h4>
                <div className="space-y-2">
                  {uploadedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-2 flex-1">
                        {getFileIcon(file.name)}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {file.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {file.status === "uploading" && (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all duration-300"
                                style={{ width: `${file.progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {file.progress}%
                            </span>
                          </div>
                        )}

                        {file.status === "success" && (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}

                        {file.status === "error" && (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(file.id)}
                          className="h-6 w-6 p-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={() => setCurrentStep(2)}
                disabled={uploadedFiles.length === 0}
              >
                Next: Model Details
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Model Details */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Model Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="product_name">Product Name *</Label>
                <Input
                  id="product_name"
                  value={modelData.product_name}
                  onChange={(e) =>
                    handleInputChange("product_name", e.target.value)
                  }
                  placeholder="Enter product name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={modelData.category}
                  onValueChange={(value) =>
                    handleInputChange("category", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subcategory">Subcategory</Label>
                <Select
                  value={modelData.subcategory}
                  onValueChange={(value) =>
                    handleInputChange("subcategory", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select subcategory" />
                  </SelectTrigger>
                  <SelectContent>
                    {modelData.category &&
                      categories
                        .find((c) => c.id === modelData.category)
                        ?.subcategories.map((sub) => (
                          <SelectItem key={sub} value={sub}>
                            {sub}
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="client">Client/Brand</Label>
                <Input
                  id="client"
                  value={modelData.client}
                  onChange={(e) => handleInputChange("client", e.target.value)}
                  placeholder="Enter client or brand name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={modelData.description}
                onChange={(e) =>
                  handleInputChange("description", e.target.value)
                }
                placeholder="Describe the product..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="materials">Materials (comma-separated)</Label>
                <Input
                  id="materials"
                  value={modelData.materials.join(", ")}
                  onChange={(e) =>
                    handleArrayInputChange("materials", e.target.value)
                  }
                  placeholder="Wood, Metal, Fabric..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="colors">Colors (comma-separated)</Label>
                <Input
                  id="colors"
                  value={modelData.colors.join(", ")}
                  onChange={(e) =>
                    handleArrayInputChange("colors", e.target.value)
                  }
                  placeholder="Brown, Black, White..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  value={modelData.tags.join(", ")}
                  onChange={(e) =>
                    handleArrayInputChange("tags", e.target.value)
                  }
                  placeholder="Modern, Minimalist, Office..."
                />
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>
                Back
              </Button>
              <Button onClick={() => setCurrentStep(3)}>
                Next: Review & Submit
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Review & Submit */}
      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Review & Submit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-3">Files to Upload</h4>
                <div className="space-y-2">
                  {uploadedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-2 p-2 border rounded"
                    >
                      {getFileIcon(file.name)}
                      <span className="text-sm truncate">{file.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {formatFileSize(file.size)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">Model Information</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <strong>Name:</strong>{" "}
                    {modelData.product_name || "Not specified"}
                  </div>
                  <div>
                    <strong>Category:</strong>{" "}
                    {modelData.category || "Not specified"}
                  </div>
                  <div>
                    <strong>Subcategory:</strong>{" "}
                    {modelData.subcategory || "Not specified"}
                  </div>
                  <div>
                    <strong>Client:</strong>{" "}
                    {modelData.client || "Not specified"}
                  </div>
                  {modelData.materials.length > 0 && (
                    <div>
                      <strong>Materials:</strong>{" "}
                      {modelData.materials.join(", ")}
                    </div>
                  )}
                  {modelData.colors.length > 0 && (
                    <div>
                      <strong>Colors:</strong> {modelData.colors.join(", ")}
                    </div>
                  )}
                  {modelData.tags.length > 0 && (
                    <div>
                      <strong>Tags:</strong> {modelData.tags.join(", ")}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please review all information before submitting. You can go back
                to make changes.
              </AlertDescription>
            </Alert>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(2)}>
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isUploading}
                className="gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload Models
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
