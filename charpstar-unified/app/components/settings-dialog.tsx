"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  EditUserDialogContent,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import {
  LogOut,
  User2,
  BarChart3,
  Users,
  ShieldCheck,
  UserPlus,
  Search,
  Pencil,
  Trash2,
  MoreHorizontal,
  Shield,
  Mail,
  UserCog,
  Box,
  User,
  Crown,
  Star,
  Heart,
  Zap,
  Target,
  Palette,
  RotateCcw,
} from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/interactive";
import { Input } from "@/components/ui/inputs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs";
import { EditorThemePicker } from "@/components/ui/inputs";
import { Badge } from "@/components/ui/feedback";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/interactive";
import { useToast } from "@/components/ui/utilities";
import { Toaster } from "@/components/ui/feedback";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/display";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/display";
import { UserForm, UserFormValues } from "@/app/components/UserForm";
import { useUsers } from "@/lib/useUsers";
import { useFeaturePermissions } from "@/lib/useFeaturePermissions";
import { Switch } from "@/components/ui/inputs";
import { usePagePermission } from "@/lib/usePagePermission";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { cn } from "@/lib/utils";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Label } from "@/components/ui/display";
import { useLoadingState } from "@/hooks/useLoadingState";

interface UserProfile {
  id: string;
  email: string;
  role: string;
  name: string;
  updated_at: string;
  analytics_profile_id?: string;
  avatar_url?: string | null;
}

interface AnalyticsProfile {
  id: string;
  projectid: string;
  datasetid: string;
  tablename: string;
}

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const roleOptions = ["all", "admin", "client", "user"] as const;

interface FeaturePermissions {
  view_user_details: boolean;
  edit_user: boolean;
  add_user: boolean;
  delete_user: boolean;
}

interface Permission {
  role: string;
  resource: string;
  can_access: boolean;
  permission_type: "page" | "feature";
}

type GroupedPermissions = {
  [role: string]: Permission[];
};

interface ClientUser {
  id: string;
  name: string;
  email: string;
  created_at: string;
  avatar?: string;
}

// Add User type
interface User {
  id: string;
  email: string;
  role: string;
  name: string;
  analytics_profile_id?: string;
  avatar?: string;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [analyticsProfile, setAnalyticsProfile] =
    useState<AnalyticsProfile | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [activeTab, setActiveTab] = useState("account");
  const router = useRouter();
  const { toast } = useToast();
  const { withLoading } = useLoadingState();

  // Team management state
  const [userRole, setUserRole] = useState<string | undefined>();
  const { users, loading: usersLoading, error, fetchUsers } = useUsers(true);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] =
    useState<(typeof roleOptions)[number]>("all");

  // Feature permissions
  const { getFeaturePermissions } = useFeaturePermissions(true);
  const permissionsResult = getFeaturePermissions(userRole, [
    "view_user_details",
    "edit_user",
    "add_user",
    "delete_user",
  ]);
  const userPermissions: FeaturePermissions = {
    view_user_details: !!permissionsResult.view_user_details,
    edit_user: !!permissionsResult.edit_user,
    add_user: !!permissionsResult.add_user,
    delete_user: !!permissionsResult.delete_user,
  };

  // Inside the SettingsDialog component, add these state variables
  const [rolePermissions, setRolePermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const [clients, setClients] = useState<ClientUser[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsError, setClientsError] = useState<string | null>(null);

  const PAGE_LABELS: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/admin/permissions": "Permissions",
    "/settings": "Settings",
    "/users": "Users",
  };

  const FEATURE_LABELS: Record<string, string> = {
    export_data: "Export Data",
    invite_user: "Invite User",
    edit_user: "Edit User",
    delete_user: "Delete User",
    view_user_details: "View User Details",
  };

  function formatLabel(str: string) {
    return str
      .replace(/^\//, "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  }

  // Add permission check
  const {
    hasAccess,
    loading: permissionLoading,
    error: permissionError,
  } = usePagePermission(userRole, "/admin/permissions");

  // Update the permission filtering functions
  const pagePermissions = rolePermissions.filter((p) =>
    p.resource.startsWith("/")
  );
  const roleFeaturePermissions = rolePermissions.filter(
    (p) => !p.resource.startsWith("/")
  );

  const groupByRole = (permList: Permission[]) =>
    permList.reduce((acc: GroupedPermissions, perm) => {
      if (!acc[perm.role]) acc[perm.role] = [];
      acc[perm.role].push(perm);
      return acc;
    }, {});

  const groupedPagePermissions = groupByRole(pagePermissions);
  const groupedFeaturePermissions = groupByRole(roleFeaturePermissions);

  const pageResources = [
    ...new Set(pagePermissions.map((p) => p.resource)),
  ].sort();
  const featureResources = [
    ...new Set(roleFeaturePermissions.map((p) => p.resource)),
  ].sort();

  const handleToggle = async (perm: Permission) => {
    setUpdating(true);

    const updated = {
      ...perm,
      can_access: !perm.can_access,
    };

    setRolePermissions((prev) =>
      prev.map((p) =>
        p.role === perm.role &&
        p.resource === perm.resource &&
        p.permission_type === perm.permission_type
          ? updated
          : p
      )
    );

    try {
      const res = await fetch("/api/permissions/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });

      if (!res.ok) {
        throw new Error("Failed to update permission");
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to update permission",
        variant: "destructive",
      });
      // revert on failure
      setRolePermissions((prev) =>
        prev.map((p) =>
          p.role === perm.role &&
          p.resource === perm.resource &&
          p.permission_type === perm.permission_type
            ? perm
            : p
        )
      );
    } finally {
      setUpdating(false);
    }
  };

  // Add this to the useEffect that fetches user data
  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const response = await fetch("/api/permissions");
        if (!response.ok) {
          throw new Error("Failed to fetch permissions");
        }
        const data = await response.json();
        setRolePermissions(data);
      } catch (error) {
        console.error("Error fetching permissions:", error);
        toast({
          title: "Error",
          description: "Failed to load permissions",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      fetchPermissions();
    }
  }, [open, toast]);
  // might wanna remove toast from the dependency array

  // Fetch user & analytics profile
  useEffect(() => {
    const fetchUserAndAnalytics = async () => {
      try {
        const {
          data: { user: authUser },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !authUser) {
          router.push("/auth");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authUser.id)
          .single();

        if (profileError || !profile) {
          return;
        }

        setUser(profile);
        setUserRole(profile.role);

        // Fetch analytics profile if exists
        if (profile.analytics_profile_id) {
          const { data: analytics, error: analyticsError } = await supabase
            .from("analytics_profiles")
            .select("*")
            .eq("id", profile.analytics_profile_id)
            .single();

          if (!analyticsError) {
            setAnalyticsProfile(analytics);
          }
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
      }
    };

    if (open) {
      fetchUserAndAnalytics();
      fetchUsers();
    }
  }, [router, open, fetchUsers, toast]);

  // Add this useEffect to fetch permissions when dialog opens
  useEffect(() => {
    if (open && userRole) {
      getFeaturePermissions(userRole, [
        "view_user_details",
        "edit_user",
        "add_user",
        "delete_user",
      ]);
    }
  }, [open, userRole, getFeaturePermissions]);

  // Add handler for tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === "team" && userRole) {
      getFeaturePermissions(userRole, [
        "view_user_details",
        "edit_user",
        "add_user",
        "delete_user",
      ]);
    }
  };

  // Actions
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
      router.push("/auth");
    } catch (error) {
      console.error("Logout error:", error);
      toast({
        title: "Error",
        description: "Failed to log out. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoggingOut(false);
    }
  };

  const handleResetTour = () => {
    // Clear the tour completion flag from localStorage
    localStorage.removeItem("client-dashboard-tour-completed");

    // Show success message
    toast({
      title: "Tour Reset",
      description:
        "The dashboard tour has been reset. It will start again on your next visit.",
    });

    // Trigger the tour immediately by dispatching a custom event
    window.dispatchEvent(new CustomEvent("resetDashboardTour"));
  };

  const handleAddUser = async (formData: UserFormValues) => {
    if (!userPermissions.add_user) {
      toast({
        title: "Error",
        description: "You don&apos;t have permission to add users",
        variant: "destructive",
      });
      return;
    }

    await withLoading(async () => {
      setIsProcessing(true);
      try {
        const response = await fetch("/api/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Failed to create user");
        }

        await fetchUsers();
        setIsAddUserDialogOpen(false);
        toast({
          title: "Success",
          description: "User created successfully",
        });
      } catch (err) {
        console.error("Error adding user:", err);
        toast({
          title: "Error",
          description:
            err instanceof Error ? err.message : "Failed to create user",
          variant: "destructive",
        });
      } finally {
        setIsProcessing(false);
      }
    });
  };

  const handleEditUser = async (userData: Partial<UserProfile>) => {
    if (!editingUser) return;

    await withLoading(async () => {
      setIsProcessing(true);
      try {
        const response = await fetch(`/api/users/${editingUser.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(userData),
        });

        if (!response.ok) {
          throw new Error("Failed to update user");
        }

        await fetchUsers();
        setIsEditUserDialogOpen(false);
        toast({
          title: "Success",
          description: "User updated successfully",
        });
      } catch {
        console.error("Error updating user");
        toast({
          title: "Error",
          description: "Failed to update user",
          variant: "destructive",
        });
      } finally {
        setIsProcessing(false);
      }
    });
  };

  const handleDeleteUser = async (userId: string) => {
    if (!userPermissions.delete_user) {
      toast({
        title: "Error",
        description: "You don&apos;t have permission to delete users",
        variant: "destructive",
      });
      return;
    }

    if (!confirm("Are you sure you want to delete this user?")) return;

    await withLoading(async () => {
      setIsProcessing(true);
      try {
        const response = await fetch(`/api/users/${userId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Failed to delete user");
        }

        await fetchUsers();
        toast({
          title: "Success",
          description: "User deleted successfully",
        });
      } catch (err) {
        console.error("Error deleting user:", err);
        toast({
          title: "Error",
          description:
            err instanceof Error ? err.message : "Failed to delete user",
          variant: "destructive",
        });
      } finally {
        setIsProcessing(false);
      }
    });
  };

  // Filter users based on search term and selected role
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = selectedRole === "all" || user.role === selectedRole;

    return matchesSearch && matchesRole;
  });

  // Check if user has any action permissions
  const hasActionPermissions =
    userPermissions.edit_user || userPermissions.delete_user;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  // Function to get a role-specific badge color
  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "default";
      case "manager":
        return "blue";
      case "editor":
        return "green";
      default:
        return "secondary";
    }
  };

  // Function to format date nicely
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  };

  useEffect(() => {
    async function fetchClients() {
      if (user?.role !== "admin") return;
      setClientsLoading(true);
      setClientsError(null);
      try {
        const res = await fetch("/api/users?role=client");
        if (!res.ok) throw new Error("Failed to fetch clients");
        const data = await res.json();
        setClients(data.users || []);
      } catch (err: any) {
        setClientsError(err.message || "Unknown error");
      } finally {
        setClientsLoading(false);
      }
    }
    if (open && user?.role === "admin") fetchClients();
  }, [open, user?.role]);

  // Add type conversion for User to UserProfile
  const handleEditUserClick = (user: User) => {
    const userProfile: UserProfile = {
      id: user.id,
      email: user.email || "",
      role: user.role || "",
      name: user.name || "",
      updated_at: new Date().toISOString(),
      analytics_profile_id: user.analytics_profile_id,
      avatar_url: user.avatar,
    };
    setEditingUser(userProfile);
    setIsEditUserDialogOpen(true);
  };

  // Helper function to render avatars with support for both custom and preset avatars
  const renderAvatar = (
    avatar: string | Blob | null | undefined,
    name: string,
    size: "sm" | "md" | "lg" = "md"
  ) => {
    const sizeClasses = {
      sm: "h-8 w-8",
      md: "h-8 w-8 sm:h-9 sm:w-9",
      lg: "h-12 w-12 sm:h-14 sm:w-14",
    };

    // Convert avatar to string if it's a Blob or handle null/undefined
    const avatarString = typeof avatar === "string" ? avatar : null;

    if (!avatarString) {
      return (
        <Avatar className={`${sizeClasses[size]} border border-border`}>
          <AvatarFallback className="bg-primary/10 text-muted-foreground">
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>
      );
    }

    if (avatarString.startsWith("http")) {
      return (
        <Avatar className={`${sizeClasses[size]} border border-border`}>
          <AvatarImage src={avatarString} alt={name} />
          <AvatarFallback className="bg-primary/10 text-muted-foreground">
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>
      );
    }

    // Preset avatar
    const presetAvatars = [
      { id: "default", icon: User, color: "bg-blue-500" },
      { id: "team", icon: Users, color: "bg-green-500" },
      { id: "premium", icon: Crown, color: "bg-yellow-500" },
      { id: "star", icon: Star, color: "bg-purple-500" },
      { id: "heart", icon: Heart, color: "bg-pink-500" },
      { id: "zap", icon: Zap, color: "bg-orange-500" },
      { id: "target", icon: Target, color: "bg-red-500" },
      { id: "palette", icon: Palette, color: "bg-indigo-500" },
    ];

    const preset = presetAvatars.find((p) => p.id === avatarString);
    if (preset) {
      const IconComponent = preset.icon;
      return (
        <Avatar className={`${sizeClasses[size]} border border-border`}>
          <AvatarFallback className={`${preset.color} text-white`}>
            <IconComponent className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      );
    }

    // Fallback to initials
    return (
      <Avatar className={`${sizeClasses[size]} border border-border`}>
        <AvatarFallback className="bg-primary/10 text-muted-foreground">
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
    );
  };

  // Replace window.location.href calls with router.push
  const handleViewDashboardAs = (clientId: string) => {
    router.push(`/analytics?impersonate=${clientId}`);
  };

  const handleOpenEditor = (clientName: string) => {
    router.push(`/3d-editor/${clientName}`);
  };

  const handleViewDemo = (clientName: string) => {
    router.push(`/3d-editor/${clientName}/demo`);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="w-full max-w-[98vw] h-[85vh] sm:max-w-6xl max-w-6xl sm:h-[58vh] flex flex-col p-2 sm:p-6"
          style={{ minWidth: 0 }}
          onPointerDownOutside={(e) => {
            e.preventDefault();
            onOpenChange(false);
          }}
        >
          <VisuallyHidden>
            <DialogTitle>Settings</DialogTitle>
          </VisuallyHidden>

          {user ? (
            <Tabs
              value={activeTab}
              onValueChange={handleTabChange}
              className="w-full flex-1 flex flex-col"
            >
              {/* Mobile Dropdown */}
              <div className="sm:hidden mb-4 pt-15">
                <Select value={activeTab} onValueChange={handleTabChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a tab" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="account">Account</SelectItem>
                    {user?.role === "admin" && (
                      <>
                        <SelectItem value="team">Team</SelectItem>
                        <SelectItem value="permissions">Permissions</SelectItem>
                        <SelectItem value="clients">Clients</SelectItem>
                        <SelectItem value="3d-editor">3D Editor</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Tabs List (visible only on sm and up) */}
              <TabsList
                className={`hidden sm:grid w-full gap-2 ${
                  user?.role === "admin" ? "grid-cols-5" : "grid-cols-1"
                }`}
              >
                <TabsTrigger
                  value="account"
                  className="flex items-center justify-center gap-2 cursor-pointer w-full sm:w-full"
                >
                  <User2 className="w-4 h-5" />
                  Account
                </TabsTrigger>
                {user?.role === "admin" && (
                  <>
                    <TabsTrigger
                      value="team"
                      className="flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto"
                    >
                      <Users className="w-4 h-4" />
                      Team
                    </TabsTrigger>
                    <TabsTrigger
                      value="permissions"
                      className="flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Permissions
                    </TabsTrigger>
                    <TabsTrigger
                      value="clients"
                      className="flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto"
                    >
                      <Users className="w-4 h-4" />
                      Clients
                    </TabsTrigger>
                    <TabsTrigger
                      value="3d-editor"
                      className="flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto"
                    >
                      <Box className="w-4 h-4" />
                      3D Editor
                    </TabsTrigger>
                  </>
                )}
              </TabsList>

              <div className="flex-1 overflow-y-auto mt-3 sm:mt-6">
                <TabsContent value="account" className="space-y-6">
                  <div className="space-y-3 sm:space-y-6  px-1  text-xs sm:text-base max-h-[60vh] sm:max-h-[48vh] overflow-y-auto">
                    {/* Email and Role */}
                    <div className="flex flex-col gap-1">
                      <Label className="text-muted-foreground text-xs sm:text-sm">
                        Email
                      </Label>
                      <div className="text-xs sm:text-lg font-medium text-foreground break-all">
                        {user?.email}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-muted-foreground text-xs sm:text-sm">
                        Role
                      </Label>
                      <div className="text-xs sm:text-base text-foreground capitalize">
                        {user?.role || "User"}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs sm:text-sm">
                        Theme
                      </Label>
                      <div className="flex flex-col gap-2">
                        <EditorThemePicker />
                      </div>
                    </div>

                    {/* Reset Tour Guide */}
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs sm:text-sm">
                        Help
                      </Label>
                      <div className="flex flex-col gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleResetTour}
                          className="gap-2 cursor-pointer text-xs max-w-[fit-content] sm:text-sm h-8 sm:h-10 px-2 sm:px-4 justify-start "
                        >
                          <RotateCcw className="w-4 h-4" />
                          Reset Dashboard Tour Guide
                        </Button>
                        <div className="text-xs text-muted-foreground">
                          Restart the interactive tour to learn about dashboard
                          features
                        </div>
                      </div>
                    </div>
                    {/* Profile Picture */}
                    {/* <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-3">
                        {renderAvatar(
                          user?.avatar_url,
                          user?.name || "User",
                          "lg"
                        )}
                        <div className="text-xs text-muted-foreground">
                          Your profile picture
                        </div>
                      </div>
                    </div> */}
                    {/* Analytics Profile */}
                    <div className="flex flex-col gap-1">
                      <Label className="text-muted-foreground mb-1 flex items-center gap-2 text-xs sm:text-sm">
                        <BarChart3 className="w-4 h-4" /> Analytics Profile
                      </Label>
                      {user?.analytics_profile_id ? (
                        analyticsProfile ? (
                          <div className="rounded-lg border border-muted p-2 sm:p-3 bg-muted/40">
                            <div className="text-xs text-muted-foreground">
                              <span className="font-medium">Dataset ID:</span>{" "}
                              {analyticsProfile.datasetid}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              <span className="font-medium">Table Name:</span>{" "}
                              {analyticsProfile.tablename}
                            </div>
                          </div>
                        ) : null
                      ) : (
                        <div className="text-xs sm:text-sm text-muted-foreground">
                          No analytics profile assigned
                        </div>
                      )}
                    </div>

                    {/* Theme Settings */}

                    <div className="flex justify-start pt-2 sm:pt-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleLogout}
                        loading={loggingOut}
                        loadingText="Logging out..."
                        className="gap-2 cursor-pointer text-xs sm:text-sm h-8 sm:h-10 px-2 sm:px-4"
                      >
                        <LogOut className="w-4 h-4" />
                        Log Out
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                {user?.role === "admin" && (
                  <>
                    <TabsContent
                      value="team"
                      className="space-y-4 sm:space-y-6 h-full"
                    >
                      <div className="space-y-4 sm:space-y-6 h-full">
                        {!userPermissions.view_user_details ? (
                          <div className="text-center py-8 text-muted-foreground">
                            You don&apos;t have permission to view user details.
                          </div>
                        ) : (
                          <>
                            {/* Filters */}
                            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                              <div className="relative flex-1 w-full">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                <Input
                                  placeholder="Search by name or email..."
                                  value={searchTerm}
                                  onChange={(e) =>
                                    setSearchTerm(e.target.value)
                                  }
                                  className="pl-9 w-full"
                                />
                              </div>

                              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                <Select
                                  value={selectedRole}
                                  onValueChange={(
                                    value: (typeof roleOptions)[number]
                                  ) => setSelectedRole(value)}
                                >
                                  <SelectTrigger className="w-full sm:w-[180px] h-10 cursor-pointer">
                                    <SelectValue placeholder="Select role" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {roleOptions.map((role) => (
                                      <SelectItem
                                        key={role}
                                        value={role}
                                        className="cursor-pointer"
                                      >
                                        {role === "all"
                                          ? "All Roles"
                                          : role.charAt(0).toUpperCase() +
                                            role.slice(1)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                {userPermissions.add_user && (
                                  <Dialog
                                    open={isAddUserDialogOpen}
                                    onOpenChange={setIsAddUserDialogOpen}
                                  >
                                    <DialogTrigger asChild>
                                      <Button
                                        variant="default"
                                        className="whitespace-nowrap h-9 cursor-pointer w-full sm:w-auto"
                                      >
                                        <UserPlus className="w-4 h-4 mr-2" />
                                        Add User
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-md max-h-[30vh] overflow-y-auto">
                                      <DialogHeader>
                                        <DialogTitle>Add New User</DialogTitle>
                                      </DialogHeader>
                                      <UserForm
                                        onSubmit={handleAddUser}
                                        isLoading={isProcessing}
                                      />
                                    </DialogContent>
                                  </Dialog>
                                )}
                              </div>
                            </div>

                            {/* Table for md+ screens */}
                            <div className="rounded-md border max-h-[65vh] sm:max-h-[42vh] overflow-y-auto w-full overflow-x-auto hidden md:block">
                              <Table className="min-w-[600px]">
                                <TableHeader className="sticky top-0 bg-background z-10">
                                  <TableRow className="bg-muted/50">
                                    <TableHead className="font-medium text-left px-2 py-2 text-xs sm:text-sm sm:px-4 sm:py-3">
                                      User
                                    </TableHead>
                                    <TableHead className="font-medium text-left px-2 py-2 text-xs sm:text-sm sm:px-4 sm:py-3">
                                      <span className="flex items-center justify-start gap-2">
                                        Role
                                        <Shield className="h-3 w-3 opacity-0" />
                                      </span>
                                    </TableHead>
                                    <TableHead className="font-medium hidden md:table-cell px-2 py-2 text-xs sm:text-sm sm:px-4 sm:py-3">
                                      <span className="flex items-center justify-start gap-2">
                                        Created
                                      </span>
                                    </TableHead>
                                    {hasActionPermissions && (
                                      <TableHead className="w-[80px] text-right px-2 py-2 text-xs sm:text-sm sm:px-4 sm:py-3">
                                        Actions
                                      </TableHead>
                                    )}
                                  </TableRow>
                                </TableHeader>

                                <TableBody>
                                  {usersLoading ? (
                                    <TableRow>
                                      <TableCell
                                        colSpan={4}
                                        className="text-center py-8 px-2 text-xs sm:text-sm sm:px-4"
                                      >
                                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                          <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-current" />
                                          Loading users...
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ) : error ? (
                                    <TableRow>
                                      <TableCell
                                        colSpan={4}
                                        className="text-center py-8 px-2 text-xs sm:text-sm sm:px-4 text-destructive"
                                      >
                                        Error loading users: {error}
                                      </TableCell>
                                    </TableRow>
                                  ) : filteredUsers.length === 0 ? (
                                    <TableRow>
                                      <TableCell
                                        colSpan={hasActionPermissions ? 4 : 3}
                                        className="text-center text-muted-foreground py-16 px-2 text-xs sm:text-sm sm:px-4"
                                      >
                                        <div className="flex flex-col items-center justify-center gap-2">
                                          <UserCog className="h-12 w-12 text-muted-foreground/50" />
                                          <p>No users found</p>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ) : (
                                    filteredUsers.map((user) => (
                                      <TableRow
                                        key={user.id}
                                        className="group transition-colors hover:bg-accent/30 cursor-pointer"
                                      >
                                        <TableCell className="align-middle text-left px-2 py-2 text-xs sm:text-sm sm:px-4 sm:py-3">
                                          <div className="flex items-center gap-3">
                                            {renderAvatar(
                                              user.avatar_url,
                                              user.name
                                            )}
                                            <div>
                                              <p className="font-medium text-sm sm:text-base">
                                                {user.name}
                                              </p>
                                              <p className="text-xs sm:text-sm text-muted-foreground flex items-center">
                                                <Mail className="mr-1 h-3 w-3" />
                                                {user.email}
                                              </p>
                                            </div>
                                          </div>
                                        </TableCell>

                                        <TableCell className="align-middle text-left px-2 py-2 text-xs sm:text-sm sm:px-4 sm:py-3">
                                          <div className="flex items-center gap-2">
                                            <Badge
                                              variant={
                                                getRoleBadgeVariant(
                                                  user.role
                                                ) as
                                                  | "default"
                                                  | "destructive"
                                                  | "secondary"
                                                  | "outline"
                                                  | null
                                                  | undefined
                                              }
                                              className="text-xs sm:text-sm"
                                            >
                                              {user.role
                                                .charAt(0)
                                                .toUpperCase() +
                                                user.role.slice(1)}
                                            </Badge>
                                            {user.role === "admin" ? (
                                              <Shield className="h-3 w-3 text-primary" />
                                            ) : (
                                              <span className="h-3 w-3" />
                                            )}
                                          </div>
                                        </TableCell>

                                        <TableCell className="hidden md:table-cell text-muted-foreground text-sm align-middle text-left px-2 py-2 text-xs sm:text-sm sm:px-4 sm:py-3">
                                          {formatDate(user.created_at)}
                                        </TableCell>

                                        {hasActionPermissions && (
                                          <TableCell className="text-right align-middle px-2 py-2 text-xs sm:text-sm sm:px-4 sm:py-3">
                                            <DropdownMenu>
                                              <DropdownMenuTrigger asChild>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-8 w-8 p-0 cursor-pointer"
                                                >
                                                  <MoreHorizontal className="h-4 w-4" />
                                                  <span className="sr-only">
                                                    Open menu
                                                  </span>
                                                </Button>
                                              </DropdownMenuTrigger>
                                              <DropdownMenuContent align="end">
                                                {userPermissions.edit_user && (
                                                  <DropdownMenuItem
                                                    className="cursor-pointer"
                                                    onClick={() =>
                                                      handleEditUserClick(user)
                                                    }
                                                  >
                                                    <Pencil className="w-4 h-4 mr-2" />
                                                    Edit user
                                                  </DropdownMenuItem>
                                                )}
                                                {userPermissions.edit_user &&
                                                  userPermissions.delete_user && (
                                                    <DropdownMenuSeparator />
                                                  )}
                                                {userPermissions.delete_user && (
                                                  <DropdownMenuItem
                                                    className="cursor-pointer text-destructive focus:text-destructive"
                                                    onClick={() =>
                                                      handleDeleteUser(user.id)
                                                    }
                                                  >
                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                    Delete user
                                                  </DropdownMenuItem>
                                                )}
                                              </DropdownMenuContent>
                                            </DropdownMenu>
                                          </TableCell>
                                        )}
                                      </TableRow>
                                    ))
                                  )}
                                </TableBody>
                              </Table>
                            </div>

                            {/* Mobile card list */}
                            <div className="md:hidden space-y-4">
                              {usersLoading ? (
                                <div className="text-center py-8 text-muted-foreground">
                                  <div className="flex items-center justify-center gap-2">
                                    <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-current" />
                                    Loading users...
                                  </div>
                                </div>
                              ) : error ? (
                                <div className="text-center py-8 text-destructive">
                                  Error loading users: {error}
                                </div>
                              ) : filteredUsers.length === 0 ? (
                                <div className="text-center text-muted-foreground py-8">
                                  <UserCog className="mx-auto h-12 w-12 text-muted-foreground/50" />
                                  <p>No users found</p>
                                </div>
                              ) : (
                                // 🎯 Make only this part scrollable
                                <div className="max-h-[40vh] overflow-y-auto space-y-4 pr-1">
                                  {filteredUsers.map((user) => (
                                    <Card
                                      key={user.id}
                                      className="cursor-pointer hover:bg-accent/30 transition-colors"
                                    >
                                      <CardContent className="p-4 space-y-2">
                                        <div className="flex items-center gap-3">
                                          {renderAvatar(
                                            user.avatar_url,
                                            user.name
                                          )}
                                          <div className="flex flex-col flex-1">
                                            <p className="font-medium text-base">
                                              {user.name}
                                            </p>
                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                              <Mail className="h-3 w-3" />
                                              {user.email}
                                            </p>
                                          </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                          <Badge
                                            variant={
                                              getRoleBadgeVariant(user.role) as
                                                | "default"
                                                | "destructive"
                                                | "secondary"
                                                | "outline"
                                                | null
                                                | undefined
                                            }
                                            className="text-xs"
                                          >
                                            {user.role.charAt(0).toUpperCase() +
                                              user.role.slice(1)}
                                          </Badge>
                                          {user.role === "admin" && (
                                            <Shield className="h-3 w-3 text-primary" />
                                          )}
                                          <span className="text-xs text-muted-foreground ml-auto">
                                            {formatDate(user.created_at)}
                                          </span>
                                        </div>

                                        {hasActionPermissions && (
                                          <div className="flex justify-end">
                                            <DropdownMenu>
                                              <DropdownMenuTrigger asChild>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-8 w-8 p-0 cursor-pointer"
                                                >
                                                  <MoreHorizontal className="h-4 w-4" />
                                                  <span className="sr-only">
                                                    Open menu
                                                  </span>
                                                </Button>
                                              </DropdownMenuTrigger>
                                              <DropdownMenuContent align="end">
                                                {userPermissions.edit_user && (
                                                  <DropdownMenuItem
                                                    className="cursor-pointer"
                                                    onClick={() =>
                                                      handleEditUserClick(user)
                                                    }
                                                  >
                                                    <Pencil className="w-4 h-4 mr-2" />
                                                    Edit user
                                                  </DropdownMenuItem>
                                                )}
                                                {userPermissions.edit_user &&
                                                  userPermissions.delete_user && (
                                                    <DropdownMenuSeparator />
                                                  )}
                                                {userPermissions.delete_user && (
                                                  <DropdownMenuItem
                                                    className="cursor-pointer text-destructive focus:text-destructive"
                                                    onClick={() =>
                                                      handleDeleteUser(user.id)
                                                    }
                                                  >
                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                    Delete user
                                                  </DropdownMenuItem>
                                                )}
                                              </DropdownMenuContent>
                                            </DropdownMenu>
                                          </div>
                                        )}
                                      </CardContent>
                                    </Card>
                                  ))}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent
                      value="permissions"
                      className="space-y-6 max-h-[80vh] sm:max-h-[48vh] overflow-y-auto"
                    >
                      <div className="space-y-6 h-full overflow-y-auto">
                        {permissionError ? (
                          <div className="text-center py-8 text-destructive">
                            An error occurred while checking permissions:{" "}
                            {permissionError}
                          </div>
                        ) : !hasAccess && userRole && !permissionLoading ? (
                          <div className="text-center py-8 text-muted-foreground">
                            You don&apos;t have permission to access the
                            permissions page.
                          </div>
                        ) : loading || permissionLoading || !userRole ? (
                          <div className="text-center py-8">
                            <div className="flex items-center justify-center gap-2 text-muted-foreground">
                              <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-current" />
                              Loading permissions...
                            </div>
                          </div>
                        ) : (
                          <div className="max-h-[70vh] overflow-y-auto space-y-4 p-1">
                            {/* Page Access */}
                            <Card className="rounded-xl shadow-sm border border-border">
                              <CardHeader>
                                <CardTitle>Page Access</CardTitle>
                                <CardDescription>
                                  Control which roles can access each page of
                                  your app.
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="p-0">
                                <div className="rounded-md overflow-x-auto w-full">
                                  <Table className="min-w-[600px]">
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="text-right font-bold text-foreground bg-muted">
                                          <span className="flex items-center justify-start gap-2 pl-0.5">
                                            Role
                                          </span>
                                        </TableHead>
                                        {pageResources.map((res) => (
                                          <TableHead
                                            key={res}
                                            className="text-center font-bold text-foreground bg-muted"
                                          >
                                            {PAGE_LABELS[res] ||
                                              formatLabel(res)}
                                          </TableHead>
                                        ))}
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {Object.keys(groupedPagePermissions).map(
                                        (role, i) => (
                                          <TableRow
                                            key={role}
                                            className={cn(
                                              i % 2 === 0
                                                ? "bg-card"
                                                : "bg-muted",
                                              "hover:bg-muted transition-colors"
                                            )}
                                          >
                                            <TableCell className="font-medium text-foreground pl-4 whitespace-nowrap">
                                              {role}
                                            </TableCell>
                                            {pageResources.map((res) => {
                                              const perm =
                                                groupedPagePermissions[
                                                  role
                                                ]?.find(
                                                  (p) => p.resource === res
                                                );
                                              return (
                                                <TableCell
                                                  key={`${role}-${res}`}
                                                  className="text-center"
                                                >
                                                  {perm ? (
                                                    <Switch
                                                      checked={perm.can_access}
                                                      onCheckedChange={() =>
                                                        handleToggle(perm)
                                                      }
                                                      disabled={updating}
                                                      aria-label={
                                                        perm.can_access
                                                          ? `Disable ${role} access to ${res}`
                                                          : `Enable ${role} access to ${res}`
                                                      }
                                                    />
                                                  ) : (
                                                    <span className="text-muted-foreground select-none">
                                                      –
                                                    </span>
                                                  )}
                                                </TableCell>
                                              );
                                            })}
                                          </TableRow>
                                        )
                                      )}
                                    </TableBody>
                                  </Table>
                                </div>
                              </CardContent>
                            </Card>

                            {/* Feature Access */}
                            <Card className="rounded-xl shadow-sm border border-border">
                              <CardHeader>
                                <CardTitle>Feature Access</CardTitle>
                                <CardDescription>
                                  Fine-tune access to app features by role.
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="p-0">
                                <div className="rounded-md overflow-x-auto w-full">
                                  <Table className="min-w-[600px]">
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="text-left font-bold text-foreground bg-muted">
                                          Role
                                        </TableHead>
                                        {featureResources.map((res) => (
                                          <TableHead
                                            key={res}
                                            className="text-center font-bold text-foreground bg-muted"
                                          >
                                            {FEATURE_LABELS[res] ||
                                              formatLabel(res)}
                                          </TableHead>
                                        ))}
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {Object.keys(
                                        groupedFeaturePermissions
                                      ).map((role, i) => (
                                        <TableRow
                                          key={role}
                                          className={cn(
                                            i % 2 === 0
                                              ? "bg-card"
                                              : "bg-muted",
                                            "hover:bg-muted transition-colors"
                                          )}
                                        >
                                          <TableCell className="font-medium text-foreground pl-4 whitespace-nowrap">
                                            {role}
                                          </TableCell>
                                          {featureResources.map((res) => {
                                            const perm =
                                              groupedFeaturePermissions[
                                                role
                                              ]?.find(
                                                (p) => p.resource === res
                                              );
                                            return (
                                              <TableCell
                                                key={`${role}-${res}`}
                                                className="text-center"
                                              >
                                                {perm ? (
                                                  <Switch
                                                    checked={perm.can_access}
                                                    onCheckedChange={() =>
                                                      handleToggle(perm)
                                                    }
                                                    disabled={updating}
                                                    aria-label={
                                                      perm.can_access
                                                        ? `Disable ${role} access to ${res}`
                                                        : `Enable ${role} access to ${res}`
                                                    }
                                                  />
                                                ) : (
                                                  <span className="text-muted-foreground select-none">
                                                    –
                                                  </span>
                                                )}
                                              </TableCell>
                                            );
                                          })}
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="clients" className="space-y-6">
                      <div className="rounded-md border max-h-[65vh] sm:max-h-[42vh] overflow-y-auto w-full overflow-x-auto">
                        <Table className="min-w-[600px]">
                          <TableHeader className="sticky top-0 bg-background z-10">
                            <TableRow className="bg-muted/50">
                              <TableHead className="font-medium text-left px-2 py-2 text-xs sm:text-sm sm:px-4 sm:py-3">
                                Client
                              </TableHead>
                              <TableHead className="font-medium text-left px-2 py-2 text-xs sm:text-sm sm:px-4 sm:py-3">
                                <span className="flex items-center justify-start gap-2">
                                  Email
                                </span>
                              </TableHead>
                              <TableHead className="font-medium hidden md:table-cell px-2 py-2 text-xs sm:text-sm sm:px-4 sm:py-3">
                                <span className="flex items-center justify-start gap-2">
                                  Created
                                </span>
                              </TableHead>
                              <TableHead className="w-[80px] text-right px-2 py-2 text-xs sm:text-sm sm:px-4 sm:py-3">
                                Actions
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {clientsLoading ? (
                              <TableRow>
                                <TableCell
                                  colSpan={4}
                                  className="text-center py-8 px-2 text-xs sm:text-sm sm:px-4"
                                >
                                  Loading clients...
                                </TableCell>
                              </TableRow>
                            ) : clientsError ? (
                              <TableRow>
                                <TableCell
                                  colSpan={4}
                                  className="text-center py-8 px-2 text-xs sm:text-sm sm:px-4 text-destructive"
                                >
                                  {clientsError}
                                </TableCell>
                              </TableRow>
                            ) : clients.length === 0 ? (
                              <TableRow>
                                <TableCell
                                  colSpan={4}
                                  className="text-center text-muted-foreground py-16 px-2 text-xs sm:text-sm sm:px-4"
                                >
                                  No clients found.
                                </TableCell>
                              </TableRow>
                            ) : (
                              clients.map((client) => (
                                <TableRow
                                  key={client.id}
                                  className="group transition-colors hover:bg-accent/30 cursor-pointer"
                                >
                                  <TableCell className="align-middle text-left px-2 py-2 text-xs sm:text-sm sm:px-4 sm:py-3">
                                    <div className="flex items-center gap-3">
                                      {renderAvatar(client.avatar, client.name)}
                                      <div>
                                        <p className="font-medium text-sm sm:text-base">
                                          {client.name}
                                        </p>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="align-middle text-left px-2 py-2 text-xs sm:text-sm sm:px-4 sm:py-3 break-all">
                                    {client.email}
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm align-middle text-left px-2 py-2 text-xs sm:text-sm sm:px-4 sm:py-3">
                                    {new Date(
                                      client.created_at
                                    ).toLocaleDateString()}
                                  </TableCell>
                                  <TableCell className="text-right align-middle px-2 py-2 text-xs sm:text-sm sm:px-4 sm:py-3">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-xs"
                                      onClick={() =>
                                        handleViewDashboardAs(client.id)
                                      }
                                    >
                                      View Dashboard as
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>

                    <TabsContent value="3d-editor" className="space-y-6">
                      <div className="space-y-4">
                        <div className="text-center">
                          <h3 className="text-lg font-semibold mb-2">
                            3D Editor Access
                          </h3>
                          <p className="text-sm text-muted-foreground mb-6">
                            Quick access to 3D editor clients
                          </p>
                        </div>

                        {/* Editor Theme Settings */}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="border rounded-lg p-4 hover:bg-accent/30 transition-colors">
                            <div className="flex items-center gap-3 mb-3">
                              <Box className="w-5 h-5 text-primary" />
                              <h4 className="font-medium">ArtwoodTest</h4>
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">
                              Access the ArtwoodTest 3D editor environment
                            </p>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleOpenEditor("ArtwoodTest")}
                                className="flex-1"
                              >
                                Open Editor
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewDemo("ArtwoodTest")}
                                className="flex-1"
                              >
                                View Demo
                              </Button>
                            </div>
                          </div>

                          <div className="border rounded-lg p-4 hover:bg-accent/30 transition-colors">
                            <div className="flex items-center gap-3 mb-3">
                              <Box className="w-5 h-5 text-primary" />
                              <h4 className="font-medium">SweefV2</h4>
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">
                              Access the SweefV2 3D editor environment
                            </p>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleOpenEditor("SweefV2")}
                                className="flex-1"
                              >
                                Open Editor
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewDemo("SweefV2")}
                                className="flex-1"
                              >
                                View Demo
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  </>
                )}
              </div>
            </Tabs>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-current" />
                Loading...
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Move EditUserDialog outside of SettingsDialog */}
      {userPermissions.edit_user && (
        <Dialog
          open={isEditUserDialogOpen}
          onOpenChange={setIsEditUserDialogOpen}
        >
          <EditUserDialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
            </DialogHeader>
            {editingUser && (
              <UserForm
                onSubmit={handleEditUser}
                isLoading={isProcessing}
                initialData={{
                  name: editingUser.name,
                  email: editingUser.email,
                  role: editingUser.role as "admin" | "client" | "user",
                  password: "",
                }}
              />
            )}
          </EditUserDialogContent>
        </Dialog>
      )}

      <Toaster />
    </>
  );
}
