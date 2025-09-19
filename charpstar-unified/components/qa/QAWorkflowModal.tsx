"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/containers";
import { 
  Bot, 
  Camera, 
  CheckCircle, 
  AlertTriangle,
  RefreshCw,
  X,
  Download,
  Play,
  Sparkles,
  Target,
  Zap
} from "lucide-react";
import { toast } from "sonner";
import ScreenshotCapture from "./ScreenshotCapture";
import QAResults from "./QAResults";

interface QAWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  glbUrl: string;
  assetId: string;
  referenceImages: string[];
  modelViewerRef: React.RefObject<any>;
  onComplete?: (results: any) => void;
}

type QAState = 'idle' | 'capturing' | 'analyzing' | 'complete' | 'error';

const QAWorkflowModal: React.FC<QAWorkflowModalProps> = ({
  isOpen,
  onClose,
  glbUrl,
  assetId,
  referenceImages,
  modelViewerRef,
  onComplete,
}) => {
  const [qaState, setQaState] = useState<QAState>('idle');
  const [qaJobId, setQaJobId] = useState<string | null>(null);
  const [qaResults, setQaResults] = useState<any>(null);
  const [capturedScreenshots, setCapturedScreenshots] = useState<string[]>([]);
  const [modelStats, setModelStats] = useState<any>(null);

  const startQA = async () => {
    if (!glbUrl) {
      toast.error("No GLB file available for QA analysis");
      return;
    }

    setQaState('capturing');
    setCapturedScreenshots([]);
    setQaJobId(null);
    setQaResults(null);

    try {
      // The ScreenshotCapture component will handle the actual capture
      // and trigger the analysis
    } catch (error) {
      console.error("Error starting QA:", error);
      toast.error("Failed to start QA analysis");
      setQaState('error');
    }
  };

  const handleScreenshotsCaptured = async (screenshots: string[], stats: any, failedResult?: any) => {
    setCapturedScreenshots(screenshots);
    setModelStats(stats);
    
    // If there's a failed result from validation, handle it immediately
    if (failedResult) {
      setQaState('complete');
      setQaResults(failedResult);
      // Don't call onComplete immediately - let user see results first
      return;
    }
    
    setQaState('analyzing');

    try {
      const requestBody = {
        renders: screenshots,
        references: referenceImages,
        modelStats: stats
      };
      
      console.log('Sending QA job request:', requestBody);
      
      const response = await fetch('/api/qa-jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('QA job error response:', errorText);
        throw new Error(`Failed to submit QA job: ${response.statusText}`);
      }

      const result = await response.json();
      setQaJobId(result.jobId);
      
      // Poll for completion
      pollForCompletion(result.jobId);
    } catch (error) {
      console.error("Error starting QA analysis:", error);
      toast.error("Failed to submit QA job");
      setQaState('error');
    }
  };

  const pollForCompletion = async (jobId: string) => {
    const maxAttempts = 60; // 5 minutes max
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/qa-jobs?jobId=${jobId}`);
        const result = await response.json();

        if (result.status === 'complete') {
          setQaState('complete');
          setQaResults(result.qaResults);
          // Don't call onComplete immediately - let user see results first
        } else if (result.status === 'failed') {
          setQaState('error');
          toast.error("QA analysis failed");
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 5000); // Poll every 5 seconds
        } else {
          setQaState('error');
          toast.error("QA analysis timed out");
        }
      } catch (error) {
        console.error("Error polling QA status:", error);
        setQaState('error');
      }
    };

    poll();
  };

  const resetQA = () => {
    setQaState('idle');
    setQaJobId(null);
    setCapturedScreenshots([]);
    setModelStats(null);
  };

  const getStateIcon = () => {
    switch (qaState) {
      case 'idle': return <Play className="h-5 w-5" />;
      case 'capturing': return <Camera className="h-5 w-5 animate-pulse" />;
      case 'analyzing': return <Bot className="h-5 w-5 animate-spin" />;
      case 'complete': return <CheckCircle className="h-5 w-5 text-gray-600" />;
      case 'error': return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default: return <Play className="h-5 w-5" />;
    }
  };

  const getStateColor = () => {
    switch (qaState) {
      case 'idle': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'capturing': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'analyzing': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'complete': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'error': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStateText = () => {
    switch (qaState) {
      case 'idle': return 'Ready to Start';
      case 'capturing': return 'Capturing Screenshots';
      case 'analyzing': return 'AI Analysis in Progress';
      case 'complete': return 'Analysis Complete';
      case 'error': return 'Analysis Failed';
      default: return 'Unknown State';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full max-h-[85vh] overflow-hidden">
        <DialogHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Bot className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">Automated QA Analysis</DialogTitle>
                <p className="text-sm text-muted-foreground">AI-powered quality assurance for your 3D model</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={`${getStateColor()} border`}>
                {getStateIcon()}
                <span className="ml-2">{getStateText()}</span>
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {qaState === 'idle' && (
            <div className="space-y-6">
              {/* Hero Section */}
              <div className="text-center py-8 bg-gray-50 rounded-xl">
                <div className="p-3 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-gray-600" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Ready for QA Analysis</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Our AI will capture screenshots from multiple angles and compare them against your reference images to ensure quality.
                </p>
              </div>


              {/* Action Button */}
              <div className="text-center space-y-4">
                <Button 
                  onClick={startQA}
                  className="h-12 px-8 text-lg"
                  size="lg"
                >
                  <Play className="h-5 w-5 mr-2" />
                  Start QA Analysis
                </Button>
                
                <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <span>Reference Images: {referenceImages.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${glbUrl ? 'bg-gray-400' : 'bg-red-500'}`}></div>
                    <span>Model: {glbUrl ? 'Loaded' : 'Not Available'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {qaState === 'capturing' && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <h3 className="text-lg font-semibold mb-2">Capturing Screenshots</h3>
                <p className="text-muted-foreground">Positioning camera and capturing from multiple angles...</p>
              </div>
              <ScreenshotCapture
                glbUrl={glbUrl}
                assetId={assetId}
                modelViewerRef={modelViewerRef}
                onScreenshotsCaptured={handleScreenshotsCaptured}
              />
            </div>
          )}

          {(qaState === 'analyzing' || qaState === 'complete' || qaState === 'error') && qaJobId && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <h3 className="text-lg font-semibold mb-2">
                  {qaState === 'analyzing' ? 'AI Analysis in Progress' : 
                   qaState === 'complete' ? 'Analysis Complete' : 'Analysis Failed'}
                </h3>
                {qaState === 'analyzing' && (
                  <p className="text-muted-foreground">Comparing screenshots against reference images...</p>
                )}
              </div>
              <QAResults jobId={qaJobId} />
              
              {/* Action buttons for completed analysis */}
              {qaState === 'complete' && qaResults && (
                <div className="flex gap-3 justify-center pt-4 border-t">
                  {qaResults.status === 'Approved' ? (
                    <Button 
                      onClick={() => {
                        if (onComplete) {
                          onComplete(qaResults);
                        }
                        onClose();
                      }}
                      className="flex items-center gap-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Close & Deliver Model
                    </Button>
                  ) : (
                    <Button 
                      onClick={onClose}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <X className="h-4 w-4" />
                      Close
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {qaState === 'error' && !qaJobId && (
            <div className="text-center py-12">
              <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Analysis Failed</h3>
              <p className="text-muted-foreground mb-6">
                Something went wrong during the QA analysis. Please try again.
              </p>
              <Button onClick={resetQA} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Asset ID: {assetId} | Reference Images: {referenceImages.length}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QAWorkflowModal;
