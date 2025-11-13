"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/display";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Target,
  Package,
  TrendingUp,
} from "lucide-react";
import { createPortal } from "react-dom";

interface TourStep {
  id: string;
  title: string;
  description: string;
  position: "top" | "bottom" | "left" | "right";
}

const ASSIGNMENTS_TOUR_KEY = "modeler-assignments-tour-completed";

const steps: TourStep[] = [
  {
    id: "summary-grid",
    title: "Overview Cards",
    description:
      "Quick overview of batches, potential earnings, urgent assets, and completed earnings.",
    position: "bottom",
  },
  {
    id: "batch-list",
    title: "Batch List",
    description:
      "Each card represents a client batch. Click a card to view its allocations.",
    position: "top",
  },
  {
    id: "first-batch",
    title: "First Batch",
    description:
      "Start here to see details, progress, and deadlines for this batch.",
    position: "top",
  },
];

export function ModelerAssignmentsTour() {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(0);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [vw, setVw] = useState(0);
  const [vh, setVh] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const completed = localStorage.getItem(ASSIGNMENTS_TOUR_KEY);
    if (!completed) {
      const t = setTimeout(() => {
        setVisible(true);
        updateTarget();
      }, 800);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    updateTarget();
  }, [current]);

  // Keep viewport size and target rect in sync with scroll/resize
  useEffect(() => {
    const handleResize = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
      setTick((t) => t + 1);
    };
    const handleScroll = () => setTick((t) => t + 1);
    handleResize();
    window.addEventListener("resize", handleResize);
    // capture scroll on nested containers too
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, []);

  const getEl = (id: string): HTMLElement | null => {
    switch (id) {
      case "summary-grid":
        return document.querySelector(
          '[data-tour="assignments-summary"]'
        ) as HTMLElement;
      case "batch-list":
        return document.querySelector(
          '[data-tour="assignments-batch-list"]'
        ) as HTMLElement;
      case "first-batch":
        return document.querySelector(
          '[data-tour="assignments-first-batch"]'
        ) as HTMLElement;
      default:
        return null;
    }
  };

  const updateTarget = () => {
    const step = steps[current];
    if (!step) return;
    const el = getEl(step.id);
    setTarget(el || null);
  };

  const complete = () => {
    localStorage.setItem(ASSIGNMENTS_TOUR_KEY, "true");
    setVisible(false);
  };

  const skip = () => complete();

  if (!visible || !target) return null;

  const step = steps[current];
  const isFirst = current === 0;
  const isLast = current === steps.length - 1;

  const rect = target.getBoundingClientRect();

  // Tooltip positioning
  const tooltipWidth = 360;
  const tooltipHeight = 200;
  const padding = 20;
  let top = 0;
  let left = 0;
  switch (step.position) {
    case "top":
      top = rect.top - tooltipHeight - padding;
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
      break;
    case "bottom":
      top = rect.bottom + padding;
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
      break;
    case "left":
      top = rect.top + rect.height / 2 - tooltipHeight / 2;
      left = rect.left - tooltipWidth - padding;
      break;
    case "right":
      top = rect.top + rect.height / 2 - tooltipHeight / 2;
      left = rect.right + padding;
      break;
  }
  top = Math.max(20, top - 20);
  if (left < 20) left = 20;
  if (left + tooltipWidth > window.innerWidth - 20) {
    left = window.innerWidth - tooltipWidth - 20;
  }
  if (top < 20) top = 20;
  if (top + tooltipHeight > window.innerHeight - 20) {
    top = window.innerHeight - tooltipHeight - 20;
  }

  const overlay = (
    <>
      {/* SVG overlay with masked cutout */}
      <svg
        className="fixed z-40"
        style={{ top: 0, left: 0, width: vw, height: vh }}
        viewBox={`0 0 ${vw} ${vh}`}
        preserveAspectRatio="none"
        onClick={skip}
      >
        <defs>
          <mask id="assignments-tour-mask" maskUnits="userSpaceOnUse">
            {/* Solid mask */}
            <rect x="0" y="0" width={vw} height={vh} fill="white" />
            {/* Transparent hole (animated via Framer Motion) */}
            <motion.rect
              x={rect.left - 4}
              y={rect.top - 4}
              width={rect.width + 8}
              height={rect.height + 8}
              rx={16}
              initial={{
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
                width: 0,
                height: 0,
                rx: 24,
              }}
              animate={{
                x: rect.left - 4,
                y: rect.top - 4,
                width: rect.width + 8,
                height: rect.height + 8,
                rx: 16,
              }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              fill="black"
            />
          </mask>
        </defs>
        {/* Dim overlay using the mask to cutout */}
        <rect
          x="0"
          y="0"
          width={vw}
          height={vh}
          fill="rgba(0,0,0,0.6)"
          mask="url(#assignments-tour-mask)"
        />
      </svg>

      {/* Subtle ring highlight around target */}
      <motion.div
        key={`ring-${step.id}`}
        className="fixed z-40 "
        initial={{
          top: rect.top + rect.height / 2,
          left: rect.left + rect.width / 2,
          width: 0,
          height: 0,
          borderRadius: "50%",
          opacity: 0.9,
        }}
        animate={{
          top: rect.top - 4,
          left: rect.left - 4,
          width: rect.width + 8,
          height: rect.height + 8,
          borderRadius: "16px",
          opacity: 1,
        }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{
          boxShadow:
            "0 0 0 4px hsl(var(--primary)), 0 0 30px rgba(59,130,246,0.5)",
          backgroundColor: "transparent",
          pointerEvents: "none",
        }}
      />

      {/* Tooltip */}
      <div
        className="fixed z-50 bg-background/95 backdrop-blur-sm border border-border/50 rounded-xl shadow-2xl max-w-sm animate-in slide-in-from-bottom-2 duration-300"
        style={{ top, left, width: tooltipWidth }}
      >
        <div className="p-6 flex flex-col">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                {step.id === "summary-grid" ? (
                  <TrendingUp className="h-5 w-5 text-primary" />
                ) : step.id === "batch-list" ? (
                  <Target className="h-5 w-5 text-primary" />
                ) : (
                  <Package className="h-5 w-5 text-primary" />
                )}
              </div>
              <h3 className="font-semibold text-foreground text-base">
                {step.title}
              </h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={skip}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            {step.description}
          </p>

          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrent((c) => Math.max(0, c - 1))}
              disabled={isFirst}
              className="gap-2 flex-1 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() =>
                isLast
                  ? complete()
                  : setCurrent((c) => Math.min(steps.length - 1, c + 1))
              }
              className="gap-2 flex-1 cursor-pointer"
            >
              {isLast ? (
                "Finish"
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(overlay, document.body);
}
