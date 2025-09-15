"use client";

import { useEffect, useState } from "react";
import {
  UserPlus,
  Search,
  Pencil,
  Trash2,
  MoreHorizontal,
  Shield,
  Mail,
  UserCog,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/display";
import { Button } from "@/components/ui/display";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/containers";
import { UserForm, UserFormValues } from "@/app/components/UserForm";
import { useToast } from "@/components/ui/utilities";
import { Toaster } from "@/components/ui/feedback";
import { Input } from "@/components/ui/inputs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs";
import { Badge } from "@/components/ui/feedback";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/interactive";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { usePagePermission } from "@/lib/usePagePermission";
import { useUsers } from "@/lib/useUsers";
import { useFeaturePermissions } from "@/lib/useFeaturePermissions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/display";
import { EditUserDialogContent } from "@/components/ui/containers";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
}

const roleOptions = ["all", "admin", "client", "user"] as const;

interface FeaturePermissions {
  view_user_details: boolean;
  edit_user: boolean;
  add_user: boolean;
  delete_user: boolean;
}

export default function UsersPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | undefined>();
  const { users, loading: usersLoading, error, fetchUsers } = useUsers(true);

  // Add feature permissions check
  const {
    getFeaturePermissions,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    loading: featureLoading,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    permissions,
  } = useFeaturePermissions(true);
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

  // Add permission check
  const {
    hasAccess,
    loading: permissionLoading,
    error: permissionError,
  } = usePagePermission(userRole, "/users");

  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] =
    useState<(typeof roleOptions)[number]>("all");

  useEffect(() => {
    const fetchUserRole = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile) {
        setUserRole(profile.role);
      }
    };

    fetchUserRole();
  }, [router]);

  useEffect(() => {
    // Only fetch users if we have permission
    if (hasAccess) {
      fetchUsers();
    }
  }, [fetchUsers, hasAccess]);

  const isInitialLoading = permissionLoading || usersLoading || !userRole;

  // Show loading state while checking permissions or loading data
  if (isInitialLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Users</h1>
          <Button variant="default" disabled>
            <UserPlus className="w-4 h-4 mr-2" />
            Add User
          </Button>
        </div>

        <div className="flex gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by name or email..."
              className="pl-9"
              disabled
            />
          </div>
          <Select disabled>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
          </Select>
        </div>

        <Card className="border border-border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl font-semibold">
              User Management
            </CardTitle>
            <CardDescription>View and manage system users</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-medium">User</TableHead>
                    <TableHead className="font-medium">Role</TableHead>
                    <TableHead className="font-medium hidden md:table-cell">
                      Created
                    </TableHead>
                    <TableHead className="w-[80px] text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow
                      key={i}
                      className="group transition-colors hover:bg-accent/30"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
                          <div>
                            <div className="h-4 w-32 bg-muted rounded animate-pulse mb-1" />
                            <div className="flex items-center text-sm text-muted-foreground">
                              <Mail className="mr-1 h-3 w-3" />
                              <div className="h-3 w-40 bg-muted rounded animate-pulse" />
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="inline-flex h-6 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-muted text-muted-foreground">
                          <div className="w-12 animate-pulse" />
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          disabled
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error message if permission check failed
  if (permissionError) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Users</h1>
        </div>
        <Card className="border-destructive">
          <CardHeader>
            <CardDescription>
              An error occurred while checking permissions: {permissionError}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Show access denied if no permission
  if (!hasAccess) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Users</h1>
        </div>
        <Card className="border-destructive">
          <CardHeader>
            <CardDescription>
              You don&apos;t have permission to access the users page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Show error message if users loading failed
  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Users</h1>
        </div>
        <Card className="border-destructive">
          <CardHeader>
            <CardDescription>Error loading users: {error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleAddUser = async (formData: UserFormValues) => {
    if (!userPermissions.add_user) {
      toast({
        title: "Error",
        description: "You don&apos;t have permission to add users",
        variant: "destructive",
      });
      return;
    }

    setIsAddingUser(true);
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
      setIsAddingUser(false);
    }
  };

  const handleEditUser = async (formData: UserFormValues) => {
    if (!userPermissions.edit_user) {
      toast({
        title: "Error",
        description: "You don&apos;t have permission to edit users",
        variant: "destructive",
      });
      return;
    }

    if (!editingUser) return;
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/users/${editingUser.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update user");
      }

      await fetchUsers();
      setIsEditUserDialogOpen(false);
      setEditingUser(null);
      toast({
        title: "Success",
        description: "User updated successfully",
      });
    } catch (err) {
      console.error("Error updating user:", err);
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to update user",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center ">
        <h1 className="text-2xl font-bold">Users</h1>

        <div className="flex gap-2">
          {userPermissions.add_user && (
            <Dialog
              open={isAddUserDialogOpen}
              onOpenChange={setIsAddUserDialogOpen}
            >
              <DialogTrigger asChild>
                <Button variant="default">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New User</DialogTitle>
                </DialogHeader>
                <UserForm onSubmit={handleAddUser} isLoading={isAddingUser} />
              </DialogContent>
            </Dialog>
          )}

          <Button
            variant="outline"
            onClick={() => router.push("/create-users")}
            className="flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Create User (Provisional)
          </Button>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={selectedRole}
          onValueChange={(value: (typeof roleOptions)[number]) =>
            setSelectedRole(value)
          }
        >
          <SelectTrigger className="w-[180px] cursor-pointer bg-background dark:bg-background text-muted-foreground">
            <SelectValue placeholder="Select role" />
          </SelectTrigger>
          <SelectContent className="cursor-pointer bg-background dark:bg-background text-muted-foreground">
            {roleOptions.map((role) => (
              <SelectItem
                key={role}
                value={role}
                className="cursor-pointer bg-background dark:bg-background text-muted-foreground hover:bg-muted-foreground/10 hover:text-muted-foreground"
              >
                {role === "all"
                  ? "All Roles"
                  : role.charAt(0).toUpperCase() + role.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="border border-border bg-card shadow-sm">
        <CardContent className="p-0">
          <div className="rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-medium">User</TableHead>
                  <TableHead className="font-medium">Role</TableHead>
                  <TableHead className="font-medium hidden md:table-cell">
                    Created
                  </TableHead>
                  {hasActionPermissions && (
                    <TableHead className="w-[80px] text-right">
                      Actions
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={hasActionPermissions ? 4 : 3}
                      className="text-center text-muted-foreground py-16"
                    >
                      <div className="flex flex-col items-center justify-center gap-2">
                        <UserCog className="h-12 w-12 text-muted-foreground/50" />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow
                      key={user.id}
                      className="group transition-colors hover:bg-accent/30"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border border-border">
                            <AvatarImage src={user.avatar} alt={user.name} />
                            <AvatarFallback className="bg-primary/10 text-muted-foreground">
                              {getInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-sm text-muted-foreground flex items-center">
                              <Mail className="mr-1 h-3 w-3" />
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
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
                          >
                            {user.role.charAt(0).toUpperCase() +
                              user.role.slice(1)}
                          </Badge>
                          {user.role === "admin" && (
                            <Shield className="h-3 w-3 text-primary" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {formatDate(user.created_at)}
                      </TableCell>
                      {hasActionPermissions && (
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className={"h-8 w-8 p-0  "}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Open menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="bg-white dark:bg-background"
                            >
                              {userPermissions.edit_user && (
                                <DropdownMenuItem
                                  className="cursor-pointer flex items-center"
                                  onClick={() => {
                                    setEditingUser(user);
                                    setIsEditUserDialogOpen(true);
                                  }}
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
                                  className="cursor-pointer text-destructive focus:text-destructive flex items-center hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => handleDeleteUser(user.id)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2 " />
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
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      {userPermissions.edit_user && (
        <EditUserDialogContent>
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
      )}

      <Toaster />
    </div>
  );
}
