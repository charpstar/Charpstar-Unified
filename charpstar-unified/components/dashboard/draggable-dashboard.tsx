"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import { Switch } from "@/components/ui/inputs";
import { Settings, Save, RotateCcw, X, Move, Eye } from "lucide-react";
import { useToast } from "@/components/ui/utilities";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/contexts/useUser";

interface DashboardWidget {
  id: string;
  title: string;
  type: "stats" | "chart" | "actions" | "profile" | "custom";
  size: "small" | "medium" | "large";
  position: { x: number; y: number };
  visible: boolean;
  content: React.ReactNode;
}

interface DraggableDashboardProps {
  onLayoutChange?: (layout: DashboardWidget[]) => void;
  defaultLayout?: DashboardWidget[];
}

export function DraggableDashboard({
  onLayoutChange,
  defaultLayout = [],
}: DraggableDashboardProps) {
  const [widgets, setWidgets] = useState<DashboardWidget[]>(defaultLayout);
  const [isEditMode, setIsEditMode] = useState(false);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedSavedLayout, setHasLoadedSavedLayout] = useState(false);
  const [showEditModeTip, setShowEditModeTip] = useState(false);
  const { toast } = useToast();
  const user = useUser();

  // Initialize widgets when defaultLayout changes, but only if we haven't loaded a saved layout
  useEffect(() => {
    if (!hasLoadedSavedLayout) {
      setWidgets(defaultLayout);
    }
  }, [defaultLayout, hasLoadedSavedLayout]);

  // Load user's saved layout from Supabase on component mount
  useEffect(() => {
    if (user?.id && !hasLoadedSavedLayout) {
      loadUserLayout();
    }
  }, [user?.id, hasLoadedSavedLayout]);

  // Debug: Log widgets state changes
  useEffect(() => {
    console.log(
      "Widgets state updated:",
      widgets.map((w) => ({ id: w.id, visible: w.visible }))
    );
  }, [widgets]);

  // Show custom notification when entering edit mode (only once)
  useEffect(() => {
    if (isEditMode) {
      const hasShownTip = localStorage.getItem("dashboard-edit-mode-tip-shown");
      if (!hasShownTip) {
        setShowEditModeTip(true);
        localStorage.setItem("dashboard-edit-mode-tip-shown", "true");

        // Auto-hide after 5 seconds
        const timer = setTimeout(() => {
          setShowEditModeTip(false);
        }, 5000);

        return () => clearTimeout(timer);
      }
    } else {
      setShowEditModeTip(false);
    }
  }, [isEditMode]);

  // Load user's layout from Supabase
  const loadUserLayout = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("dashboard_layouts")
        .select("layout_data")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 = no rows returned
        console.error("Error loading layout:", error);
        return;
      }

      if (data?.layout_data) {
        // Merge saved layout with default layout to restore content
        const savedLayout = data.layout_data;
        const mergedLayout = savedLayout.map((savedWidget: any) => {
          const defaultWidget = defaultLayout.find(
            (w) => w.id === savedWidget.id
          );
          return {
            ...defaultWidget,
            ...savedWidget,
            // Keep the content from default layout
            content: defaultWidget?.content || null,
          };
        });

        setWidgets(mergedLayout);
        setHasLoadedSavedLayout(true);

        toast({
          title: "Layout loaded!",
          description: "Your saved dashboard layout has been restored.",
        });
      } else {
        // No saved layout found, mark as loaded to prevent overwriting
        setHasLoadedSavedLayout(true);
      }
    } catch (error) {
      console.error("Load error:", error);
      toast({
        title: "Error loading layout",
        description: "Failed to load your saved dashboard layout.",
        variant: "destructive",
      });
      // Mark as loaded even on error to prevent infinite retries
      setHasLoadedSavedLayout(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Save layout to Supabase
  const saveLayout = async () => {
    if (!user?.id) {
      toast({
        title: "Not logged in",
        description: "Please log in to save your layout.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    console.log("Save layout called, widgets:", widgets);

    try {
      // Create a serializable version of the layout (without React components)
      const serializableLayout = widgets.map((widget) => ({
        id: widget.id,
        title: widget.title,
        type: widget.type,
        size: widget.size,
        position: widget.position,
        visible: widget.visible,
        // Don't include content as it contains React components
      }));

      console.log("Serializable layout:", serializableLayout);

      // Upsert the layout (insert or update)
      const { error } = await supabase.from("dashboard_layouts").upsert(
        {
          user_id: user.id,
          layout_data: serializableLayout,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        }
      );

      if (error) {
        throw error;
      }

      toast({
        title: "Layout saved!",
        description: "Your dashboard layout has been saved to the cloud.",
      });
      onLayoutChange?.(widgets);
    } catch (error) {
      console.error("Save error:", error);
      toast({
        title: "Error saving layout",
        description: "Failed to save your dashboard layout to the cloud.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to default layout
  const resetLayout = async () => {
    if (!user?.id) {
      setWidgets(defaultLayout);
      setHasLoadedSavedLayout(false);
      toast({
        title: "Layout reset!",
        description: "Dashboard layout has been reset to default.",
      });
      return;
    }

    try {
      // Delete the saved layout from Supabase
      const { error } = await supabase
        .from("dashboard_layouts")
        .delete()
        .eq("user_id", user.id);

      if (error) {
        console.error("Error deleting layout:", error);
      }

      setWidgets(defaultLayout);
      setHasLoadedSavedLayout(false);
      toast({
        title: "Layout reset!",
        description: "Dashboard layout has been reset to default.",
      });
    } catch (error) {
      console.error("Reset error:", error);
      toast({
        title: "Error resetting layout",
        description: "Failed to reset your dashboard layout.",
        variant: "destructive",
      });
    }
  };

  // Toggle widget visibility
  const toggleWidget = (widgetId: string) => {
    setWidgets((prev) =>
      prev.map((widget) =>
        widget.id === widgetId
          ? { ...widget, visible: !widget.visible }
          : widget
      )
    );
  };

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, widgetId: string) => {
    if (!isEditMode) return;
    setDraggedWidget(widgetId);
    e.dataTransfer.effectAllowed = "move";
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent) => {
    if (!isEditMode) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  // Handle drop
  const handleDrop = (e: React.DragEvent, targetWidgetId: string) => {
    if (!isEditMode || !draggedWidget || draggedWidget === targetWidgetId)
      return;
    e.preventDefault();

    setWidgets((prev) => {
      const draggedIndex = prev.findIndex((w) => w.id === draggedWidget);
      const targetIndex = prev.findIndex((w) => w.id === targetWidgetId);

      if (draggedIndex === -1 || targetIndex === -1) {
        console.error("Widget not found:", { draggedWidget, targetWidgetId });
        return prev;
      }

      const newWidgets = [...prev];
      const [draggedWidgetItem] = newWidgets.splice(draggedIndex, 1);
      newWidgets.splice(targetIndex, 0, draggedWidgetItem);

      console.log("Widgets reordered:", {
        dragged: draggedWidget,
        target: targetWidgetId,
        newOrder: newWidgets.map((w) => w.id),
      });

      return newWidgets;
    });

    setDraggedWidget(null);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedWidget(null);
  };

  // Widget size classes
  const getSizeClasses = (size: string) => {
    switch (size) {
      case "small":
        return "col-span-1 row-span-1";
      case "medium":
        return "col-span-2 row-span-1";
      case "large":
        return "col-span-2 row-span-2";
      default:
        return "col-span-1 row-span-1";
    }
  };

  return (
    <div className="space-y-4">
      {/* Dashboard Controls */}
      <div className="flex items-center justify-between p-4 bg-card max-w-fit rounded-lg border">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            <span className="text-sm text-muted-foreground">View Mode</span>
            <Switch checked={isEditMode} onCheckedChange={setIsEditMode} />
            <Settings className="h-4 w-4" />
            <span className="text-sm text-muted-foreground">Edit Mode</span>
          </div>
        </div>

        {isEditMode && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={saveLayout}
              disabled={isSaving}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Saving..." : "Save Layout"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={loadUserLayout}
              disabled={isLoading}
              className="flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              {isLoading ? "Loading..." : "Load Layout"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={resetLayout}
              className="flex items-center gap-2 cursor-pointer"
            >
              <X className="h-4 w-4" />
              Reset
            </Button>
          </div>
        )}
      </div>

      {/* Edit Mode Tip Notification */}
      {showEditModeTip && (
        <div className="relative">
          <div className="absolute top-0 left-0 z-50 animate-in slide-in-from-top-2 duration-300">
            <div className="bg-primary text-primary-foreground px-4 py-3 rounded-lg shadow-lg max-w-sm">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <Settings className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Edit Mode Enabled</p>
                  <p className="text-xs opacity-90 mt-1">
                    Tip: You can move around all the widgets freely and then
                    save your layout!
                  </p>
                </div>
                <button
                  onClick={() => setShowEditModeTip(false)}
                  className="flex-shrink-0 text-primary-foreground/70 hover:text-primary-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isEditMode && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Widget Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {widgets.map((widget) => (
                <div
                  key={widget.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-200 ${
                    widget.visible
                      ? "bg-primary/5 border-primary/20 shadow-sm"
                      : "bg-muted/30 border-muted-foreground/20"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-3 w-3 rounded-full ${
                        widget.visible ? "bg-primary" : "bg-muted-foreground/30"
                      }`}
                    />
                    <div>
                      <span
                        className={`text-sm font-medium ${
                          widget.visible
                            ? "text-foreground"
                            : "text-muted-foreground"
                        }`}
                      >
                        {widget.title}
                      </span>
                      <div className="text-xs text-muted-foreground">
                        {widget.visible ? "Visible" : "Hidden"}
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={widget.visible}
                    onCheckedChange={() => toggleWidget(widget.id)}
                    className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/30 cursor-pointer"
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Quick Actions</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setWidgets((prev) =>
                        prev.map((w) => ({ ...w, visible: true }))
                      );
                    }}
                    className="h-7 px-2 text-xs cursor-pointer"
                  >
                    Show All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setWidgets((prev) =>
                        prev.map((w) => ({ ...w, visible: false }))
                      );
                    }}
                    className="h-7 px-2 text-xs cursor-pointer"
                  >
                    Hide All
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {/* Widget Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {widgets
          .filter((widget) => widget.visible)
          .map((widget) => {
            const isDragging = draggedWidget === widget.id;

            return (
              <div
                key={widget.id}
                className={`${getSizeClasses(widget.size)} transition-all duration-200 ${
                  isEditMode ? "cursor-move" : ""
                } ${isDragging ? "opacity-50 scale-95" : ""}`}
                draggable={isEditMode}
                onDragStart={(e) => handleDragStart(e, widget.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, widget.id)}
                onDragEnd={handleDragEnd}
              >
                <Card
                  className={`h-full transition-all duration-200 ${
                    isDragging ? "border-primary/50 shadow-lg" : ""
                  }`}
                >
                  <CardContent className="pt-0">{widget.content}</CardContent>
                </Card>
              </div>
            );
          })}
      </div>
    </div>
  );
}
