"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/containers/card";
import { Badge } from "@/components/ui/feedback/badge";
import { Button } from "@/components/ui/display/button";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  RefreshCw,
  AlertTriangle
} from "lucide-react";

interface QAResultsProps {
  jobId: string;
  onRetry?: () => void;
  onClose?: () => void;
}

interface QAResults {
  differences: Array<{
    renderIndex: number;
    referenceIndex: number;
    issues: string[];
    bbox: number[];
    severity: string;
  }>;
  summary: string[];
  status: string;
  similarityScores?: {
    silhouette?: number;
    proportion?: number;
    colorMaterial?: number;
    overall?: number;
  };
  warnings?: string[];
}

interface JobStatus {
  jobId: string;
  status: string;
  error?: string;
  startTime?: string;
  endTime?: string;
  qaResults?: QAResults;
  queueInfo?: {
    position?: number;
    totalInQueue: number;
    activeJobs: number;
    maxConcurrent: number;
    estimatedWaitTime: number;
  };
}

const QAResults: React.FC<QAResultsProps> = ({ jobId, onRetry, onClose }) => {
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);

  const pollJobStatus = async () => {
    try {
      const response = await fetch(`/api/qa-jobs?jobId=${jobId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch job status');
      }
      
      const data = await response.json();
      setJobStatus(data);
      
      // Stop polling if job is complete or failed
      if (data.status === 'complete' || data.status === 'failed') {
        setIsPolling(false);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error polling job status:', error);
      setIsPolling(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (jobId) {
      pollJobStatus();
      
      // Start polling if job is not complete
      const interval = setInterval(() => {
        if (isPolling) {
          pollJobStatus();
        }
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [jobId, isPolling]);

  useEffect(() => {
    if (jobStatus && (jobStatus.status === 'queued' || jobStatus.status === 'processing')) {
      setIsPolling(true);
    }
  }, [jobStatus]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return jobStatus?.qaResults?.status === 'Approved' ? 
          <CheckCircle className="h-5 w-5 text-green-500" /> : 
          <XCircle className="h-5 w-5 text-red-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'processing':
        return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'queued':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete':
        return jobStatus?.qaResults?.status === 'Approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'queued':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };


  const formatTime = (timeString?: string) => {
    if (!timeString) return 'N/A';
    return new Date(timeString).toLocaleString();
  };

  if (isLoading) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="flex items-center justify-center py-8">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span>Loading QA results...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!jobStatus) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <XCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p>Failed to load QA results</p>
            {onRetry && (
              <Button variant="outline" onClick={onRetry} className="mt-2">
                Retry
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {getStatusIcon(jobStatus.status)}
            QA Analysis Results
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(jobStatus.status)}>
              {jobStatus.status.toUpperCase()}
            </Badge>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                <XCircle className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Job Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Job ID</p>
            <p className="font-mono text-xs">{jobStatus.jobId}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Started</p>
            <p>{formatTime(jobStatus.startTime)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Completed</p>
            <p>{formatTime(jobStatus.endTime)}</p>
          </div>
        </div>

        {/* Queue Info */}
        {jobStatus.queueInfo && (jobStatus.status === 'queued' || jobStatus.status === 'processing') && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-blue-900">Queue Status</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-blue-700">Position</p>
                <p className="font-medium">{jobStatus.queueInfo.position || 'Processing'}</p>
              </div>
              <div>
                <p className="text-blue-700">Active Jobs</p>
                <p className="font-medium">{jobStatus.queueInfo.activeJobs}/{jobStatus.queueInfo.maxConcurrent}</p>
              </div>
              <div>
                <p className="text-blue-700">Queue Length</p>
                <p className="font-medium">{jobStatus.queueInfo.totalInQueue}</p>
              </div>
              <div>
                <p className="text-blue-700">Est. Wait</p>
                <p className="font-medium">{jobStatus.queueInfo.estimatedWaitTime}m</p>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {jobStatus.status === 'failed' && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <span className="font-medium text-red-900 dark:text-red-100">Analysis Failed</span>
            </div>
            <p className="text-red-700 dark:text-red-300 text-sm">{jobStatus.error}</p>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry Analysis
              </Button>
            )}
          </div>
        )}

        {/* QA Results */}
        {jobStatus.qaResults && (
          <div className="space-y-6">
            {/* Overall Status */}
            <div className="text-center p-6 bg-muted/50 dark:bg-muted/20 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                {jobStatus.qaResults.status === 'Approved' ? (
                  <CheckCircle className="h-8 w-8 text-green-500" />
                ) : (
                  <XCircle className="h-8 w-8 text-red-500" />
                )}
                <h3 className="text-xl font-semibold text-foreground">
                  {jobStatus.qaResults.status}
                </h3>
              </div>
              {jobStatus.qaResults.status === 'Approved' ? (
                <div className="text-left">
                    <p className="text-muted-foreground mb-2 text-center">This is a good submission, but you can improve the following:</p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1">
                        {Array.isArray(jobStatus.qaResults.summary) && jobStatus.qaResults.summary.map((point, index) => (
                            <li key={index}>{point}</li>
                        ))}
                    </ul>
                </div>
              ) : (
                <ul className="list-disc list-inside text-left text-muted-foreground space-y-1">
                    {Array.isArray(jobStatus.qaResults.summary) && jobStatus.qaResults.summary.map((point, index) => (
                        <li key={index}>{point}</li>
                    ))}
                </ul>
              )}
            </div>

            {/* Technical Warnings */}
            {jobStatus.qaResults.warnings && jobStatus.qaResults.warnings.length > 0 && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800/50 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  <h4 className="font-medium text-yellow-900 dark:text-yellow-100">Technical Warnings</h4>
                </div>
                <ul className="space-y-1">
                  {jobStatus.qaResults.warnings.map((warning, index) => (
                    <li key={index} className="text-yellow-800 dark:text-yellow-200 text-sm flex items-start gap-2">
                      <span className="text-yellow-600 dark:text-yellow-400 mt-0.5">•</span>
                      {warning}
                    </li>
                  ))}
                </ul>
                <p className="text-yellow-700 dark:text-yellow-300 text-xs mt-2">
                  These are non-blocking warnings. The model can still be approved.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t">
          {onRetry && jobStatus.status === 'failed' && (
            <Button onClick={onRetry} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Analysis
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default QAResults;
