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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Badge, Alert, AlertDescription } from "@/components/ui/feedback";
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
  HelpCircle,
  ChevronRight,
  Play,
  Lock,
  Trophy,
  Target,
  Trash2,
  AlertCircle,
} from "lucide-react";
import confetti from "canvas-confetti";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  completed: boolean;
  action?: () => void;
  removeAction?: () => void;
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
  const [removingCsv, setRemovingCsv] = useState(false);
  const [showRemoveCsvDialog, setShowRemoveCsvDialog] = useState(false);

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

  const handleRemoveCsv = () => {
    setShowRemoveCsvDialog(true);
  };

  const confirmRemoveCsv = async () => {
    if (!user?.id) return;

    setRemovingCsv(true);
    try {
      // Update user metadata to remove csv_uploaded flag and delete assets
      const response = await fetch("/api/users/complete-csv-upload", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
        }),
      });

      if (response.ok) {
        // Reload the page to reflect the changes
        window.location.reload();
      } else {
        throw new Error("Failed to remove CSV upload");
      }
    } catch (error) {
      console.error("Error removing CSV upload:", error);
    } finally {
      setRemovingCsv(false);
      setShowRemoveCsvDialog(false);
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

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "client":
        return <Target className="h-8 w-8 text-blue-500" />;
      case "modeler":
        return <Building className="h-8 w-8 text-purple-500" />;
      case "qa":
        return <Shield className="h-8 w-8 text-muted-foreground" />;
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

            estimatedTime: "2-3 minutes",
            removeAction: user?.metadata?.csv_uploaded
              ? handleRemoveCsv
              : undefined,
          },

          {
            id: "reference-images",
            title: "Reference Images Upload",
            description: "Upload additional reference images for your products",
            icon: Package,
            completed: user?.metadata?.reference_images_uploaded || false,
            action: user?.metadata?.csv_uploaded
              ? () => {
                  startLoading();
                  router.push("/onboarding/reference-images");
                }
              : undefined,
            disabled: !user?.metadata?.csv_uploaded,

            estimatedTime: "5-10 minutes",
          },
        ];
      case "modeler":
      case "qa":
        // Modelers and QA users don't need onboarding - they go straight to dashboard
        return [];
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
    <div className="h-full">
      {/* Confetti Overlay */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50">
          <div className="absolute inset-0 bg-background/80" />
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
                  <h1 className="text-4xl font-bold text-foreground">
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

        {/* Progress Overview */}
        <Card className="border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="relative">
                <CheckCircle className="h-5 w-5 text-primary" />
              </div>
              Onboarding Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-4">
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Overall Progress</span>
                  <span className="text-sm text-muted-foreground">
                    {completedSteps} of {totalSteps} steps completed
                  </span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>

              {/* Progress Stats - Inline */}
              <div className="flex items-center justify-center gap-6 pt-2">
                <div className="text-center">
                  <div className="text-xl font-bold text-primary">
                    {completedSteps}
                  </div>
                  <div className="text-xs text-muted-foreground">Completed</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-muted-foreground">
                    {totalSteps - completedSteps}
                  </div>
                  <div className="text-xs text-muted-foreground">Remaining</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-medium text-primary">
                    {Math.round(progressPercentage)}%
                  </div>
                  <div className="text-xs text-muted-foreground">Complete</div>
                </div>
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
                  <CardContent className="p-6 lg:p-4">
                    <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                      {/* Step Icon */}
                      <div className="relative flex-shrink-0">
                        <div
                          className={`
                            h-16 w-16 rounded-full flex items-center justify-center transition-all duration-300
                            ${
                              step.completed
                                ? "bg-primary text-primary-foreground"
                                : status === "available"
                                  ? "bg-primary text-primary-foreground"
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
                                    ? "text-primary"
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
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="default"
                                  className="gap-2 px-4 py-2 bg-primary text-primary-foreground"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                  Completed
                                </Badge>
                                {step.removeAction && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={step.removeAction}
                                    disabled={removingCsv}
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                                    title="Reset CSV upload status (preserves data)"
                                  >
                                    {removingCsv ? (
                                      <>
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                                        <span className="ml-2">
                                          Removing...
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <Trash2 className="h-4 w-4" />
                                        <span className="ml-2">
                                          Reset CSV Status
                                        </span>
                                      </>
                                    )}
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <>
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
                                  <>
                                    {step.id === "csv-upload" ? (
                                      <>
                                        <Button
                                          onClick={() =>
                                            router.push(
                                              "/onboarding/manual-upload"
                                            )
                                          }
                                          disabled={step.disabled}
                                          className="gap-2 px-6 py-2"
                                        >
                                          <Play className="h-4 w-4" />
                                          Manual Upload
                                          <ArrowRight className="h-4 w-4" />
                                        </Button>

                                        <Button
                                          size="default"
                                          onClick={step.action}
                                          className="gap-2 px-6 py-2"
                                          disabled={step.disabled}
                                        >
                                          <Play className="h-4 w-4" />
                                          Upload With CSV
                                          <ArrowRight className="h-4 w-4" />
                                        </Button>
                                      </>
                                    ) : (
                                      <Button
                                        size="default"
                                        onClick={step.action}
                                        className="gap-2 px-6 py-2"
                                        disabled={step.disabled}
                                      >
                                        <Play className="h-4 w-4" />
                                        Continue
                                        <ArrowRight className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </>
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

        {/* Completion Card */}
        {completedSteps === totalSteps && totalSteps > 0 && (
          <Card className="border">
            <CardContent className="py-6">
              <div className="text-center space-y-4">
                {/* Celebration Icon */}
                <div className="h-12 w-12 mx-auto rounded-full bg-primary flex items-center justify-center">
                  <Trophy className="h-6 w-6 text-white" />
                </div>

                {/* Completion Message */}
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-foreground">
                    All Steps Complete!
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-lg mx-auto">
                    You&apos;ve successfully completed all onboarding steps.
                    You&apos;re now ready to access the full CharpstAR platform
                  </p>
                </div>

                {/* Complete Button */}
                <div className="space-y-2 pt-2">
                  <Button
                    className="gap-2 px-6 py-2"
                    onClick={handleCompleteOnboarding}
                    disabled={completingOnboarding}
                  >
                    {completingOnboarding ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Completing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        Complete Onboarding & Go to Dashboard
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    This will finalize your onboarding and take you to your
                    dashboard
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Help Section */}

        {/* Remove CSV Confirmation Dialog */}
        <Dialog
          open={showRemoveCsvDialog}
          onOpenChange={setShowRemoveCsvDialog}
        >
          <DialogContent className="w-[400px] h-fit overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <span>Remove CSV Upload</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Are you sure you want to reset your CSV upload status? This
                  will only reset your onboarding progress and will NOT affect
                  any data that has already been uploaded to the database.
                </AlertDescription>
              </Alert>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setShowRemoveCsvDialog(false)}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={confirmRemoveCsv}
                disabled={removingCsv}
              >
                {removingCsv ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-transparent" />
                    <span className="ml-2">Resetting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Reset Status
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
