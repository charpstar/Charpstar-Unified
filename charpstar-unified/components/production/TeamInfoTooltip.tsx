"use client";

import React from "react";
import { Building, Shield } from "lucide-react";
import { Badge } from "@/components/ui/feedback/badge";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/display/tooltip";

interface User {
  id: string;
  email: string;
  title?: string;
  modelerCount?: number;
  qaCount?: number;
}

interface TeamInfoTooltipProps {
  modelers: User[];
  qa: User[];
  clientName: string;
  batchNumber: number;
  children: React.ReactNode;
}

export function TeamInfoTooltip({
  modelers,
  qa,
  clientName,
  batchNumber,
  children,
}: TeamInfoTooltipProps) {
  const hasTeamMembers = modelers.length > 0 || qa.length > 0;

  if (!hasTeamMembers) {
    return <>{children}</>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="top"
        align="center"
        className="w-84 p-3 bg-background border shadow-lg max-h-80 overflow-hidden"
        sideOffset={8}
      >
        <div className="space-y-2">
          <div className="text-xs font-semibold text-foreground border-b pb-1">
            Team - {clientName} Batch {batchNumber}
          </div>

          <div className="space-y-2 max-h-68 overflow-y-auto">
            {modelers.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs font-medium text-blue-600">
                  <Building className="h-3 w-3" />
                  Modelers
                </div>
                {modelers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/20 rounded px-2 py-1 text-xs"
                  >
                    <div className="flex items-center justify-between min-w-0 flex-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="text-foreground truncate">
                          {user.email.split("@")[0]}
                        </span>
                        {user.modelerCount && user.modelerCount > 1 && (
                          <Badge
                            variant="secondary"
                            className="text-xs flex-shrink-0 ml-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                          >
                            {user.modelerCount} models
                          </Badge>
                        )}
                        {user.title && (
                          <Badge
                            variant="outline"
                            className="text-xs flex-shrink-0 ml-1"
                          >
                            {user.title}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {qa.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs font-medium text-green-600">
                  <Shield className="h-3 w-3" />
                  QA
                </div>
                {qa.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between bg-green-50 dark:bg-green-950/20 rounded px-2 py-1 text-xs"
                  >
                    <div className="flex items-center justify-between min-w-0 flex-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="text-foreground truncate">
                          {user.email.split("@")[0]}
                        </span>
                        {user.qaCount && user.qaCount > 1 && (
                          <Badge
                            variant="secondary"
                            className="text-xs flex-shrink-0 ml-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          >
                            {user.qaCount} models
                          </Badge>
                        )}
                        {user.title && (
                          <Badge
                            variant="outline"
                            className="text-xs flex-shrink-0 ml-1"
                          >
                            {user.title}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
