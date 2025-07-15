"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Switch } from "@/components/ui/inputs";
import {
  Settings,
  Save,
  RotateCcw,
  X,
  Undo2,
  Redo2,
  Lightbulb,
} from "lucide-react";
import { useToast } from "@/components/ui/utilities";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/contexts/useUser";
import { motion, AnimatePresence } from "framer-motion";

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
  defaultLayout?: DashboardWidget[];
}

// History management for undo/redo
interface LayoutHistory {
  layouts: DashboardWidget[][];
  currentIndex: number;
}

export function DraggableDashboard({
  defaultLayout = [],
}: DraggableDashboardProps) {
  const [widgets, setWidgets] = useState<DashboardWidget[]>(defaultLayout);
  const [isEditMode, setIsEditMode] = useState(false);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedWidget, setExpandedWidget] = useState<string | null>(null);
  const [hasLoadedSavedLayout, setHasLoadedSavedLayout] = useState(false);
  const [layoutHistory, setLayoutHistory] = useState<LayoutHistory>({
    layouts: [defaultLayout],
    currentIndex: 0,
  });

  const { toast } = useToast();
  const user = useUser();

  // Save layout to history
  const saveToHistory = useCallback((newLayout: DashboardWidget[]) => {
    setLayoutHistory((prev) => {
      const newHistory = {
        layouts: [...prev.layouts.slice(0, prev.currentIndex + 1), newLayout],
        currentIndex: prev.currentIndex + 1,
      };
      // Keep only last 10 layouts to prevent memory issues
      if (newHistory.layouts.length > 10) {
        newHistory.layouts = newHistory.layouts.slice(-10);
        newHistory.currentIndex = 9;
      }
      return newHistory;
    });
  }, []);

  // Undo functionality
  const undo = useCallback(() => {
    if (layoutHistory.currentIndex > 0) {
      const newIndex = layoutHistory.currentIndex - 1;
      const previousLayout = layoutHistory.layouts[newIndex];
      setWidgets(previousLayout);
      setLayoutHistory((prev) => ({ ...prev, currentIndex: newIndex }));
      toast({
        title: "Undone",
        description: "Layout change has been undone.",
      });
    }
  }, [layoutHistory, toast]);

  // Redo functionality
  const redo = useCallback(() => {
    if (layoutHistory.currentIndex < layoutHistory.layouts.length - 1) {
      const newIndex = layoutHistory.currentIndex + 1;
      const nextLayout = layoutHistory.layouts[newIndex];
      setWidgets(nextLayout);
      setLayoutHistory((prev) => ({ ...prev, currentIndex: newIndex }));
      toast({
        title: "Redone",
        description: "Layout change has been redone.",
      });
    }
  }, [layoutHistory, toast]);

  // Save layout function
  const saveLayout = useCallback(async () => {
    if (!user) return;

    setIsSaving(true);
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

      if (error) throw error;

      toast({
        title: "Layout Saved",
        description: "Your dashboard layout has been saved successfully.",
      });
    } catch (error) {
      console.error("Error saving layout:", error);
      toast({
        title: "Error",
        description: "Failed to save layout. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [widgets, user, toast]);

  // Load user layout
  const loadUserLayout = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("dashboard_layouts")
        .select("layout_data")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") throw error;

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
        saveToHistory(mergedLayout);
        setHasLoadedSavedLayout(true);
      } else {
        // No saved layout found, mark as loaded to prevent overwriting
        setHasLoadedSavedLayout(true);
      }
    } catch (error) {
      console.error("Error loading layout:", error);
      // Mark as loaded even on error to prevent infinite retries
      setHasLoadedSavedLayout(true);
      toast({
        title: "Error",
        description: "Failed to load layout. Using default layout.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast, saveToHistory, defaultLayout]);

  // Reset layout
  const resetLayout = useCallback(() => {
    setWidgets(defaultLayout);
    saveToHistory(defaultLayout);
    toast({
      title: "Layout Reset",
      description: "Dashboard layout has been reset to default.",
    });
  }, [defaultLayout, saveToHistory, toast]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "z":
            e.preventDefault();
            if (e.shiftKey) {
              redo();
            } else {
              undo();
            }
            break;
          case "y":
            e.preventDefault();
            redo();
            break;
          case "s":
            e.preventDefault();
            if (isEditMode) {
              saveLayout();
            }
            break;
          case "e":
            e.preventDefault();
            setIsEditMode(!isEditMode);
            break;
        }
      } else if (e.key === "Escape") {
        if (isEditMode) {
          setIsEditMode(false);
        }
        if (expandedWidget) {
          setExpandedWidget(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditMode, expandedWidget, undo, redo, saveLayout]);

  // Initialize widgets when defaultLayout changes
  useEffect(() => {
    if (!hasLoadedSavedLayout) {
      setWidgets(defaultLayout);
      setLayoutHistory({
        layouts: [defaultLayout],
        currentIndex: 0,
      });
    }
  }, [defaultLayout, hasLoadedSavedLayout]);

  // Load user's saved layout from Supabase on component mount
  useEffect(() => {
    if (user?.id && !hasLoadedSavedLayout) {
      loadUserLayout();
    }
  }, [user?.id, hasLoadedSavedLayout, loadUserLayout]);

  // Debug: Log widgets state changes
  useEffect(() => {
    console.log(
      "Widgets state updated:",
      widgets.map((w) => ({ id: w.id, visible: w.visible }))
    );
  }, [widgets]);

  // Toggle widget visibility
  const toggleWidget = useCallback(
    (widgetId: string) => {
      setWidgets((prev) => {
        const newWidgets = prev.map((widget) =>
          widget.id === widgetId
            ? { ...widget, visible: !widget.visible }
            : widget
        );
        saveToHistory(newWidgets);
        return newWidgets;
      });
    },
    [saveToHistory]
  );

  // Handle drag start
  const handleDragStart = useCallback(
    (e: React.DragEvent, widgetId: string) => {
      if (!isEditMode) return;
      setDraggedWidget(widgetId);
      e.dataTransfer.effectAllowed = "move";
    },
    [isEditMode]
  );

  // Handle drag over
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!isEditMode) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    },
    [isEditMode]
  );

  // Handle drop
  const handleDrop = useCallback(
    (e: React.DragEvent, targetWidgetId: string) => {
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

        saveToHistory(newWidgets);
        return newWidgets;
      });

      setDraggedWidget(null);
    },
    [isEditMode, draggedWidget, saveToHistory]
  );

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setDraggedWidget(null);
  }, []);

  // Widget size classes
  const getSizeClasses = (size: string) => {
    switch (size) {
      case "small":
        return "col-span-1 row-span-1";
      case "medium":
        return "col-span-1 md:col-span-2 row-span-1";
      case "large":
        return "col-span-1 md:col-span-2 lg:col-span-2 row-span-1 lg:row-span-2";
      default:
        return "col-span-1 row-span-1";
    }
  };

  return (
    <div className="space-y-4">
      {/* Dashboard Controls */}
      <motion.div
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-card max-w-fit rounded-lg border min-h-[68px] gap-4"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        data-tour="dashboard-controls"
      >
        <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <Switch
              checked={isEditMode}
              onCheckedChange={setIsEditMode}
              className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/30 cursor-pointer transition-all duration-200"
            />
            <Settings className="h-4 w-4" />
            <span className="text-sm text-muted-foreground hidden sm:inline">
              Edit Layout
            </span>
          </div>
        </div>

        <AnimatePresence>
          {isEditMode && (
            <motion.div
              className="flex flex-wrap items-center gap-2 pl-0 sm:pl-4 overflow-hidden w-full sm:w-auto"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{
                duration: 0.15,
                ease: "easeOut",
              }}
            >
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "auto", opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="overflow-hidden"
                style={{ minWidth: 0 }}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={saveLayout}
                  disabled={isSaving}
                  className="flex items-center gap-2 cursor-pointer h-8 hover:bg-primary/10 transition-all duration-75 whitespace-nowrap min-w-0 text-xs sm:text-sm"
                >
                  <Save className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="truncate">
                    {isSaving ? "Saving..." : "Save"}
                  </span>
                </Button>
              </motion.div>

              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "auto", opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut", delay: 0.05 }}
                className="overflow-hidden"
                style={{ minWidth: 0 }}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadUserLayout}
                  disabled={isLoading}
                  className="flex items-center gap-2 cursor-pointer h-8 hover:bg-primary/10 transition-all duration-75 whitespace-nowrap min-w-0 text-xs sm:text-sm"
                >
                  <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="truncate">
                    {isLoading ? "Loading..." : "Load"}
                  </span>
                </Button>
              </motion.div>

              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "auto", opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut", delay: 0.1 }}
                className="overflow-hidden"
                style={{ minWidth: 0 }}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetLayout}
                  className="flex items-center gap-2 cursor-pointer h-8 hover:bg-destructive/10 hover:text-destructive transition-all duration-75 whitespace-nowrap min-w-0 text-xs sm:text-sm"
                >
                  <X className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="truncate">Reset</span>
                </Button>
              </motion.div>

              {/* Undo/Redo buttons */}
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "auto", opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut", delay: 0.15 }}
                className="overflow-hidden flex items-center gap-1"
                style={{ minWidth: 0 }}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={undo}
                  disabled={layoutHistory.currentIndex === 0}
                  className="h-8 w-8 p-0 hover:bg-primary/10 transition-all duration-200"
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={redo}
                  disabled={
                    layoutHistory.currentIndex ===
                    layoutHistory.layouts.length - 1
                  }
                  className="h-8 w-8 p-0 hover:bg-primary/10 transition-all duration-200"
                  title="Redo (Ctrl+Y)"
                >
                  <Redo2 className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Keyboard shortcuts hint */}
        <AnimatePresence>
          {isEditMode && (
            <motion.div
              className="text-xs text-muted-foreground mt-2 w-full sm:w-auto"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.15, ease: "easeOut", delay: 0.2 }}
            >
              <span className="hidden lg:inline">
                <Lightbulb className="h-4 w-4 inline-block" /> Tip: Use Ctrl+Z
                to undo, Ctrl+Y to redo, Ctrl+S to save, or Escape to exit edit
                mode
              </span>
              <span className="hidden sm:inline lg:hidden">
                <Lightbulb className="h-4 w-4 inline-block" /> Tip: Use Ctrl+Z/Y
                to undo/redo, Ctrl+S to save
              </span>
              <span className="sm:hidden">
                <Lightbulb className="h-4 w-4 inline-block" /> Tip: Use Escape
                to exit edit mode
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {isEditMode && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <Card className="mt-4">
              <CardHeader>
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15, ease: "easeOut", delay: 0.05 }}
                >
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Widget Settings
                  </CardTitle>
                </motion.div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {widgets.map((widget) => (
                    <motion.div
                      key={widget.id}
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{
                        duration: 0.15,
                        ease: "easeOut",
                      }}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-200 ${
                        widget.visible
                          ? "bg-primary/5 border-primary/20 shadow-sm"
                          : "bg-muted/30 border-muted-foreground/20"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <motion.div
                          className={`h-3 w-3 rounded-full flex-shrink-0 ${
                            widget.visible
                              ? "bg-primary"
                              : "bg-muted-foreground/30"
                          }`}
                          animate={{
                            scale: widget.visible ? [1, 1.2, 1] : 1,
                          }}
                          transition={{
                            duration: 0.15,
                            ease: "easeOut",
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <span
                            className={`text-sm font-medium truncate block ${
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
                        className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/30 cursor-pointer transition-all duration-75 flex-shrink-0"
                        style={{
                          transitionProperty:
                            "background, box-shadow, transform",
                          transitionDuration: "75ms",
                        }}
                        onClick={(e) => {
                          const el = e.currentTarget;
                          el.animate(
                            [
                              { transform: "scale(1)" },
                              { transform: "scale(1.12)" },
                              { transform: "scale(1)" },
                            ],
                            {
                              duration: 120,
                              easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
                            }
                          );
                        }}
                      />
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Widget Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {widgets
          .filter((widget) => widget.visible)
          .map((widget, index) => {
            const isDragging = draggedWidget === widget.id;
            const isExpanded = expandedWidget === widget.id;

            return (
              <div
                key={widget.id}
                className={`${getSizeClasses(widget.size)} ${
                  isEditMode ? "cursor-move" : ""
                } ${isExpanded ? "col-span-full row-span-2" : ""} rounded-lg`}
                draggable={isEditMode}
                onDragStart={(e: React.DragEvent) =>
                  handleDragStart(e, widget.id)
                }
                onDragOver={(e: React.DragEvent) => handleDragOver(e)}
                onDrop={(e: React.DragEvent) => handleDrop(e, widget.id)}
                onDragEnd={() => handleDragEnd()}
                data-tour={
                  widget.id === "quick-actions"
                    ? "quick-actions"
                    : widget.id === "model-status"
                      ? "model-status"
                      : widget.id === "status-pie-chart"
                        ? "status-chart"
                        : widget.id === "profile"
                          ? "profile"
                          : undefined
                }
              >
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{
                    opacity: isDragging ? 0.5 : 1,
                    y: 0,
                    scale: isDragging ? 0.95 : 1,
                  }}
                  transition={{
                    duration: 0.15,
                    ease: "easeOut",
                    delay: index * 0.02,
                  }}
                  whileTap={{
                    scale: isEditMode ? 0.98 : 1,
                    transition: { duration: 0.1 },
                  }}
                  layout
                >
                  <Card
                    className={`h-full transition-all duration-200  rounded-lg ${
                      isDragging ? "shadow-lg" : ""
                    }`}
                  >
                    <CardContent className="pt-0 p-4 sm:p-3">
                      {widget.content}
                    </CardContent>
                  </Card>
                </motion.div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
