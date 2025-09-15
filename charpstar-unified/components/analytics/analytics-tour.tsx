"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/display";
import { Card, CardContent } from "@/components/ui/containers";
import { Calendar, X, ChevronRight } from "lucide-react";

interface AnalyticsTourProps {
  onComplete: () => void;
  onSkip: () => void;
}

const tourSteps = [
  {
    id: "date-range",
    title: "Date Range Picker",
    description:
      "Select your date range to view analytics data for specific periods. This controls all the metrics and charts on this page.",
    icon: "Calendar" as const,
    target: "date-range-picker",
  },
];

const iconMap: Record<string, React.ComponentType<any>> = {
  Calendar,
};

export function AnalyticsTour({ onComplete, onSkip }: AnalyticsTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const currentTourStep = tourSteps[currentStep];
  const IconComponent =
    iconMap[currentTourStep.icon as keyof typeof iconMap] || Calendar;

  const getTargetElement = () => {
    const step = tourSteps[currentStep];

    switch (step.target) {
      case "date-range-picker":
        return document.querySelector(
          '[data-tour="date-range-picker"]'
        ) as HTMLElement;

      default:
        return null;
    }
  };

  const getVirtualElement = () => {
    const step = tourSteps[currentStep];

    switch (step.target) {
      case "date-range-picker":
        // Create a virtual element for the date range picker area
        const header = document.querySelector("header");
        if (header) {
          const rect = header.getBoundingClientRect();
          return {
            getBoundingClientRect: () => ({
              top: rect.bottom - 50,
              left: rect.right - 200,
              width: 180,
              height: 40,
              right: rect.right - 20,
              bottom: rect.bottom - 10,
            }),
          };
        }
        break;

      default:
        return null;
    }
  };

  const targetElement = getTargetElement() || getVirtualElement();

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    setIsVisible(false);
    setTimeout(() => {
      onComplete();
    }, 300);
  };

  const handleSkip = () => {
    setIsVisible(false);
    setTimeout(() => {
      onSkip();
    }, 300);
  };

  if (!isVisible) return null;

  const getTooltipPosition = () => {
    if (!targetElement)
      return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

    const rect = targetElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const tooltipHeight = 200;
    const tooltipWidth = 320;

    // Calculate position
    let top = rect.bottom + 20;
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;

    // Adjust if tooltip goes off screen
    if (top + tooltipHeight > viewportHeight - 20) {
      top = rect.top - tooltipHeight - 20;
    }
    if (left < 20) {
      left = 20;
    }
    if (left + tooltipWidth > viewportWidth - 20) {
      left = viewportWidth - tooltipWidth - 20;
    }

    return { top: `${top}px`, left: `${left}px` };
  };

  const tooltipPosition = getTooltipPosition();

  return (
    <>
      {/* Highlight */}
      {targetElement && (
        <div
          className="fixed z-50 shadow-lg transition-all duration-500 ease-out"
          style={{
            top: targetElement.getBoundingClientRect().top - 4,
            left: targetElement.getBoundingClientRect().left - 4,
            width: targetElement.getBoundingClientRect().width + 8,
            height: targetElement.getBoundingClientRect().height + 8,
            borderRadius: "12px",
            boxShadow:
              "0 0 0 9999px rgba(0, 0, 0, 0.3), 0 0 0 4px hsl(var(--primary)), 0 0 20px rgba(59, 130, 246, 0.4)",
            backgroundColor: "transparent",
            backdropFilter: "none",
          }}
        />
      )}

      {/* Overlay with cutout for highlighted element */}
      {targetElement && (
        <>
          {/* Full overlay */}
          <div className="fixed inset-0 z-40 transition-all duration-500 ease-out" />
          {/* Rounded cutout - creates the see-through window */}
          <div
            className="fixed z-40 transition-all duration-500 ease-out"
            style={{
              top: targetElement.getBoundingClientRect().top,
              left: targetElement.getBoundingClientRect().left - 200,
              width: targetElement.getBoundingClientRect().width + 135,
              height: targetElement.getBoundingClientRect().height + 10,
              borderRadius: "16px",
              boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6), inset 0 0 10px",
            }}
          />
        </>
      )}

      {/* Click handler for cutout overlay */}
      {targetElement && (
        <div className="fixed inset-0 z-30" onClick={handleSkip} />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-[1001] pointer-events-auto transition-all duration-300 ease-in-out"
        style={tooltipPosition}
      >
        <Card className="w-80 shadow-2xl border-0 bg-background backdrop-blur-sm">
          <CardContent className="p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <IconComponent className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">
                    {currentTourStep.title}
                  </h3>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              {currentTourStep.description}
            </p>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <Button
                onClick={handleNext}
                size="sm"
                className="flex items-center w-full gap-2 cursor-pointer"
              >
                <>
                  Complete
                  <ChevronRight className="h-4 w-4" />
                </>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
