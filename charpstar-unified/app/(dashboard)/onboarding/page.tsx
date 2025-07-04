"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@/contexts/useUser";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/display";
import { Input } from "@/components/ui/inputs";
import { Badge } from "@/components/ui/feedback";
import { Card } from "@/components/ui/containers";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/display";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/containers";
import {
  Mail,
  X,
  CheckCircle,
  Clock,
  UserPlus,
  AlertCircle,
  Copy,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { useToast } from "@/components/ui/utilities";

interface Invitation {
  id: string;
  email: string;
  client_name: string;
  role: string;
  status: "pending" | "accepted" | "expired" | "cancelled";
  invited_by: string;
  invited_at: string;
  accepted_at?: string;
  expires_at: string;
  invitation_link: string;
}

export default function OnboardingPage() {
  const user = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [newInviteDialog, setNewInviteDialog] = useState(false);
  const [newInviteData, setNewInviteData] = useState({
    email: "",
    client_name: "",
    role: "client",
    onboarding: true, // Hidden field, always true for new invitations
  });
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    invitation: Invitation | null;
  }>({ open: false, invitation: null });
  const [clearHistoryDialog, setClearHistoryDialog] = useState(false);

  // Check if user is admin
  useEffect(() => {
    if (user && user.metadata?.role !== "admin") {
      router.push("/dashboard");
      toast({
        title: "Access Denied",
        description: "Only administrators can access this page.",
        variant: "destructive",
      });
    }
  }, [user, router, toast]);

  const fetchInvitations = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/invitations");
      if (response.ok) {
        const data = await response.json();
        setInvitations(data.invitations || []);
      }
    } catch (error) {
      console.error("Error fetching invitations:", error);
      toast({
        title: "Error",
        description: "Failed to load invitations.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Fetch invitations
  useEffect(() => {
    if (user?.metadata?.role === "admin") {
      fetchInvitations();
    }
  }, [user, fetchInvitations]);

  const sendInvitation = async () => {
    if (!newInviteData.email || !newInviteData.client_name) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setSendingInvite(true);
    try {
      const response = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newInviteData),
      });

      if (response.ok) {
        toast({
          title: "Invitation Sent",
          description: `Invitation sent to ${newInviteData.email}`,
        });
        setNewInviteDialog(false);
        setNewInviteData({
          email: "",
          client_name: "",
          role: "client",
          onboarding: true,
        });
        fetchInvitations(); // Refresh the list
      } else {
        const error = await response.json();
        throw new Error(error.message || "Failed to send invitation");
      }
    } catch (error) {
      console.error("Error sending invitation:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to send invitation.",
        variant: "destructive",
      });
    } finally {
      setSendingInvite(false);
    }
  };

  const deleteInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(
        `/api/admin/invitations?id=${invitationId}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        toast({
          title: "Invitation Deleted",
          description: "The invitation has been permanently deleted.",
        });
        fetchInvitations(); // Refresh the list
        setDeleteDialog({ open: false, invitation: null });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete invitation");
      }
    } catch (error) {
      console.error("Error deleting invitation:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to delete invitation.",
        variant: "destructive",
      });
    }
  };

  const cancelInvitation = async (invitationId: string) => {
    // For now, we'll use the same delete functionality
    // In the future, you might want to add a "cancelled" status instead of deletion
    try {
      const response = await fetch(
        `/api/admin/invitations?id=${invitationId}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        toast({
          title: "Invitation Cancelled",
          description: "The invitation has been cancelled.",
        });
        fetchInvitations(); // Refresh the list
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to cancel invitation");
      }
    } catch (error) {
      console.error("Error cancelling invitation:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to cancel invitation.",
        variant: "destructive",
      });
    }
  };

  const clearHistory = async () => {
    try {
      // Get all non-accepted invitations
      const nonAcceptedInvitations = invitations.filter(
        (inv) => inv.status !== "accepted"
      );

      if (nonAcceptedInvitations.length === 0) {
        toast({
          title: "No Invitations to Clear",
          description:
            "All invitations are accepted or there are no invitations to clear.",
        });
        setClearHistoryDialog(false);
        return;
      }

      // Delete each non-accepted invitation
      const deletePromises = nonAcceptedInvitations.map((inv) =>
        fetch(`/api/admin/invitations?id=${inv.id}`, { method: "DELETE" })
      );

      const results = await Promise.allSettled(deletePromises);
      const successful = results.filter(
        (result) => result.status === "fulfilled"
      ).length;
      const failed = results.length - successful;

      if (successful > 0) {
        toast({
          title: "History Cleared",
          description: `Successfully deleted ${successful} invitation(s).${failed > 0 ? ` ${failed} failed.` : ""}`,
        });
        fetchInvitations(); // Refresh the list
      } else {
        throw new Error("Failed to delete any invitations");
      }
    } catch (error) {
      console.error("Error clearing history:", error);
      toast({
        title: "Error",
        description: "Failed to clear invitation history.",
        variant: "destructive",
      });
    } finally {
      setClearHistoryDialog(false);
    }
  };

  const copyInvitationLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast({
        title: "Link Copied",
        description: "Invitation link copied to clipboard.",
      });
    } catch (error) {
      console.error("Error copying link:", error);
      toast({
        title: "Error",
        description: "Failed to copy link.",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case "accepted":
        return (
          <Badge variant="default" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            Accepted
          </Badge>
        );
      case "expired":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Expired
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline" className="gap-1">
            <X className="h-3 w-3" />
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (user?.metadata?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground">
            Only administrators can access this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Client onboarding</h1>
          <p className="text-muted-foreground">
            Manage client invitations and track onboarding progress
          </p>
        </div>
        <Dialog open={newInviteDialog} onOpenChange={setNewInviteDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              Send Invitation
            </Button>
          </DialogTrigger>
          <DialogContent className=" max-h-[85vh] h-fit overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Send Client Invitation</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Email Address</label>
                <Input
                  type="email"
                  placeholder="client@company.com"
                  value={newInviteData.email}
                  onChange={(e) =>
                    setNewInviteData((prev) => ({
                      ...prev,
                      email: e.target.value,
                    }))
                  }
                />
              </div>
              {newInviteData.role === "client" ? (
                <div>
                  <label
                    htmlFor="client_name"
                    className="block text-sm font-medium mb-1"
                  >
                    Client Name
                  </label>
                  <Input
                    id="client_name"
                    type="text"
                    placeholder="Enter client name"
                    value={newInviteData.client_name}
                    onChange={(e) =>
                      setNewInviteData({
                        ...newInviteData,
                        client_name: e.target.value,
                      })
                    }
                    required
                  />
                </div>
              ) : (
                <div>
                  <label
                    htmlFor="client_name"
                    className="block text-sm font-medium mb-1"
                  >
                    Name
                  </label>
                  <Input
                    id="client_name"
                    type="text"
                    placeholder="Enter name"
                    value={newInviteData.client_name}
                    onChange={(e) =>
                      setNewInviteData({
                        ...newInviteData,
                        client_name: e.target.value,
                      })
                    }
                    required
                  />
                </div>
              )}
              <div>
                <label className="text-sm font-medium">Role</label>
                <select
                  className="w-full p-2 border rounded-md"
                  value={newInviteData.role}
                  onChange={(e) =>
                    setNewInviteData((prev) => ({
                      ...prev,
                      role: e.target.value,
                    }))
                  }
                >
                  <option value="client">client</option>
                  <option value="modeler">3D Modeler</option>
                  <option value="qa">Quality Assurance</option>
                </select>
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={sendInvitation}
                  disabled={sendingInvite}
                  className="flex-1"
                >
                  {sendingInvite ? "Sending..." : "Send Invitation"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setNewInviteDialog(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, invitation: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Invitation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Are you sure you want to permanently delete the invitation for{" "}
              <span className="font-medium">
                {deleteDialog.invitation?.email}
              </span>
              ?
            </p>
            <p className="text-sm text-muted-foreground">
              This action cannot be undone. The invitation will be permanently
              removed from the system.
            </p>
            <div className="flex gap-2 pt-4">
              <Button
                variant="destructive"
                onClick={() =>
                  deleteDialog.invitation &&
                  deleteInvitation(deleteDialog.invitation.id)
                }
                className="flex-1"
              >
                Delete Permanently
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  setDeleteDialog({ open: false, invitation: null })
                }
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Clear History Dialog */}
      <Dialog open={clearHistoryDialog} onOpenChange={setClearHistoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Invitation History</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Are you sure you want to permanently delete all non-accepted
              invitations?
            </p>
            <p className="text-sm text-muted-foreground">
              This will delete all pending, expired, and cancelled invitations.
              Accepted invitations will be preserved. This action cannot be
              undone.
            </p>
            <div className="flex gap-2 pt-4">
              <Button
                variant="destructive"
                onClick={clearHistory}
                className="flex-1"
              >
                Clear History
              </Button>
              <Button
                variant="outline"
                onClick={() => setClearHistoryDialog(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total Invitations</p>
              <p className="text-2xl font-bold">{invitations.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold">
                {invitations.filter((i) => i.status === "pending").length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Accepted</p>
              <p className="text-2xl font-bold">
                {invitations.filter((i) => i.status === "accepted").length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-sm text-muted-foreground">Expired/Cancelled</p>
              <p className="text-2xl font-bold">
                {
                  invitations.filter(
                    (i) => i.status === "expired" || i.status === "cancelled"
                  ).length
                }
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Invitations Table */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Invitation History</h2>
            {invitations.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setClearHistoryDialog(true)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                title={`Delete ${invitations.filter((inv) => inv.status !== "accepted").length} non-accepted invitations`}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear History
                <span className="ml-1 text-xs">
                  (
                  {
                    invitations.filter((inv) => inv.status !== "accepted")
                      .length
                  }
                  )
                </span>
              </Button>
            )}
          </div>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : invitations.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No invitations sent yet.</p>
              <p className="text-sm text-muted-foreground">
                Send your first invitation to get started.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Invited</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">
                      {invitation.email}
                    </TableCell>
                    <TableCell>{invitation.client_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{invitation.role}</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(invitation.status)}</TableCell>
                    <TableCell>{formatDate(invitation.invited_at)}</TableCell>
                    <TableCell>{formatDate(invitation.expires_at)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            copyInvitationLink(invitation.invitation_link)
                          }
                          title="Copy invitation link"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        {invitation.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => cancelInvitation(invitation.id)}
                            title="Cancel invitation"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                        {invitation.status === "accepted" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              window.open(
                                `/asset-library?client=${invitation.client_name}`,
                                "_blank"
                              )
                            }
                            title="View client assets"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                        {/* Delete button for non-accepted invitations */}
                        {invitation.status !== "accepted" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDeleteDialog({ open: true, invitation })
                            }
                            title="Delete invitation"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>
    </div>
  );
}
