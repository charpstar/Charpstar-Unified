"use client";

import { useState } from "react";
import { Button } from "@/components/ui/display";
import { Input } from "@/components/ui/inputs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/containers";
import { Edit2, Check, X } from "lucide-react";
import { toast } from "sonner";

interface SubcategoryEditorProps {
  assetId: string;
  currentSubcategory: string | null;
  category: string;
  isMissing: boolean;
  onUpdate: (newSubcategory: string) => void;
  className?: string;
  variant?: "inline" | "modal";
}

// Common subcategories by category - you can expand this based on your actual categories
const SUBCATEGORY_OPTIONS: Record<string, string[]> = {
  Furniture: [
    "Chairs",
    "Tables",
    "Sofas",
    "Beds",
    "Storage",
    "Desks",
    "Shelves",
    "Cabinets",
    "Stools",
    "Benches",
  ],
  Lighting: [
    "Ceiling Lights",
    "Table Lamps",
    "Floor Lamps",
    "Wall Sconces",
    "Pendant Lights",
    "Chandeliers",
    "Task Lighting",
    "Ambient Lighting",
  ],
  Decor: [
    "Vases",
    "Mirrors",
    "Artwork",
    "Candles",
    "Plants",
    "Rugs",
    "Curtains",
    "Pillows",
    "Clocks",
    "Sculptures",
  ],
  Kitchen: [
    "Appliances",
    "Cookware",
    "Dinnerware",
    "Glassware",
    "Cutlery",
    "Storage",
    "Small Appliances",
    "Kitchen Tools",
  ],
  Bathroom: [
    "Fixtures",
    "Accessories",
    "Towels",
    "Storage",
    "Mirrors",
    "Lighting",
    "Shower",
    "Vanity",
  ],
  Office: [
    "Desks",
    "Chairs",
    "Storage",
    "Lighting",
    "Accessories",
    "Filing",
    "Monitors",
    "Keyboards",
  ],
  Outdoor: [
    "Garden Furniture",
    "Planters",
    "Lighting",
    "Decor",
    "Storage",
    "Grills",
    "Umbrellas",
    "Cushions",
  ],
  Bedroom: [
    "Beds",
    "Nightstands",
    "Dressers",
    "Lighting",
    "Storage",
    "Mirrors",
    "Rugs",
    "Curtains",
  ],
  "Living Room": [
    "Sofas",
    "Chairs",
    "Tables",
    "Storage",
    "Lighting",
    "Rugs",
    "Curtains",
    "Entertainment",
  ],
  "Dining Room": [
    "Tables",
    "Chairs",
    "Storage",
    "Lighting",
    "Serveware",
    "Linens",
    "Centerpieces",
    "Barware",
  ],
};

export function SubcategoryEditor({
  assetId,
  currentSubcategory,
  category,

  onUpdate,
  className = "",
  variant = "inline",
}: SubcategoryEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newSubcategory, setNewSubcategory] = useState(
    currentSubcategory || ""
  );
  const [isUpdating, setIsUpdating] = useState(false);

  const subcategoryOptions = SUBCATEGORY_OPTIONS[category] || [];
  const hasOptions = subcategoryOptions.length > 0;

  const handleSave = async () => {
    if (!newSubcategory.trim()) {
      toast.error("Subcategory cannot be empty");
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch("/api/assets/update-subcategory", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assetId,
          subcategory: newSubcategory.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update subcategory");
      }

      onUpdate(newSubcategory.trim());
      setIsEditing(false);

      toast.success("Subcategory updated successfully");
    } catch (error) {
      console.error("Error updating subcategory:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update subcategory"
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setNewSubcategory(currentSubcategory || "");
    setIsEditing(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (variant === "modal") {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            <Edit2 className="h-3 w-3 mr-1" />
            Edit Subcategory
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Subcategory</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Category</label>
              <p className="text-sm text-muted-foreground">{category}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Subcategory</label>
              {hasOptions ? (
                <Select
                  value={newSubcategory}
                  onValueChange={setNewSubcategory}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select subcategory" />
                  </SelectTrigger>
                  <SelectContent>
                    {subcategoryOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={newSubcategory}
                  onChange={(e) => setNewSubcategory(e.target.value)}
                  placeholder="Enter subcategory"
                  onKeyPress={handleKeyPress}
                />
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isUpdating}>
                {isUpdating ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Inline variant
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {isEditing ? (
        <div className="flex items-center gap-1">
          {hasOptions ? (
            <Select value={newSubcategory} onValueChange={setNewSubcategory}>
              <SelectTrigger className="w-32 h-6 text-xs">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {subcategoryOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={newSubcategory}
              onChange={(e) => setNewSubcategory(e.target.value)}
              placeholder="Enter subcategory"
              className="w-32 h-6 text-xs"
              onKeyPress={handleKeyPress}
            />
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSave}
            disabled={isUpdating}
            className="h-6 w-6 p-0"
          >
            <Check className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCancel}
            className="h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <span className="text-xs">
            {currentSubcategory || (
              <span className="text-yellow-200 dark:text-yellow-400 font-medium  py-1 ">
                No subcategory
              </span>
            )}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsEditing(true)}
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Edit2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
