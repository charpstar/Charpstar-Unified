"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/display";
import { Checkbox } from "@/components/ui/inputs/checkbox";
import { Button } from "@/components/ui/display";
import { useToast } from "@/components/ui/utilities";
import { Loader2, Shield } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  user: "User",
  qa: "QA",
  qamanager: "QA Manager",
  modeler: "Modeler",
  modelermanager: "Modeler Manager",
  client: "Client",
};

const ALL_ROLES = [
  "admin",
  "manager",
  "user",
  "qa",
  "qamanager",
  "modeler",
  "modelermanager",
  "client",
];

interface AllowedRolesManagerProps {
  userId: string;
  currentRole: string;
  onUpdate?: () => void;
}

export function AllowedRolesManager({
  userId,
  currentRole,
  onUpdate,
}: AllowedRolesManagerProps) {
  const [allowedRoles, setAllowedRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchAllowedRoles();
  }, [userId]);

  const fetchAllowedRoles = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/users/${userId}/allowed-roles`);
      if (!response.ok) {
        throw new Error("Failed to fetch allowed roles");
      }
      const data = await response.json();
      setAllowedRoles(data.allowed_roles || [currentRole]);
    } catch (error) {
      console.error("Error fetching allowed roles:", error);
      toast({
        title: "Error",
        description: "Failed to load allowed roles",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleToggle = (role: string) => {
    setAllowedRoles((prev) => {
      if (prev.includes(role)) {
        // Don't allow removing the current role
        if (role === currentRole) {
          toast({
            title: "Warning",
            description: "Cannot remove the user's current role",
            variant: "destructive",
          });
          return prev;
        }
        return prev.filter((r) => r !== role);
      } else {
        return [...prev, role];
      }
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await fetch(`/api/users/${userId}/allowed-roles`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ allowed_roles: allowedRoles }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update allowed roles");
      }

      toast({
        title: "Success",
        description: "Allowed roles updated successfully",
      });

      if (onUpdate) {
        onUpdate();
      }
    } catch (error: any) {
      console.error("Error saving allowed roles:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update allowed roles",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Allowed Roles
          </CardTitle>
          <CardDescription>
            Configure which roles this user can switch between
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Allowed Roles
        </CardTitle>
        <CardDescription>
          Configure which roles this user can switch between. The current role
          cannot be removed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {ALL_ROLES.map((role) => (
            <div
              key={role}
              className="flex items-center space-x-2 rounded-md border border-border p-3 hover:bg-accent/50 transition-colors"
            >
              <Checkbox
                id={`role-${role}`}
                checked={allowedRoles.includes(role)}
                onCheckedChange={() => handleRoleToggle(role)}
                disabled={role === currentRole}
              />
              <Label
                htmlFor={`role-${role}`}
                className="flex-1 cursor-pointer font-normal"
              >
                <div className="flex items-center justify-between">
                  <span>{ROLE_LABELS[role] || role}</span>
                  {role === currentRole && (
                    <span className="text-xs text-muted-foreground">
                      (Current)
                    </span>
                  )}
                </div>
              </Label>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="min-w-[120px]"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>

        {allowedRoles.length > 1 && (
          <div className="rounded-md bg-primary/10 border border-primary/20 p-3 text-sm text-primary">
            This user can switch between {allowedRoles.length} roles. The role
            switcher will appear in the site header.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
