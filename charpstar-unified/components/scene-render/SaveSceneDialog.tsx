import React, { useState } from "react";
import { Button } from "@/components/ui/display/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/containers/dialog";
import { Input } from "@/components/ui/inputs";
import { Label } from "@/components/ui/display";
import { Textarea } from "@/components/ui/inputs";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SaveSceneDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    product_name: string;
    category: string;
    description: string;
    client: string;
  }) => Promise<void>;
  isLoading?: boolean;
  initialData?: {
    product_name?: string;
    category?: string;
    description?: string;
    client?: string;
  };
}

const SaveSceneDialog: React.FC<SaveSceneDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  isLoading = false,
  initialData,
}) => {
  const [formData, setFormData] = useState({
    product_name: initialData?.product_name || "",
    category: initialData?.category || "Generated Scene",
    description: initialData?.description || "",
    client: initialData?.client || "",
  });

  // Update form data when initialData changes
  React.useEffect(() => {
    if (initialData) {
      setFormData({
        product_name: initialData.product_name || "",
        category: initialData.category || "Generated Scene",
        description: initialData.description || "",
        client: initialData.client || "",
      });
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.product_name.trim()) {
      toast.error("Product name is required");
      return;
    }

    try {
      await onSave(formData);
      toast.success("Scene saved to asset library!");
      onClose();
      // Reset form
      setFormData({
        product_name: "",
        category: "Generated Scene",
        description: "",
        client: "",
      });
    } catch {
      toast.error("Failed to save scene");
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            Save Scene to Asset Library
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="product_name">
              Product Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="product_name"
              value={formData.product_name}
              onChange={(e) =>
                handleInputChange("product_name", e.target.value)
              }
              placeholder="e.g., Modern Living Room Scene"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={formData.category}
              onChange={(e) => handleInputChange("category", e.target.value)}
              placeholder="e.g., Generated Scene"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client">Client</Label>
            <Input
              id="client"
              value={formData.client}
              onChange={(e) => handleInputChange("client", e.target.value)}
              placeholder="e.g., Your Company Name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Describe this generated scene..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save to Library
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SaveSceneDialog;
