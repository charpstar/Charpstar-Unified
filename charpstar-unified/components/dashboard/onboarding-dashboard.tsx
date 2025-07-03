"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import { useUser } from "@/contexts/useUser";
import {
  UserPlus,
  Package,
  CheckCircle,
  ArrowRight,
  Building,
  Shield,
  Mail,
  Phone,
  Globe,
  Link,
  Clock,
  Users,
} from "lucide-react";

interface OnboardingStep {
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  completed: boolean;
  action?: () => void;
}

export function OnboardingDashboard() {
  const user = useUser();
  const router = useRouter();
  const [completingOnboarding, setCompletingOnboarding] = useState(false);
  const [hasReloaded, setHasReloaded] = useState(false);

  const handleCompleteOnboarding = async () => {
    setCompletingOnboarding(true);
    try {
      const response = await fetch("/api/users/complete-onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user?.id,
        }),
      });

      if (response.ok) {
        // Refresh the page to show the regular dashboard
        window.location.reload();
      } else {
        throw new Error("Failed to complete onboarding");
      }
    } catch (error) {
      console.error("Error completing onboarding:", error);
    } finally {
      setCompletingOnboarding(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "client":
        return (
          <Badge variant="default" className="gap-1">
            <UserPlus className="h-3 w-3" />
            Client
          </Badge>
        );
      case "modeler":
        return (
          <Badge variant="secondary" className="gap-1">
            <Building className="h-3 w-3" />
            3D Modeler
          </Badge>
        );
      case "qa":
        return (
          <Badge variant="outline" className="gap-1">
            <Shield className="h-3 w-3" />
            Quality Assurance
          </Badge>
        );
      default:
        return <Badge variant="secondary">{role}</Badge>;
    }
  };

  const getOnboardingSteps = (): OnboardingStep[] => {
    const role = user?.metadata?.role;

    switch (role) {
      case "client":
        return [
          {
            title: "CSV Upload",
            description: "Upload your product data and specifications",
            icon: Package,
            completed: user?.metadata?.csv_uploaded || false,
            action: () => router.push("/onboarding/csv-upload"),
          },
          {
            title: "Reference Images Upload",
            description: "Upload reference images for your products",
            icon: Package,
            completed: user?.metadata?.reference_images_uploaded || false,
            action: () => router.push("/onboarding/reference-images"),
          },
        ];
      case "modeler":
        return [
          {
            title: "Complete Profile Setup",
            description: "Add your experience, portfolio, and availability",
            icon: UserPlus,
            completed: !!(
              user?.metadata?.title &&
              user?.metadata?.phone_number &&
              user?.metadata?.country &&
              user?.metadata?.portfolio_links?.length
            ),
          },
          {
            title: "Upload Portfolio",
            description: "Add your best work samples",
            icon: Package,
            completed: false,
          },
          {
            title: "Review Guidelines",
            description: "Read quality standards and requirements",
            icon: CheckCircle,
            completed: false,
          },
        ];
      case "qa":
        return [
          {
            title: "Complete Profile Setup",
            description: "Add your contact information and Discord",
            icon: UserPlus,
            completed: !!(
              user?.metadata?.phone_number && user?.metadata?.discord_name
            ),
          },
          {
            title: "Review Quality Standards",
            description: "Understand testing requirements",
            icon: Shield,
            completed: false,
          },
          {
            title: "Access Test Environment",
            description: "Get familiar with testing tools",
            icon: CheckCircle,
            completed: false,
          },
        ];
      default:
        return [];
    }
  };

  const steps = getOnboardingSteps();
  const completedSteps = steps.filter((step) => step.completed).length;
  const totalSteps = steps.length;

  // Auto-refresh when all steps are complete - DISABLED to prevent infinite loops
  // useEffect(() => {
  //   if (
  //     completedSteps === totalSteps &&
  //     totalSteps > 0 &&
  //     user?.metadata?.onboarding === true &&
  //     !hasReloaded
  //   ) {
  //     // Wait a moment for the database trigger to update onboarding status
  //     const timer = setTimeout(() => {
  //       // Only reload if onboarding is still true (meaning the trigger hasn't updated yet)
  //       if (user?.metadata?.onboarding === true && !hasReloaded) {
  //         console.log("Auto-reloading due to completed onboarding steps");
  //         setHasReloaded(true);
  //         window.location.reload();
  //       }
  //     }, 3000); // Increased delay to give more time for the trigger

  //     return () => clearTimeout(timer);
  //   }
  // }, [completedSteps, totalSteps, user?.metadata?.onboarding, hasReloaded]);

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 mb-4">
              {getRoleBadge(user?.metadata?.role || "")}
            </div>
            <h1 className="text-3xl font-bold text-foreground">
              Welcome to CharpstAR!
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              We're excited to have you on board. Let's get you set up and ready
              to work. Complete the steps below to unlock full access to the
              platform.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            Onboarding Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm text-muted-foreground">
                {completedSteps} of {totalSteps} steps completed
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${(completedSteps / totalSteps) * 100}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Onboarding Steps */}
      <div className="grid gap-6 lg:gap-8">
        {steps.map((step, index) => (
          <Card
            key={index}
            className={`${
              step.completed ? "border-primary/20 bg-primary/5" : ""
            } transition-all duration-200 hover:shadow-md`}
          >
            <CardContent className="p-6 lg:p-8">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
                <div
                  className={`flex-shrink-0 h-12 w-12 lg:h-16 lg:w-16 rounded-full flex items-center justify-center ${
                    step.completed
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step.completed ? (
                    <CheckCircle className="h-6 w-6 lg:h-8 lg:w-8" />
                  ) : (
                    <step.icon className="h-6 w-6 lg:h-8 lg:w-8" />
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <h3
                      className={`text-lg lg:text-xl font-semibold ${
                        step.completed ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {step.title}
                    </h3>
                    <div className="flex items-center gap-3">
                      {step.completed ? (
                        <Badge variant="default" className="gap-1 px-3 py-1">
                          <CheckCircle className="h-4 w-4" />
                          Completed
                        </Badge>
                      ) : (
                        <>
                          <Badge variant="outline" className="px-3 py-1">
                            Pending
                          </Badge>
                          {step.action && (
                            <Button
                              size="default"
                              onClick={step.action}
                              className="gap-2 px-4 py-2"
                            >
                              Start
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <p className="text-base lg:text-lg text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                  {!step.completed && step.action && (
                    <div className="pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={step.action}
                        className="gap-2 lg:hidden"
                      >
                        Start This Step
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Complete Onboarding Button */}
      {completedSteps === totalSteps && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="h-16 w-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Onboarding Complete!
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  You've completed all the setup steps. You can now access the
                  full platform.
                </p>
              </div>
              <Button
                size="lg"
                className="gap-2"
                onClick={handleCompleteOnboarding}
                disabled={completingOnboarding}
              >
                {completingOnboarding ? (
                  "Completing..."
                ) : (
                  <>
                    Complete Onboarding
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
