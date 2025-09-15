"use client";

import { useUser } from "@/contexts/useUser";
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/display";
import {
  X,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Sparkles,
  Navigation,
  Zap,
  Package,
  BarChart3,
  Rocket,
  SkipForward,
} from "lucide-react";

interface TourStep {
  id: string;
  title: string;
  description: string;
  position: "top" | "bottom" | "left" | "right";
}

const MODELER_DASHBOARD_TOUR_KEY = "modeler-dashboard-tour-completed";

const tourSteps: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to your Modeler Dashboard",
    description:
      "Here's a quick tour of the tools you'll use most. You can skip anytime.",
    position: "bottom",
  },
  {
    id: "sidebar",
    title: "Navigation Sidebar",
    description:
      "Use the sidebar to access assignments, guidelines, and other tools.",
    position: "right",
  },
  {
    id: "quick-actions",
    title: "Quick Actions",
    description:
      "Jump straight to My Assignments, view Guidelines, or open the model viewer.",
    position: "bottom",
  },
  {
    id: "modeler-stats",
    title: "Assignment Overview",
    description:
      "Track totals, in-progress work, and items waiting for approval at a glance.",
    position: "top",
  },
  {
    id: "modeler-earnings",
    title: "Earnings & Performance",
    description:
      "See earnings from approved allocation lists and recent performance trends.",
    position: "top",
  },
  {
    id: "complete",
    title: "You're ready!",
    description:
      "That's it. You're set to start modeling. Good luck and have fun!",
    position: "bottom",
  },
];

export function ModelerDashboardTour() {
  const user = useUser();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const hasCompletedTour = localStorage.getItem(MODELER_DASHBOARD_TOUR_KEY);
    if (!hasCompletedTour) {
      setTimeout(() => {
        setIsVisible(true);
        updateTargetElement();
      }, 1200);
    }
  }, [user?.id]);

  useEffect(() => {
    const handleResetTour = () => {
      localStorage.removeItem(MODELER_DASHBOARD_TOUR_KEY);
      setCurrentStep(0);
      setIsVisible(true);
      setTimeout(() => updateTargetElement(), 100);
    };
    window.addEventListener("resetModelerDashboardTour", handleResetTour);
    return () => {
      window.removeEventListener("resetModelerDashboardTour", handleResetTour);
    };
  }, []);

  const updateTargetElement = () => {
    const step = tourSteps[currentStep];
    if (!step) return;

    // Remove any previous virtual targets
    document
      .querySelectorAll("[data-tour-virtual]")
      .forEach((el) => el.remove());

    let element: HTMLElement | null = null;

    switch (step.id) {
      case "welcome": {
        element = document.createElement("div");
        element.setAttribute("data-tour-virtual", "true");
        element.style.position = "absolute";
        element.style.top = "50%";
        element.style.left = "50%";
        element.style.transform = "translate(-50%, -50%)";
        element.style.width = "1px";
        element.style.height = "1px";
        element.style.opacity = "0";
        element.style.pointerEvents = "none";
        document.body.appendChild(element);
        break;
      }
      case "sidebar":
        element = document.querySelector(
          '[data-slot="sidebar"]'
        ) as HTMLElement;
        break;
      case "quick-actions":
        element = document.querySelector(
          '[data-tour="modeler-quick-actions"]'
        ) as HTMLElement;
        break;
      case "modeler-stats":
        element = document.querySelector(
          '[data-tour="modeler-stats"]'
        ) as HTMLElement;
        break;
      case "modeler-earnings":
        element = document.querySelector(
          '[data-tour="modeler-earnings"]'
        ) as HTMLElement;
        break;
      case "complete": {
        element = document.createElement("div");
        element.setAttribute("data-tour-virtual", "true");
        element.style.position = "absolute";
        element.style.top = "50%";
        element.style.left = "50%";
        element.style.transform = "translate(-50%, -50%)";
        element.style.width = "1px";
        element.style.height = "1px";
        element.style.opacity = "0";
        element.style.pointerEvents = "none";
        document.body.appendChild(element);
        break;
      }
    }

    setTargetElement(element || null);
  };

  useEffect(() => {
    updateTargetElement();
  }, [currentStep]);

  const nextStep = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTour();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const completeTour = () => {
    setIsVisible(false);
    localStorage.setItem(MODELER_DASHBOARD_TOUR_KEY, "true");
    document
      .querySelectorAll("[data-tour-virtual]")
      .forEach((el) => el.remove());
  };

  const skipTour = () => completeTour();

  if (!isVisible || !targetElement) return null;

  const step = tourSteps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === tourSteps.length - 1;

  const getTooltipPosition = () => {
    const rect = targetElement.getBoundingClientRect();
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

    // Nudge upward a bit
    top = Math.max(20, top - 20);

    // Clamp to viewport
    if (left < 20) left = 20;
    if (left + tooltipWidth > window.innerWidth - 20) {
      left = window.innerWidth - tooltipWidth - 20;
    }
    if (top < 20) top = 20;
    if (top + tooltipHeight > window.innerHeight - 20) {
      top = window.innerHeight - tooltipHeight - 20;
    }

    return { top, left };
  };

  const position = getTooltipPosition();

  const getStepIcon = (id: string) => {
    switch (id) {
      case "welcome":
        return <Sparkles className="h-5 w-5 text-primary" />;
      case "sidebar":
        return <Navigation className="h-5 w-5 text-primary" />;
      case "quick-actions":
        return <Zap className="h-5 w-5 text-primary" />;
      case "modeler-stats":
        return <Package className="h-5 w-5 text-primary" />;
      case "modeler-earnings":
        return <BarChart3 className="h-5 w-5 text-primary" />;
      case "complete":
        return <Rocket className="h-5 w-5 text-primary" />;
      default:
        return <HelpCircle className="h-5 w-5 text-primary" />;
    }
  };

  return (
    <>
      {/* Highlight box */}
      {targetElement && step.id !== "welcome" && step.id !== "complete" && (
        <motion.div
          className="fixed z-50"
          animate={{
            top: targetElement.getBoundingClientRect().top - 4,
            left: targetElement.getBoundingClientRect().left - 4,
            width: targetElement.getBoundingClientRect().width + 8,
            height: targetElement.getBoundingClientRect().height + 8,
          }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: "fixed",
            borderRadius: "16px",
            boxShadow:
              typeof document !== "undefined" &&
              document.documentElement.classList.contains("dark")
                ? "0 0 0 9999px rgba(0,0,0,0.2), 0 0 0 5px hsl(var(--primary)), 0 0 60px rgba(59,130,246,0.9), 0 0 120px rgba(59,130,246,0.6)"
                : "0 0 0 9999px rgba(0,0,0,0.3), 0 0 0 4px hsl(var(--primary)), 0 0 30px rgba(59,130,246,0.5)",
            backgroundColor: "transparent",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Overlay with cutout for highlighted element */}
      {targetElement && step.id !== "welcome" && step.id !== "complete" && (
        <>
          {/* Full overlay */}
          <motion.div
            className=" inset-1 z-30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={skipTour}
          />
          {/* Rounded cutout - creates see-through window */}
          <motion.div
            className="fixed z-30 "
            animate={{
              top: targetElement.getBoundingClientRect().top,
              left: targetElement.getBoundingClientRect().left,
              width: targetElement.getBoundingClientRect().width,
              height: targetElement.getBoundingClientRect().height,
            }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: "fixed",
              borderRadius: "16px",
              boxShadow:
                "0 0 0 9999px rgba(0,0,0,0.6), inset 0 0 24px rgba(59,130,246,0.15)",
            }}
            onClick={skipTour}
          />
        </>
      )}

      {/* Overlay for welcome/complete */}
      {(step.id === "welcome" || step.id === "complete") && (
        <div
          className="inset-0 fixed bg-black/50 z-30 p-0 m-0"
          onClick={skipTour}
        />
      )}

      {/* Tooltip */}
      <div
        className="fixed z-50 bg-background/95 backdrop-blur-sm border border-border/50 rounded-xl shadow-2xl max-w-sm animate-in slide-in-from-bottom-2 duration-300"
        style={{ top: position.top, left: position.left, width: 360 }}
      >
        <div className="p-6 flex flex-col">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                {getStepIcon(step.id)}
              </div>
              <h3 className="font-semibold text-foreground text-base">
                {step.title}
              </h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={skipTour}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            {step.description}
          </p>

          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-muted-foreground">
              {currentStep + 1} of {tourSteps.length}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={prevStep}
              disabled={isFirstStep}
              className="gap-2 flex-1 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={nextStep}
              className="gap-2 flex-1 cursor-pointer"
            >
              {isLastStep ? (
                <>Complete</>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={skipTour}
              className="gap-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <SkipForward className="h-3 w-3" />
              Skip tour
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export const restartModelerDashboardTour = () => {
  localStorage.removeItem(MODELER_DASHBOARD_TOUR_KEY);
  window.location.reload();
};
