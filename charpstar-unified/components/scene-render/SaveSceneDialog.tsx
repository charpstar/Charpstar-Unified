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
    description: string;
  }) => Promise<void>;
  isLoading?: boolean;
  initialData?: {
    product_name?: string;
    description?: string;
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
    description: initialData?.description || "",
  });

  // Update form data when initialData changes
  React.useEffect(() => {
    if (initialData) {
      setFormData({
        product_name: initialData.product_name || "",
        description: initialData.description || "",
      });
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("SaveSceneDialog handleSubmit called", formData);

    if (!formData.product_name.trim()) {
      toast.error("Product name is required");
      return;
    }

    try {
      console.log("Calling onSave with:", formData);
      await onSave(formData);
      console.log("onSave completed successfully");
      // Don't show toast here - let the onSave function handle it
      onClose();
      // Reset form
      setFormData({
        product_name: "",
        description: "",
      });
    } catch (error) {
      console.error("Error in SaveSceneDialog handleSubmit:", error);
      // Don't show error toast here either - let the onSave function handle it
      // Just close the dialog
      onClose();
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
