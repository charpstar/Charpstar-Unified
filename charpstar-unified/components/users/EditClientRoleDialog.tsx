"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs";
import { Label } from "@/components/ui/display";
import { Shield, User, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/utilities";

interface EditClientRoleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userEmail: string;
  onSuccess?: () => void;
}

export function EditClientRoleDialog({
  isOpen,
  onClose,
  userId,
  userEmail,
  onSuccess,
}: EditClientRoleDialogProps) {
  const [clientRole, setClientRole] = useState<
    "client_admin" | "product_manager" | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && userId) {
      fetchClientRole();
    }
  }, [isOpen, userId]);

  const fetchClientRole = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/users/${userId}/client-role`);
      if (!response.ok) {
        throw new Error("Failed to fetch client role");
      }
      const data = await response.json();
      // Default to client_admin if not set (backward compatibility)
      setClientRole(
        data.client_role ||
          ("client_admin" as "client_admin" | "product_manager")
      );
    } catch (error) {
      console.error("Error fetching client role:", error);
      toast({
        title: "Error",
        description: "Failed to load client role",
        variant: "destructive",
      });
      // Default to client_admin on error
      setClientRole("client_admin");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!clientRole) {
      toast({
        title: "Error",
        description: "Please select a client role",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/users/${userId}/client-role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clientRole }),
      });

      if (!response.ok) {
        throw new Error("Failed to update client role");
      }

      toast({
        title: "Success",
        description: "Client role updated successfully",
      });

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Error updating client role:", error);
      toast({
        title: "Error",
        description: "Failed to update client role",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Client Role - {userEmail}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <Label className="text-sm font-medium">Client Role *</Label>
                <Select
                  value={clientRole || "client_admin"}
                  onValueChange={(value: "client_admin" | "product_manager") =>
                    setClientRole(value)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select client role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client_admin">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Client Admin
                      </div>
                    </SelectItem>
                    <SelectItem value="product_manager">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Product Manager
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {clientRole === "client_admin"
                    ? "Client Admins can allocate products to colleagues and view all company products"
                    : "Product Managers can only view products allocated to them"}
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={onClose} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Client Role"
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
