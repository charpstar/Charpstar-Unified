"use client";

import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs/select";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/utilities";
import { Loader2, Shield } from "lucide-react";
import { Badge } from "@/components/ui/feedback";

interface RoleSwitcherProps {
  className?: string;
}

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

export function RoleSwitcher({ className }: RoleSwitcherProps) {
  const [currentRole, setCurrentRole] = useState<string>("");
  const [allowedRoles, setAllowedRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchRoleData = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setLoading(false);
          return;
        }

        // Fetch current role and allowed roles
        const response = await fetch(`/api/users/${user.id}/allowed-roles`);
        if (!response.ok) {
          throw new Error("Failed to fetch role data");
        }

        const data = await response.json();
        setCurrentRole(data.current_role);
        setAllowedRoles(data.allowed_roles || [data.current_role]);
      } catch (error) {
        console.error("Error fetching role data:", error);
        toast({
          title: "Error",
          description: "Failed to load role information",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchRoleData();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      fetchRoleData();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [toast]);

  const handleRoleChange = async (newRole: string) => {
    if (newRole === currentRole || switching) return;

    setSwitching(true);
    try {
      const response = await fetch("/api/users/switch-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to switch role");
      }

      setCurrentRole(newRole);
      toast({
        title: "Role switched",
        description: `You are now viewing as ${ROLE_LABELS[newRole] || newRole}`,
      });

      // Reload the page to update permissions and UI
      window.location.reload();
    } catch (error: any) {
      console.error("Error switching role:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to switch role",
        variant: "destructive",
      });
    } finally {
      setSwitching(false);
    }
  };

  // Don't show switcher if user only has one role
  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (allowedRoles.length <= 1) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Shield className="h-4 w-4 text-muted-foreground" />
      <Select
        value={currentRole}
        onValueChange={handleRoleChange}
        disabled={switching}
      >
        <SelectTrigger className="h-8 w-[140px] text-xs bg-surface-raised border-border-light shadow-depth-sm cursor-pointer">
          <SelectValue>
            {switching ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Switching...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span>{ROLE_LABELS[currentRole] || currentRole}</span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {allowedRoles.map((role) => (
            <SelectItem
              key={role}
              value={role}
              className="cursor-pointer"
              disabled={switching}
            >
              <div className="flex items-center justify-between w-full">
                <span>{ROLE_LABELS[role] || role}</span>
                {role === currentRole && (
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    Active
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
