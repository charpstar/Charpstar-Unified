"use client";

import React from "react";
import { Building, Shield, X } from "lucide-react";
import { Badge } from "@/components/ui/feedback/badge";
import { Button } from "@/components/ui/display/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/display/tooltip";

interface User {
  id: string;
  email: string;
  title?: string;
}

interface TeamInfoTooltipProps {
  modelers: User[];
  qa: User[];
  clientName: string;
  batchNumber: number;
  onRemoveUser: (
    userIds: string[],
    clientName: string,
    batchNumber: number,
    role: "modeler" | "qa"
  ) => void;
  children: React.ReactNode;
}

export function TeamInfoTooltip({
  modelers,
  qa,
  clientName,
  batchNumber,
  onRemoveUser,
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
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      <span className="text-foreground truncate">
                        {user.email.split("@")[0]}
                      </span>
                      {user.title && (
                        <Badge
                          variant="outline"
                          className="text-xs flex-shrink-0 ml-1"
                        >
                          {user.title}
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/20 flex-shrink-0 ml-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveUser(
                          [user.id],
                          clientName,
                          batchNumber,
                          "modeler"
                        );
                      }}
                    >
                      <X className="h-2.5 w-2.5" />
                    </Button>
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
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      <span className="text-foreground truncate">
                        {user.email.split("@")[0]}
                      </span>
                      {user.title && (
                        <Badge
                          variant="outline"
                          className="text-xs flex-shrink-0 ml-1"
                        >
                          {user.title}
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/20 flex-shrink-0 ml-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveUser([user.id], clientName, batchNumber, "qa");
                      }}
                    >
                      <X className="h-2.5 w-2.5" />
                    </Button>
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
