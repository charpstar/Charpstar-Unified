"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/contexts/useUser";
import { Button } from "@/components/ui/display";
import {
  X,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Sparkles,
  Navigation,
  Zap,
  Settings,
  User,
  Users,
  Rocket,
  SkipForward,
} from "lucide-react";

interface TourStep {
  id: string;
  title: string;
  description: string;
  position: "top" | "bottom" | "left" | "right";
  offset?: { x: number; y: number };
}

const CLIENT_DASHBOARD_TOUR_KEY = "client-dashboard-tour-completed";

const tourSteps: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to CharpstAR!",
    description:
      "You've successfully completed onboarding! Let's take a quick tour of your new dashboard to help you get started.",
    position: "bottom",
  },
  {
    id: "sidebar",
    title: "Navigation Sidebar",
    description:
      "This is your main navigation menu. Here you can access all the important features like Dashboard, Analytics, Asset Library, and more.",
    position: "right",
  },
  {
    id: "profile-widget",
    title: "Avatar & Profile",
    description:
      "Click on your avatar to customize your profile picture. You can choose from preset avatars or upload your own image to personalize your account.",
    position: "top",
  },

  {
    id: "quick-actions",
    title: "Quick Actions",
    description:
      "Access the most important features quickly without navigating through menus. Add products, review models, and more.",
    position: "left",
  },
  {
    id: "complete",
    title: "You're All Set!",
    description:
      "You now know the basics of your CharpstAR dashboard. Start by adding products, checking progress, or reviewing completed models.",
    position: "bottom",
  },
];

export function ClientDashboardTour() {
  const user = useUser();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    // Check if user has completed onboarding and hasn't seen the tour
    const hasCompletedTour = localStorage.getItem(CLIENT_DASHBOARD_TOUR_KEY);
    const isFirstTime = !user.metadata?.onboarding; // Just completed onboarding

    if (!hasCompletedTour && isFirstTime) {
      // Delay to ensure DOM is fully rendered
      setTimeout(() => {
        setIsVisible(true);
        updateTargetElement();
      }, 1500);
    }
  }, [user?.id, user?.metadata?.onboarding]);

  // Listen for reset tour event
  useEffect(() => {
    const handleResetTour = () => {
      // Clear the completion flag
      localStorage.removeItem(CLIENT_DASHBOARD_TOUR_KEY);
      // Start the tour immediately
      setCurrentStep(0);
      setIsVisible(true);
      setTimeout(() => {
        updateTargetElement();
      }, 100);
    };

    window.addEventListener("resetDashboardTour", handleResetTour);

    return () => {
      window.removeEventListener("resetDashboardTour", handleResetTour);
    };
  }, []);

  const updateTargetElement = () => {
    const step = tourSteps[currentStep];
    if (!step) return;

    // Clean up any existing virtual elements
    const existingVirtualElements = document.querySelectorAll(
      "[data-tour-virtual]"
    );
    existingVirtualElements.forEach((el) => el.remove());

    let element: HTMLElement | null = null;

    switch (step.id) {
      case "welcome":
        // Create a virtual element at the center of the screen
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
      case "sidebar":
        element = document.querySelector(
          '[data-slot="sidebar"]'
        ) as HTMLElement;
        break;
      case "profile-widget":
        element = document.querySelector(
          '[data-tour="profile"]'
        ) as HTMLElement;

        break;

      case "quick-actions":
        element = document.querySelector(
          '[data-tour="quick-actions"]'
        ) as HTMLElement;
        if (!element) {
          // Create a virtual element in the dashboard area
          element = document.createElement("div");
          element.setAttribute("data-tour-virtual", "true");
          element.style.position = "absolute";
          element.style.top = "350px";
          element.style.left = "300px";
          element.style.width = "300px";
          element.style.height = "150px";
          element.style.opacity = "0";
          element.style.pointerEvents = "none";
          document.body.appendChild(element);
        }
        break;
      case "complete":
        // Create a virtual element at the center of the screen (like welcome step)
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

    setTargetElement(element);
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
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const completeTour = () => {
    setIsVisible(false);
    localStorage.setItem(CLIENT_DASHBOARD_TOUR_KEY, "true");

    // Clean up any virtual elements
    const virtualElements = document.querySelectorAll("[data-tour-virtual]");
    virtualElements.forEach((el) => el.remove());
  };

  const skipTour = () => {
    completeTour();
  };

  if (!isVisible || !targetElement) return null;

  const step = tourSteps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === tourSteps.length - 1;

  // Calculate tooltip position
  const getTooltipPosition = () => {
    if (!targetElement) return { top: 0, left: 0 };

    const rect = targetElement.getBoundingClientRect();
    const tooltipWidth = 320;
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

    // Special handling for user profile to avoid overlap
    if (step.id === "user-profile") {
      // Position tooltip to the left of the user profile, but higher
      left = rect.left - tooltipWidth - padding;
      top = Math.max(
        20,
        Math.min(
          rect.top - tooltipHeight - 40, // Move higher by 40px
          window.innerHeight - tooltipHeight - 20
        )
      );

      // If tooltip would go off-screen to the left, position it above the user profile
      if (left < 20) {
        left = Math.max(20, rect.left + rect.width / 2 - tooltipWidth / 2);
        top = rect.top - tooltipHeight - padding - 20; // Move higher by 20px
      }
    }

    // Move all tooltips higher by 30px
    top = Math.max(20, top - 30);

    // Ensure tooltip stays within viewport
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

  // Get the appropriate icon for each step
  const getStepIcon = (stepId: string) => {
    switch (stepId) {
      case "welcome":
        return <Sparkles className="h-5 w-5 text-primary" />;
      case "sidebar":
        return <Navigation className="h-5 w-5 text-primary" />;
      case "profile-widget":
        return <Users className="h-5 w-5 text-primary" />;

      case "quick-actions":
        return <Zap className="h-5 w-5 text-primary" />;
      case "user-profile":
        return <User className="h-5 w-5 text-primary" />;
      case "complete":
        return <Rocket className="h-5 w-5 text-primary" />;
      default:
        return <HelpCircle className="h-5 w-5 text-primary" />;
    }
  };

  return (
    <>
      {/* Highlight */}
      {targetElement && step.id !== "welcome" && step.id !== "complete" && (
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
      {targetElement && step.id !== "welcome" && step.id !== "complete" && (
        <>
          {/* Full overlay */}
          <div className="fixed inset-0 z-40  transition-all duration-500 ease-out" />
          {/* Rounded cutout - creates the see-through window */}
          <div
            className="fixed z-40  transition-all duration-500 ease-out"
            style={{
              top: targetElement.getBoundingClientRect().top,
              left: targetElement.getBoundingClientRect().left,
              width: targetElement.getBoundingClientRect().width,
              height: targetElement.getBoundingClientRect().height,
              borderRadius: "16px",

              boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6), inset 0 0 20px ",
            }}
          />
        </>
      )}

      {/* Full overlay for welcome and complete steps */}
      {(step.id === "welcome" || step.id === "complete") && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={skipTour} />
      )}

      {/* Click handler for cutout overlay */}
      {targetElement && step.id !== "welcome" && step.id !== "complete" && (
        <div className="fixed inset-0 z-30" onClick={skipTour} />
      )}

      {/* Tooltip */}
      <div
        className="fixed z-50 bg-background/95 backdrop-blur-sm border border-border/50 rounded-xl shadow-2xl max-w-sm animate-in slide-in-from-bottom-2 duration-300"
        style={{
          top: position.top,
          left: position.left,
          width: "380px",
          maxHeight: "500px",
        }}
      >
        {/* Subtle glow effect instead of arrow */}
        {step.id !== "welcome" && step.id !== "complete" && (
          <div
            className="absolute transition-all duration-500 ease-out"
            style={{
              top: "-2px",
              left: "-2px",
              right: "-2px",
              bottom: "-2px",
              borderRadius: "inherit",

              filter: "blur(8px)",
              zIndex: -1,
            }}
          />
        )}

        <div className="p-6 flex flex-col h-full">
          {/* Header */}
          <div className="flex items-start justify-between mb-4 flex-shrink-0">
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

          {/* Content */}
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed flex-shrink-0">
            {step.description}
          </p>

          {/* Progress */}
          <div className="flex flex-col gap-3 mb-6 flex-shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Progress
              </span>
              <span className="text-xs text-muted-foreground">
                {currentStep + 1} of {tourSteps.length}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-primary to-primary/80 h-2 rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${((currentStep + 1) / tourSteps.length) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Actions - Fixed layout */}
          <div className="flex flex-col gap-3 mt-auto flex-shrink-0">
            {/* Main action buttons */}
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
                  <>
                    Complete
                    <Rocket className="h-4 w-4" />
                  </>
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

            {/* Skip button - centered */}
          </div>
        </div>
      </div>
    </>
  );
}

// Export a function to restart the tour
export const restartClientDashboardTour = () => {
  localStorage.removeItem(CLIENT_DASHBOARD_TOUR_KEY);
  window.location.reload();
};
