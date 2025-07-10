"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLoading } from "@/contexts/LoadingContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import { Progress } from "@/components/ui/feedback";
import { useUser } from "@/contexts/useUser";
import {
  UserPlus,
  Package,
  CheckCircle,
  ArrowRight,
  Building,
  Shield,
  Clock,
  Sparkles,
  HelpCircle,
  ChevronRight,
  Play,
  Lock,
  Trophy,
  Target,
} from "lucide-react";
import confetti from "canvas-confetti";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  completed: boolean;
  action?: () => void;
  disabled?: boolean;
  helpText?: string;
  estimatedTime?: string;
}

export function OnboardingDashboard() {
  const user = useUser();
  const router = useRouter();
  const { startLoading } = useLoading();
  const [completingOnboarding, setCompletingOnboarding] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

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
        // Trigger confetti animation
        setShowConfetti(true);

        // Fire confetti with better configuration
        confetti({
          particleCount: 150,
          spread: 90,
          origin: { y: 0.6, x: 0.5 },
          colors: ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444"],
          zIndex: 9999,
        });

        // Wait for confetti animation, then reload
        setTimeout(() => {
          window.location.reload();
        }, 2500);
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
          <Badge
            variant="default"
            className="gap-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0"
          >
            <UserPlus className="h-3 w-3" />
            Client
          </Badge>
        );
      case "modeler":
        return (
          <Badge
            variant="secondary"
            className="gap-1 bg-gradient-to-r from-purple-500 to-purple-600 text-white border-0"
          >
            <Building className="h-3 w-3" />
            3D Modeler
          </Badge>
        );
      case "qa":
        return (
          <Badge
            variant="outline"
            className="gap-1 bg-gradient-to-r from-green-500 to-green-600 text-white border-0"
          >
            <Shield className="h-3 w-3" />
            Quality Assurance
          </Badge>
        );
      default:
        return <Badge variant="secondary">{role}</Badge>;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "client":
        return <Target className="h-8 w-8 text-blue-500" />;
      case "modeler":
        return <Building className="h-8 w-8 text-purple-500" />;
      case "qa":
        return <Shield className="h-8 w-8 text-green-500" />;
      default:
        return <UserPlus className="h-8 w-8 text-muted-foreground" />;
    }
  };

  const getRoleWelcomeMessage = (role: string) => {
    switch (role) {
      case "client":
        return "Ready to bring your products to life with stunning 3D models?";
      case "modeler":
        return "Ready to showcase your 3D modeling expertise?";
      case "qa":
        return "Ready to ensure quality and excellence?";
      default:
        return "Welcome to the team!";
    }
  };

  const getOnboardingSteps = (): OnboardingStep[] => {
    const role = user?.metadata?.role;

    switch (role) {
      case "client":
        return [
          {
            id: "csv-upload",
            title: "CSV Upload",
            description:
              "Upload your product data and specifications to get started",
            icon: Package,
            completed: user?.metadata?.csv_uploaded || false,
            action: () => {
              startLoading();
              router.push("/onboarding/csv-upload");
            },
            disabled: false,
            helpText:
              "Upload a CSV file with your product information. We'll use this to create your 3D models.",
            estimatedTime: "2-3 minutes",
          },
          {
            id: "reference-images",
            title: "Reference Images Upload",
            description: "Upload reference images for your products",
            icon: Package,
            completed: user?.metadata?.reference_images_uploaded || false,
            action: user?.metadata?.csv_uploaded
              ? () => {
                  startLoading();
                  router.push("/onboarding/reference-images");
                }
              : undefined,
            disabled: !user?.metadata?.csv_uploaded,
            helpText:
              "Add reference images to help our modelers understand your product requirements.",
            estimatedTime: "5-10 minutes",
          },
        ];
      case "modeler":
        return [
          {
            id: "profile-setup",
            title: "Complete Profile Setup",
            description: "Add your experience, portfolio, and availability",
            icon: UserPlus,
            completed: !!(
              user?.metadata?.title &&
              user?.metadata?.phone_number &&
              user?.metadata?.country &&
              user?.metadata?.portfolio_links?.length
            ),
            helpText:
              "Tell us about your experience and showcase your best work.",
            estimatedTime: "10-15 minutes",
          },
          {
            id: "portfolio",
            title: "Upload Portfolio",
            description: "Add your best work samples",
            icon: Package,
            completed: false,
            helpText:
              "Upload examples of your 3D modeling work to showcase your skills.",
            estimatedTime: "15-20 minutes",
          },
          {
            id: "guidelines",
            title: "Review Guidelines",
            description: "Read quality standards and requirements",
            icon: CheckCircle,
            completed: false,
            helpText:
              "Familiarize yourself with our quality standards and project requirements.",
            estimatedTime: "5-10 minutes",
          },
        ];
      case "qa":
        return [
          {
            id: "profile-setup",
            title: "Complete Profile Setup",
            description: "Add your contact information and Discord",
            icon: UserPlus,
            completed: !!(
              user?.metadata?.phone_number && user?.metadata?.discord_name
            ),
            helpText:
              "Provide your contact details and Discord username for team communication.",
            estimatedTime: "5 minutes",
          },
          {
            id: "quality-standards",
            title: "Review Quality Standards",
            description: "Understand testing requirements",
            icon: Shield,
            completed: false,
            helpText:
              "Learn about our quality assurance processes and testing criteria.",
            estimatedTime: "10-15 minutes",
          },
          {
            id: "test-environment",
            title: "Access Test Environment",
            description: "Get familiar with testing tools",
            icon: CheckCircle,
            completed: false,
            helpText: "Set up and explore our testing environment and tools.",
            estimatedTime: "15-20 minutes",
          },
        ];
      default:
        return [];
    }
  };

  const steps = getOnboardingSteps();
  const completedSteps = steps.filter((step) => step.completed).length;
  const totalSteps = steps.length;
  const progressPercentage =
    totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  const getStepStatus = (step: OnboardingStep, index: number) => {
    if (step.completed) return "completed";
    if (step.disabled) return "locked";
    if (index === 0 || steps[index - 1]?.completed) return "available";
    return "locked";
  };

  return (
    <div className="h-full bg-gradient-to-br from-background via-background to-muted/20">
      {/* Confetti Overlay */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/80" />
        </div>
      )}

      <div className="max-w-16xl mx-auto p-2 space-y-8">
        {/* Enhanced Welcome Header */}
        <Card className="relative overflow-hidden bg-muted/50">
          <div className=" inset-0 bg-muted/50" />
          <CardContent className="relative ">
            <div className="text-center space-y-6">
              {/* Role Badge */}
              <div className="flex items-center justify-center gap-2 mb-6">
                {getRoleBadge(user?.metadata?.role || "")}
              </div>

              {/* Welcome Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-3 mb-4">
                  {getRoleIcon(user?.metadata?.role || "")}
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                    Welcome to CharpstAR!
                  </h1>
                </div>

                <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                  {getRoleWelcomeMessage(user?.metadata?.role || "")} Let&apos;s
                  get you set up and ready to work. Complete the steps below to
                  unlock full access to the platform.
                </p>

                {/* Quick Stats */}
                <div className="flex items-center justify-center gap-6 mt-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>~{Math.ceil(totalSteps * 5)} minutes total</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Target className="h-4 w-4" />
                    <span>{totalSteps} steps to complete</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Progress Overview */}
        <Card className="bg-gradient-to-r from-background to-muted/20 border-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="relative">
                <CheckCircle className="h-6 w-6 text-primary" />
                {progressPercentage === 100 && (
                  <Sparkles className="h-4 w-4 text-yellow-500 absolute -top-1 -right-1 animate-pulse" />
                )}
              </div>
              Onboarding Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Progress Bar */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Overall Progress</span>
                  <span className="text-sm text-muted-foreground">
                    {completedSteps} of {totalSteps} steps completed
                  </span>
                </div>
                <div className="relative">
                  <Progress value={progressPercentage} className="h-3" />
                </div>
              </div>

              {/* Progress Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="text-center">
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-primary">
                      {completedSteps}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Completed
                    </div>
                  </CardContent>
                </Card>
                <Card className="text-center">
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-muted-foreground">
                      {totalSteps - completedSteps}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Remaining
                    </div>
                  </CardContent>
                </Card>
                <Card className="text-center">
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-green-600">
                      {Math.round(progressPercentage)}%
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Complete
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Stepper Navigation */}
        <div className="relative">
          {/* Stepper Line */}

          <div className="space-y-6">
            {steps.map((step, index) => {
              const status = getStepStatus(step, index);
              const isExpanded = expandedStep === step.id;

              return (
                <Card
                  key={step.id}
                  className={`
                    relative transition-all duration-300 hover:shadow-lg
                    ${step.completed ? "border-primary/30 bg-primary/5" : ""}
                    ${step.disabled ? "opacity-60" : ""}
                    ${status === "available" ? "border-primary/20 hover:border-primary/40" : ""}
                    ${isExpanded ? "ring-2 ring-primary/20" : ""}
                  `}
                >
                  <CardContent className="p-6 lg:p-8">
                    <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                      {/* Step Icon */}
                      <div className="relative flex-shrink-0">
                        <div
                          className={`
                            h-16 w-16 rounded-full flex items-center justify-center transition-all duration-300
                            ${
                              step.completed
                                ? "bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg"
                                : status === "available"
                                  ? "bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg"
                                  : status === "locked"
                                    ? "bg-muted text-muted-foreground"
                                    : "bg-muted text-muted-foreground"
                            }
                          `}
                        >
                          {step.completed ? (
                            <CheckCircle className="h-8 w-8" />
                          ) : status === "locked" ? (
                            <Lock className="h-8 w-8" />
                          ) : (
                            <step.icon className="h-8 w-8" />
                          )}
                        </div>

                        {/* Step Number */}
                        <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                          <span className="text-xs font-bold text-primary">
                            {index + 1}
                          </span>
                        </div>
                      </div>

                      {/* Step Content */}
                      <div className="flex-1 min-w-0 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <h3
                                className={`text-xl lg:text-2xl font-bold ${
                                  step.completed
                                    ? "text-green-600"
                                    : "text-foreground"
                                }`}
                              >
                                {step.title}
                              </h3>
                              {step.estimatedTime && (
                                <Badge variant="outline" className="text-xs">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {step.estimatedTime}
                                </Badge>
                              )}
                            </div>
                            <p className="text-base lg:text-lg text-muted-foreground leading-relaxed">
                              {step.description}
                            </p>
                          </div>

                          {/* Status and Actions */}
                          <div className="flex items-center gap-3">
                            {step.completed ? (
                              <Badge
                                variant="default"
                                className="gap-2 px-4 py-2 bg-green-500 text-white"
                              >
                                <CheckCircle className="h-4 w-4" />
                                Completed
                              </Badge>
                            ) : (
                              <>
                                {!step.disabled && status === "available" && (
                                  <Badge
                                    variant="outline"
                                    className="px-4 py-2"
                                  >
                                    Available
                                  </Badge>
                                )}
                                {step.disabled && (
                                  <Badge
                                    variant="outline"
                                    className="px-4 py-2 text-muted-foreground"
                                  >
                                    <Lock className="h-3 w-3 mr-1" />
                                    Locked
                                  </Badge>
                                )}
                                {step.action && status === "available" && (
                                  <Button
                                    size="default"
                                    onClick={step.action}
                                    className="gap-2 px-6 py-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 cursor-pointer"
                                    disabled={step.disabled}
                                  >
                                    <Play className="h-4 w-4" />
                                    Start
                                    <ArrowRight className="h-4 w-4" />
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        {/* Expandable Help Section */}
                        {step.helpText && (
                          <div className="space-y-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setExpandedStep(isExpanded ? null : step.id)
                              }
                              className="gap-2 text-muted-foreground hover:text-foreground"
                            >
                              <HelpCircle className="h-4 w-4" />
                              {isExpanded ? "Hide" : "Show"} help
                              <ChevronRight
                                className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                              />
                            </Button>

                            {isExpanded && (
                              <div className="p-4 bg-muted/50 rounded-lg border border-border">
                                <p className="text-sm text-muted-foreground">
                                  {step.helpText}
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Mobile Action Button */}
                        {!step.completed &&
                          step.action &&
                          status === "available" && (
                            <div className="pt-2 lg:hidden">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={step.action}
                                className="gap-2 w-full"
                              >
                                <Play className="h-3 w-3" />
                                Start This Step
                                <ArrowRight className="h-3 w-3" />
                              </Button>
                            </div>
                          )}

                        {/* Disabled Message */}
                        {step.disabled && (
                          <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-border">
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                              <Lock className="h-4 w-4" />
                              You must complete the CSV Upload step before
                              uploading reference images.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Enhanced Completion Card */}
        {completedSteps === totalSteps && totalSteps > 0 && (
          <Card className="relative overflow-hidden bg-gradient-to-r from-green-500/10 via-green-500/5 to-green-500/10 border-green-500/20">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-transparent" />
            <CardContent className="relative pt-8 pb-8">
              <div className="text-center space-y-6">
                {/* Celebration Icon */}
                <div className="relative">
                  <div className="h-20 w-20 mx-auto rounded-full bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center shadow-lg">
                    <Trophy className="h-10 w-10 text-white" />
                  </div>
                </div>

                {/* Completion Message */}
                <div className="space-y-3 ">
                  <h3 className="text-2xl font-bold text-foreground">
                    All Steps Complete!
                  </h3>
                  <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                    Fantastic! You&apos;ve successfully completed all onboarding
                    steps. You&apos;re now ready to access the full CharpstAR
                    platform
                  </p>
                </div>

                {/* Next Steps */}
                <div className="bg-background/50 rounded-lg p-4 border border-green-500/20 w-fit mx-auto">
                  <h4 className="font-semibold text-foreground mb-2">
                    Ready to get started?
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Explore your personalized dashboard</li>
                    <li>• Keep track of the whole process of your project</li>
                  </ul>
                </div>

                {/* Complete Button */}
                <div className="space-y-3">
                  <Button
                    size="lg"
                    className="gap-3 px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg text-lg font-semibold cursor-pointer"
                    onClick={handleCompleteOnboarding}
                    disabled={completingOnboarding}
                  >
                    {completingOnboarding ? (
                      <>
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Completing Onboarding...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-5 w-5" />
                        Complete Onboarding & Go to Dashboard
                        <ArrowRight className="h-5 w-5" />
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    This will finalize your onboarding and take you to your main
                    dashboard
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Help Section */}
      </div>
    </div>
  );
}
