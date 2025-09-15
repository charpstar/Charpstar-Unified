"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/display";

import { toast } from "sonner";
import { Users, Building, Shield, Loader2 } from "lucide-react";

interface Asset {
  id: string;
  product_name: string;
  article_id: string;
  client: string;
  batch: number;
  priority: number;
  status: string;
}

interface User {
  id: string;
  email: string;
  title?: string;
  role?: string;
  phone_number?: string;
  discord_name?: string;
  software_experience?: string[] | null;
  model_types?: string[] | null;
  daily_hours?: number | null;
  exclusive_work?: boolean | null;
  country?: string | null;
  portfolio_links?: string[] | null;
}

interface AssetAssignmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAssets: Asset[];
  onAssignmentComplete: () => void;
}

export function AssetAssignmentDialog({
  isOpen,
  onClose,
  selectedAssets,
  onAssignmentComplete,
}: AssetAssignmentDialogProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [role, setRole] = useState<"modeler" | "qa">("modeler");
  const [loading, setLoading] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [existingAssignments, setExistingAssignments] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      fetchExistingAssignments();
    }
  }, [isOpen, selectedAssets, role]);

  const fetchUsers = async () => {
    try {
      setLoadingStats(true);
      const { data, error } = await supabase
        .from("profiles")
        .select(
          `
          id, 
          email, 
          title, 
          role,
          phone_number,
          discord_name,
          software_experience,
          model_types,
          daily_hours,
          exclusive_work,
          country,
          portfolio_links
        `
        )
        .in("role", ["modeler", "qa"])
        .order("email");

      if (error) {
        console.error("Error fetching users:", error);
        return;
      }

      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchExistingAssignments = async () => {
    if (selectedAssets.length === 0) return;

    try {
      const { data, error } = await supabase
        .from("asset_assignments")
        .select(
          `
          asset_id,
          user_id,
          role,
          profiles!inner(email, title)
        `
        )
        .in(
          "asset_id",
          selectedAssets.map((asset) => asset.id)
        );

      if (error) {
        console.error("Error fetching existing assignments:", error);
        return;
      }

      setExistingAssignments(data || []);
    } catch (error) {
      console.error("Error fetching existing assignments:", error);
    }
  };

  const handleUserSelect = (userId: string) => {
    setSelectedUsers([userId]); // Only one user can be selected
  };

  const handleAssign = async () => {
    if (selectedUsers.length === 0) {
      toast.error("Please select at least one user");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/assets/assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assetIds: selectedAssets.map((asset) => asset.id),
          userIds: selectedUsers,
          role: role,
          deadline: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          ).toISOString(), // Default 7 days from now
          bonus: 0, // Default bonus
          allocationName: `Allocation ${new Date().toISOString().split("T")[0]} - ${selectedAssets.length} assets`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to assign assets");
      }

      const result = await response.json();
      toast.success(result.message);

      // Reset form
      setSelectedUsers([]);
      onAssignmentComplete();
      onClose();
    } catch (error) {
      console.error("Error assigning assets:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to assign assets"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAssignments = async () => {
    if (selectedUsers.length === 0) {
      toast.error("Please select at least one user");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/assets/assign", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assetIds: selectedAssets.map((asset) => asset.id),
          userIds: selectedUsers,
          role: role,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to remove assignments");
      }

      const result = await response.json();
      toast.success(result.message);

      // Reset form
      setSelectedUsers([]);
      onAssignmentComplete();
      onClose();
    } catch (error) {
      console.error("Error removing assignments:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to remove assignments"
      );
    } finally {
      setLoading(false);
    }
  };

  const getExistingAssignmentsForAsset = (assetId: string) => {
    return existingAssignments.filter(
      (assignment) => assignment.asset_id === assetId
    );
  };

  const getAssignmentPreview = () => {
    if (role !== "modeler" || selectedUsers.length === 0) return [];

    const userId = selectedUsers[0]; // Only one user selected
    const user = users.find((u) => u.id === userId);

    const preview = [];
    for (let i = 0; i < selectedAssets.length; i++) {
      preview.push({
        asset: selectedAssets[i],
        user: user,
        userId: userId,
      });
    }
    return preview;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl h-fit overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Assign Assets to Users
          </DialogTitle>
          <DialogDescription>
            Select users to assign {selectedAssets.length} selected asset(s) to.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Role Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Role</label>
            <Select
              value={role}
              onValueChange={(value: "modeler" | "qa") => setRole(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="modeler">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    Modeler
                  </div>
                </SelectItem>
                <SelectItem value="qa">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    QA
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Warning for modeler assignments */}
            {role === "modeler" && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>Single Assignment:</strong> Select one modeler to
                  assign to all selected assets. Existing modeler assignments
                  will be replaced.
                </p>
              </div>
            )}
          </div>

          {/* Selected Assets */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Selected Assets ({selectedAssets.length})
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-32 overflow-y-auto">
              {selectedAssets.map((asset) => (
                <div key={asset.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {asset.product_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {asset.client} - Batch {asset.batch} -{" "}
                        {asset.article_id}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Priority {asset.priority}
                    </Badge>
                  </div>

                  {/* Existing assignments for this asset */}
                  {getExistingAssignmentsForAsset(asset.id).length > 0 && (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-xs text-muted-foreground mb-1">
                        Currently assigned:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {getExistingAssignmentsForAsset(asset.id).map(
                          (assignment, index) => (
                            <Badge
                              key={index}
                              variant="secondary"
                              className="text-xs"
                            >
                              {assignment.profiles.email}
                            </Badge>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* User Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Select Users ({selectedUsers.length} selected)
            </label>
            <div className="border rounded-lg overflow-hidden">
              {loadingStats ? (
                <div className="p-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Loading modeler profiles...
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Select</TableHead>
                      <TableHead>User</TableHead>
                      {role === "modeler" && (
                        <>
                          <TableHead className="text-center">
                            Software
                          </TableHead>
                          <TableHead className="text-center">
                            Model Types
                          </TableHead>
                          <TableHead className="text-center">
                            Daily Hours
                          </TableHead>
                          <TableHead className="text-center">Country</TableHead>
                          <TableHead className="text-center">Contact</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users
                      .filter((user) => user.role === role)
                      .map((user) => (
                        <TableRow
                          key={user.id}
                          className={`cursor-pointer transition-colors ${
                            selectedUsers.includes(user.id)
                              ? "bg-primary/5 border-primary"
                              : "hover:bg-muted/50"
                          }`}
                          onClick={() => handleUserSelect(user.id)}
                        >
                          <TableCell>
                            <div
                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                selectedUsers.includes(user.id)
                                  ? "border-primary bg-primary"
                                  : "border-muted-foreground"
                              }`}
                            >
                              {selectedUsers.includes(user.id) && (
                                <div className="w-2 h-2 bg-white rounded-full" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">
                                {user.email}
                              </p>
                              {user.title && (
                                <p className="text-xs text-muted-foreground">
                                  {user.title}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          {role === "modeler" && (
                            <>
                              <TableCell className="text-center">
                                <div className="flex flex-wrap gap-1 justify-center">
                                  {user.software_experience
                                    ?.slice(0, 2)
                                    .map((software, index) => (
                                      <Badge
                                        key={index}
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        {software}
                                      </Badge>
                                    ))}
                                  {user.software_experience &&
                                    user.software_experience.length > 2 && (
                                      <Badge
                                        variant="secondary"
                                        className="text-xs"
                                      >
                                        +{user.software_experience.length - 2}
                                      </Badge>
                                    )}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex flex-wrap gap-1 justify-center">
                                  {user.model_types
                                    ?.slice(0, 2)
                                    .map((type, index) => (
                                      <Badge
                                        key={index}
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        {type}
                                      </Badge>
                                    ))}
                                  {user.model_types &&
                                    user.model_types.length > 2 && (
                                      <Badge
                                        variant="secondary"
                                        className="text-xs"
                                      >
                                        +{user.model_types.length - 2}
                                      </Badge>
                                    )}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className="text-xs">
                                  {user.daily_hours || 0}h/day
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="text-xs text-muted-foreground">
                                  {user.country || "N/A"}
                                </span>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex flex-col gap-1">
                                  {user.phone_number && (
                                    <span className="text-xs text-muted-foreground">
                                      📞 {user.phone_number}
                                    </span>
                                  )}
                                  {user.discord_name && (
                                    <span className="text-xs text-muted-foreground">
                                      💬 {user.discord_name}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>

          {/* Assignment Preview for Modelers */}
          {role === "modeler" && selectedUsers.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  Assignment Preview
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  {showPreview ? "Hide" : "Show"} Preview
                </Button>
              </div>

              {showPreview && (
                <div className="p-3 bg-gray-50 border rounded-md max-h-48 overflow-y-auto">
                  <p className="text-xs text-muted-foreground mb-2">
                    All selected assets will be assigned to:
                  </p>
                  <div className="space-y-1">
                    {getAssignmentPreview().map((preview, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="truncate flex-1">
                          {preview.asset.product_name}
                        </span>
                        <span className="text-muted-foreground mx-2">→</span>
                        <span className="font-medium">
                          {preview.user?.email.split("@")[0]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveAssignments}
              disabled={loading || selectedUsers.length === 0}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Remove Assignments
            </Button>
            <Button
              onClick={handleAssign}
              disabled={loading || selectedUsers.length === 0}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Assign Assets
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
