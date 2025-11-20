"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/useUser";
import { useLoading } from "@/contexts/LoadingContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Input } from "@/components/ui/inputs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs";
import { Badge } from "@/components/ui/feedback";
import { Label } from "@/components/ui/display";
import { Shield, User } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/display";
import {
  UserPlus,
  Mail,
  Send,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

interface Invitation {
  id: string;
  email: string;
  role: string;
  client_role?: string | null; // Client sub-role: 'client_admin' or 'product_manager'
  status: string;
  created_at: string;
  expires_at: string;
  accepted_at?: string;
}

export default function InviteMembersPage() {
  const router = useRouter();
  const user = useUser();
  const { startLoading, stopLoading } = useLoading();

  const [loading, setLoading] = useState(false);
  const [invitationsLoading, setInvitationsLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    clientRole: "product_manager" as "client_admin" | "product_manager", // Default to product_manager
  });

  // Check if user is a client
  useEffect(() => {
    if (user && user.metadata?.role !== "client") {
      toast.error("Access Denied", {
        description: "Only clients can access this page",
      });
      router.push("/dashboard");
    }
  }, [user, router]);

  // Fetch invitations
  useEffect(() => {
    if (user?.metadata?.role === "client") {
      fetchInvitations();
    }
  }, [user]);

  const fetchInvitations = async () => {
    try {
      setInvitationsLoading(true);
      const response = await fetch("/api/invitations/list");

      if (!response.ok) {
        throw new Error("Failed to fetch invitations");
      }

      const data = await response.json();
      setInvitations(data.invitations || []);
    } catch (error) {
      console.error("Error fetching invitations:", error);
      toast.error("Failed to load invitations");
    } finally {
      setInvitationsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email) {
      toast.error("Please enter an email address");
      return;
    }

    setLoading(true);
    startLoading();

    try {
      const response = await fetch("/api/invitations/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send invitation");
      }

      toast.success("Invitation sent!", {
        description: `An invitation has been sent to ${formData.email}`,
      });

      // Reset form
      setFormData({
        email: "",
        firstName: "",
        lastName: "",
        clientRole: "product_manager",
      });

      // Refresh invitations list
      fetchInvitations();
    } catch (error: any) {
      console.error("Error sending invitation:", error);
      toast.error("Failed to send invitation", {
        description: error.message || "Please try again",
      });
    } finally {
      setLoading(false);
      stopLoading();
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!confirm("Are you sure you want to cancel this invitation?")) {
      return;
    }

    setCancellingId(invitationId);

    try {
      const response = await fetch("/api/invitations/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ invitationId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel invitation");
      }

      toast.success("Invitation cancelled");
      fetchInvitations(); // Refresh the list
    } catch (error: any) {
      console.error("Error cancelling invitation:", error);
      toast.error("Failed to cancel invitation", {
        description: error.message || "Please try again",
      });
    } finally {
      setCancellingId(null);
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
          <Badge variant="default" className="gap-1 bg-green-600">
            <CheckCircle className="h-3 w-3" />
            Accepted
          </Badge>
        );
      case "expired":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Expired
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline" className="gap-1">
            <XCircle className="h-3 w-3" />
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRoleName = (role: string, clientRole?: string | null) => {
    if (role === "client") {
      // Show client sub-role for client users
      if (clientRole === "client_admin") {
        return "Client Admin";
      } else if (clientRole === "product_manager") {
        return "Product Manager";
      }
      return "Client"; // Fallback
    }
    switch (role) {
      case "modeler":
        return "Modeler";
      case "qa":
        return "QA";
      case "admin":
        return "Admin";
      default:
        return role;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!user || user.metadata?.role !== "client") {
    return null;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <UserPlus className="h-8 w-8" />
          Invite Team Members
        </h1>
        <p className="text-muted-foreground">
          Invite colleagues to join your organization on CharpstAR
        </p>
      </div>

      {/* Invitation Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Invitation
          </CardTitle>
          <CardDescription>
            Enter the email address of the person you want to invite to your
            team
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">
                Email Address *
              </Label>
              <Input
                type="email"
                placeholder="colleague@example.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
                className="w-full"
              />
            </div>

            <div>
              <Label className="text-sm font-medium mb-1.5 block">Role *</Label>
              <Select
                value={formData.clientRole}
                onValueChange={(value: "client_admin" | "product_manager") =>
                  setFormData({ ...formData, clientRole: value })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select role" />
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
              <p className="text-xs text-muted-foreground mt-1.5">
                {formData.clientRole === "client_admin"
                  ? "Client Admins can allocate products to colleagues and view all company products"
                  : "Product Managers can only view products allocated to them"}
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={loading || !formData.email}
                className="cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Invitation
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Invitations List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Sent Invitations</CardTitle>
              <CardDescription>
                Track the status of invitations you&apos;ve sent
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchInvitations}
              disabled={invitationsLoading}
              className="cursor-pointer"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${invitationsLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {invitationsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : invitations.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No invitations sent yet. Send your first invitation above!
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Accepted</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell className="font-medium">
                        {invitation.email}
                      </TableCell>
                      <TableCell>
                        {getRoleName(invitation.role, invitation.client_role)}
                      </TableCell>
                      <TableCell>{getStatusBadge(invitation.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(invitation.created_at)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {invitation.status === "pending" ? (
                          <span
                            className={
                              new Date(invitation.expires_at) < new Date()
                                ? "text-red-600"
                                : ""
                            }
                          >
                            {formatDate(invitation.expires_at)}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {invitation.accepted_at
                          ? formatDateTime(invitation.accepted_at)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {invitation.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleCancelInvitation(invitation.id)
                            }
                            disabled={cancellingId === invitation.id}
                            className="cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                          >
                            {cancellingId === invitation.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                How it works
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                When you send an invitation, the recipient will receive an email
                with a link to create their account. They&apos;ll automatically
                be added to your organization once they complete the signup
                process. Invitations expire after 7 days.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
