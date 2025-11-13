"use client";

import { Card } from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { AlertCircle } from "lucide-react";

export default function SharedReviewError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full p-6">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
          <h2 className="text-xl font-semibold text-foreground">
            Review Link Error
          </h2>
          <p className="text-muted-foreground">
            {error.message ||
              "This review link is invalid, expired, or has been cancelled."}
          </p>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Possible reasons:</p>
            <ul className="list-disc list-inside space-y-1 text-left">
              <li>The link has expired</li>
              <li>The invitation was cancelled</li>
              <li>The link is invalid or malformed</li>
            </ul>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 pt-4">
            <Button variant="outline" onClick={reset} className="flex-1">
              Try Again
            </Button>
            <Button variant="outline" asChild className="flex-1">
              <a
                href={`mailto:support@charpstar.co?subject=Review Link Issue&body=Hello, I'm having trouble accessing a review link. Please help.`}
              >
                Contact Support
              </a>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
