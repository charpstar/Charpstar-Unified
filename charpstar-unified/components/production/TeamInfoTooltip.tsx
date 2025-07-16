"use client";

import React from "react";
import { Building, Shield, Users, X } from "lucide-react";
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
        className="w-80 p-4 bg-background border shadow-lg"
        sideOffset={5}
      >
        <div className="space-y-3">
          <div className="text-sm font-semibold text-foreground">
            Assigned Team - {clientName} Batch {batchNumber}
          </div>

          {modelers.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Building className="h-3 w-3 text-blue-500" />
                Modelers ({modelers.length})
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {modelers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between bg-muted/50 rounded px-2 py-1 text-xs"
                  >
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      <Users className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground truncate">
                        {user.email.split("@")[0]}
                      </span>
                      {user.title && (
                        <Badge
                          variant="outline"
                          className="text-xs flex-shrink-0"
                        >
                          {user.title}
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 hover:bg-destructive hover:text-destructive-foreground flex-shrink-0 ml-1"
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
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {qa.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Shield className="h-3 w-3 text-green-500" />
                QA ({qa.length})
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {qa.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between bg-muted/50 rounded px-2 py-1 text-xs"
                  >
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      <Users className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground truncate">
                        {user.email.split("@")[0]}
                      </span>
                      {user.title && (
                        <Badge
                          variant="outline"
                          className="text-xs flex-shrink-0"
                        >
                          {user.title}
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 hover:bg-destructive hover:text-destructive-foreground flex-shrink-0 ml-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveUser([user.id], clientName, batchNumber, "qa");
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
