import React, { useState } from "react";
import { Button } from "@/components/ui/display/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/containers/dialog";
import { Check, ChevronLeft } from "lucide-react";

interface ProductConfiguratorProps {
  onGenerate: (settings: {
    resolution: string;
    imageFormat: string;
    quality: string;
    renderMargin: number;
    cameraViews: string[];
  }) => void;
  onCancel: () => void;
  selectedProducts: Array<{
    id: string;
    product_name: string;
    glb_link: string;
    category?: string;
  }>;
  currentSettings: {
    resolution: string;
    imageFormat: string;
    quality: string;
    renderMargin: number;
    cameraViews: string[];
  };
}

const ProductConfigurator: React.FC<ProductConfiguratorProps> = ({
  onGenerate,
  onCancel,
  selectedProducts,
  currentSettings,
}) => {
  const [settings, setSettings] = useState(currentSettings);

  const handleSubmit = () => {
    onGenerate(settings);
  };

  const cameraViewOptions = [
    { id: "front", label: "Front" },
    { id: "angled_side1", label: "45° Front-Side" },
    { id: "angled_side1_flat", label: "45° Front-Side (Flat)" },
    { id: "side", label: "Side" },
    { id: "angled_side2", label: "45° Back-Side" },
    { id: "angled_side2_flat", label: "45° Back-Side (Flat)" },
    { id: "back", label: "Back" },
    { id: "top", label: "Top" },
  ];

  return (
    <Dialog open={true} onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-lg sm:text-xl font-semibold">
            Rendering Settings
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Configure render options for {selectedProducts.length} product
            {selectedProducts.length > 1 ? "s" : ""}
          </p>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-6">
          {/* Configuration Settings */}
          <div className="bg-card border border-border rounded-lg p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {/* Resolution */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Resolution</label>
                <select
                  value={settings.resolution}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      resolution: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                >
                  <option value="1024x1024">1024×1024</option>
                  <option value="2048x2048">2048×2048</option>
                  <option value="4096x4096">4096×4096</option>
                  <option value="1920x1080">1920×1080 (16:9)</option>
                  <option value="3840x2160">3840×2160 (4K)</option>
                </select>
              </div>

              {/* Image Format */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Image Format</label>
                <select
                  value={settings.imageFormat}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      imageFormat: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                >
                  <option value="JPEG">JPEG (Smaller file size)</option>
                  <option value="PNG">PNG (Supports transparency)</option>
                  <option value="WEBP">WebP (Modern format)</option>
                  <option value="TIFF">TIFF (High quality)</option>
                </select>
              </div>

              {/* Quality */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Render Quality</label>
                <select
                  value={settings.quality}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      quality: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                >
                  <option value="low">Low (Faster)</option>
                  <option value="medium">Medium</option>
                  <option value="high">High (Slower)</option>
                </select>
              </div>

              {/* Render Margin */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Render Margin{" "}
                  <span className="text-primary font-semibold">
                    {settings.renderMargin}%
                  </span>
                </label>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={settings.renderMargin}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      renderMargin: parseInt(e.target.value),
                    }))
                  }
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Tight crop</span>
                  <span>More space</span>
                </div>
              </div>
            </div>

            {/* Camera Views */}
            <div className="space-y-4 mt-6">
              <h3 className="text-sm font-medium">Camera Views</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                {cameraViewOptions.map((view) => (
                  <label
                    key={view.id}
                    className="flex items-center gap-3 cursor-pointer group"
                  >
                    <div className="relative">
                      <input
                        type="checkbox"
                        id={view.id}
                        checked={settings.cameraViews.includes(view.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSettings((prev) => ({
                              ...prev,
                              cameraViews: [...prev.cameraViews, view.id],
                            }));
                          } else {
                            setSettings((prev) => ({
                              ...prev,
                              cameraViews: prev.cameraViews.filter(
                                (v) => v !== view.id
                              ),
                            }));
                          }
                        }}
                        className="peer sr-only"
                      />
                      <div className="w-5 h-5 border-2 border-input rounded peer-checked:bg-primary peer-checked:border-primary transition-all"></div>
                      <Check className="absolute top-0.5 left-0.5 h-4 w-4 text-primary-foreground opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                    </div>
                    <span className="text-sm group-hover:text-foreground transition-colors">
                      {view.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t flex-shrink-0">
          <Button
            onClick={onCancel}
            variant="outline"
            className="flex-1"
            size="sm"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="flex-1"
            size="sm"
            disabled={settings.cameraViews.length === 0}
          >
            Start Rendering
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductConfigurator;
