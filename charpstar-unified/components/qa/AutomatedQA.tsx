"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/containers/card";
import { Button } from "@/components/ui/display/button";
import { Badge } from "@/components/ui/feedback/badge";
import { 
  Bot, 
  Camera, 
  CheckCircle, 
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import ScreenshotCapture from "./ScreenshotCapture";
import QAResults from "./QAResults";

interface AutomatedQAProps {
  glbUrl: string;
  assetId: string;
  referenceImages: string[];
  onComplete?: (results: any) => void;
  onCancel?: () => void;
}

type QAState = 'idle' | 'capturing' | 'analyzing' | 'complete' | 'error';

const AutomatedQA: React.FC<AutomatedQAProps> = ({
  glbUrl,
  assetId,
  referenceImages,
  onCancel,
}) => {
  const [qaState, setQaState] = useState<QAState>('idle');
  const [qaJobId, setQaJobId] = useState<string | null>(null);

  // Debug logging
  console.log("AutomatedQA component rendered with:", {
    glbUrl,
    assetId,
    referenceImagesCount: referenceImages.length,
    qaState
  });

  const startQA = () => {
    setQaState('capturing');
  };

  const handleScreenshotsCaptured = async (screenshots: string[], stats: any) => {
    setQaState('analyzing');

    try {
      // Submit QA job with captured screenshots
      console.log('Submitting QA job with data:', {
        renders: screenshots,
        references: referenceImages,
        modelStats: stats,
      });

      const response = await fetch('/api/qa-jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          renders: screenshots,
          references: referenceImages,
          modelStats: stats,
        }),
      });

      console.log('QA job response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('QA job failed with response:', errorText);
        throw new Error(`Failed to submit QA job: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('QA job data:', data);
      setQaJobId(data.jobId);
      
      toast.success('QA analysis started!');
      
    } catch (error) {
      console.error('Error starting QA analysis:', error);
      toast.error('Failed to start QA analysis');
      setQaState('error');
    }
  };


  const handleRetry = () => {
    setQaState('idle');
    setQaJobId(null);
  };

  const getStateIcon = () => {
    switch (qaState) {
      case 'capturing':
        return <Camera className="h-5 w-5 text-blue-500" />;
      case 'analyzing':
        return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'complete':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default:
        return <Bot className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStateColor = () => {
    switch (qaState) {
      case 'capturing':
        return 'bg-blue-100 text-blue-800';
      case 'analyzing':
        return 'bg-blue-100 text-blue-800';
      case 'complete':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStateText = () => {
    switch (qaState) {
      case 'capturing':
        return 'Capturing Screenshots';
      case 'analyzing':
        return 'AI Analysis in Progress';
      case 'complete':
        return 'QA Complete';
      case 'error':
        return 'QA Failed';
      default:
        return 'Ready to Start';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {getStateIcon()}
              Automated QA System
            </CardTitle>
            <Badge className={getStateColor()}>
              {getStateText()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Our AI-powered QA system will automatically capture screenshots of your 3D model 
              and compare them against reference images to ensure visual accuracy and quality.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-blue-500" />
                <span>5 Screenshot Angles</span>
              </div>
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-purple-500" />
                <span>AI Visual Analysis</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Quality Scoring</span>
              </div>
            </div>

            {qaState === 'idle' && (
              <div className="flex gap-3">
                <Button onClick={startQA} className="flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  Start Automated QA
                </Button>
                {onCancel && (
                  <Button variant="outline" onClick={onCancel}>
                    Cancel
                  </Button>
                )}
              </div>
            )}

            {qaState === 'error' && (
              <div className="flex gap-3">
                <Button onClick={handleRetry} variant="outline" className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Retry QA
                </Button>
                {onCancel && (
                  <Button variant="outline" onClick={onCancel}>
                    Cancel
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Screenshot Capture */}
      {qaState === 'capturing' && (
        <ScreenshotCapture
          glbUrl={glbUrl}
          assetId={assetId}
          onScreenshotsCaptured={handleScreenshotsCaptured}
          onCancel={onCancel}
        />
      )}

      {/* QA Analysis */}
      {qaState === 'analyzing' && qaJobId && (
        <QAResults
          jobId={qaJobId}
          onRetry={handleRetry}
          onClose={onCancel}
        />
      )}

      {/* Complete State */}
      {qaState === 'complete' && qaJobId && (
        <div className="space-y-4">
          <QAResults
            jobId={qaJobId}
            onRetry={handleRetry}
            onClose={onCancel}
          />
          <div className="flex gap-3">
            <Button onClick={handleRetry} variant="outline" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Run QA Again
            </Button>
            {onCancel && (
              <Button onClick={onCancel}>
                Continue
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomatedQA;
