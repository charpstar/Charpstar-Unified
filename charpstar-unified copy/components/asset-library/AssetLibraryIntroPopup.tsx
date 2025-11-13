"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/display";
import { Card, CardContent } from "@/components/ui/containers";
import { Badge } from "@/components/ui/feedback";
import {
  X,
  CheckCircle2,
  XCircle,
  Package,
  RotateCcw,
  Calendar,
  Info,
  ArrowRight,
} from "lucide-react";

interface AssetLibraryIntroPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AssetLibraryIntroPopup({
  isOpen,
  onClose,
}: AssetLibraryIntroPopupProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: "Welcome to Your Asset Library",
      content: (
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">
                Your Complete Asset Collection
              </h3>
              <p className="text-sm text-muted-foreground">
                View all your contracted assets in one place
              </p>
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm">
              Here you can see all your assets, including both active and
              deactivated ones. This gives you a complete view of your contract
              value.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: "Asset Deactivation System",
      content: (
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <RotateCcw className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Annual Change Allowance</h3>
              <p className="text-sm text-muted-foreground">
                Deactivate and reactivate assets within your limits
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  Deactivating Assets
                </p>
                <p className="text-xs text-green-700 dark:text-green-400">
                  Click the green checkmark to deactivate an asset. This counts
                  as one annual change.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <XCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                  Reactivating Assets
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  Click the red X to reactivate a deactivated asset. This
                  restores one change to your allowance.
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Change Limits & Tracking",
      content: (
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Calendar className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Annual Change Tracking</h3>
              <p className="text-sm text-muted-foreground">
                Your changes reset each calendar year
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">How It Works</span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>
                  • Your change limit is calculated as a percentage of your
                  contracted assets
                </li>
                <li>• Each deactivation uses one of your annual changes</li>
                <li>
                  • Reactivating an asset restores one change to your allowance
                </li>
                <li>• Changes reset to zero each January 1st</li>
              </ul>
            </div>

            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <Badge
                variant="secondary"
                className="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
              >
                Tooltip Info
              </Badge>
              <span className="text-xs text-amber-700 dark:text-amber-400">
                Hover over the status buttons to see your remaining changes
              </span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Visual Indicators",
      content: (
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
              <Package className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">
                Understanding Your Assets
              </h3>
              <p className="text-sm text-muted-foreground">
                Visual cues help you identify asset status
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <div>
                <p className="text-sm font-medium">Active Assets</p>
                <p className="text-xs text-muted-foreground">
                  Normal appearance with green status button
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/20 rounded-lg border border-gray-200 dark:border-gray-800">
              <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
              <div>
                <p className="text-sm font-medium">Deactivated Assets</p>
                <p className="text-xs text-muted-foreground">
                  Dimmed appearance with &quot;Deactivated&quot; badge
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div>
                <p className="text-sm font-medium">No Changes Remaining</p>
                <p className="text-xs text-muted-foreground">
                  Status button is disabled when limit is reached
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleSkip}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="w-full max-w-2xl max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <Card className="border-2 shadow-2xl bg-background">
            <CardContent className="p-0 bg-background">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">
                      Asset Library Guide
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Step {currentStep + 1} of {steps.length}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSkip}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Progress Bar */}
              <div className="px-6 py-2">
                <div className="w-full bg-muted rounded-full h-2">
                  <motion.div
                    className="bg-primary h-2 rounded-full"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${((currentStep + 1) / steps.length) * 100}%`,
                    }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              {/* Content */}
              <div className="p-6 max-h-[60vh] overflow-y-auto">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <h3 className="text-2xl font-bold mb-4">
                    {steps[currentStep].title}
                  </h3>
                  {steps[currentStep].content}
                </motion.div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between p-6 border-t border-border bg-muted/30">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentStep === 0}
                  className="flex items-center gap-2"
                >
                  Previous
                </Button>

                <div className="flex items-center gap-2">
                  <Button variant="ghost" onClick={handleSkip}>
                    Skip Tour
                  </Button>
                  <Button
                    onClick={handleNext}
                    className="flex items-center gap-2"
                  >
                    {currentStep === steps.length - 1 ? "Get Started" : "Next"}
                    {currentStep === steps.length - 1 ? null : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
