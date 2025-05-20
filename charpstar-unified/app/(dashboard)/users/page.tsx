"use client";

import { useEffect, useState } from "react";
import { UserPlus, Search, Pencil, MoreVertical, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UserForm, UserFormValues } from "@/app/components/UserForm";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { usePagePermission } from "@/lib/usePagePermission";
import { useUsers } from "@/lib/useUsers";
import { useFeaturePermissions } from "@/lib/useFeaturePermissions";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
}

const roleOptions = ["all", "admin", "client", "user"] as const;

export default function UsersPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | undefined>();
  const { users, loading: usersLoading, error, fetchUsers } = useUsers(true);

  // Add feature permissions check
  const {
    getFeaturePermissions,
    loading: featureLoading,
    permissions,
  } = useFeaturePermissions(true);
  const userPermissions = getFeaturePermissions(userRole, [
    "view_user_details",
    "edit_user",
    "add_user",
    "delete_user",
  ]);

  // Debug logs
  console.log("Current user role:", userRole);
  console.log("Feature permissions:", permissions);
  console.log("User permissions:", userPermissions);

  // Add permission check
  const {
    hasAccess,
    loading: permissionLoading,
    error: permissionError,
  } = usePagePermission(userRole, "/users");

  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
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
    fetchUsers();
  }, [fetchUsers]);

  // Show loading state while checking permissions or loading data
  if (permissionLoading || usersLoading || featureLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-t-blue-600 border-blue-200 rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show error message if permission check failed
  if (permissionError) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">
          Error checking permissions: {permissionError}
        </p>
      </div>
    );
  }

  // Show access denied if no permission
  if (!hasAccess) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-red-600 mb-2">
          Access Denied
        </h2>
        <p className="text-gray-600">
          You don't have permission to access the users page.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">Error loading users: {error}</p>
      </div>
    );
  }

  const handleAddUser = async (formData: UserFormValues) => {
    if (!userPermissions.add_user) {
      toast({
        title: "Error",
        description: "You don't have permission to add users",
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
        description: "You don't have permission to edit users",
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
        description: "You don't have permission to delete users",
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

  // Debug log for action permissions
  console.log("Has action permissions:", hasActionPermissions);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Users</h1>

        {userPermissions.add_user && (
          <Dialog
            open={isAddUserDialogOpen}
            onOpenChange={setIsAddUserDialogOpen}
          >
            <DialogTrigger asChild>
              <Button className="cursor-pointer bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800">
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
          <SelectTrigger className="w-[180px] cursor-pointer bg-white dark:bg-gray-900">
            <SelectValue placeholder="Select role" />
          </SelectTrigger>
          <SelectContent className="cursor-pointer bg-white dark:bg-gray-900">
            {roleOptions.map((role) => (
              <SelectItem key={role} value={role} className="cursor-pointer">
                {role === "all"
                  ? "All Roles"
                  : role.charAt(0).toUpperCase() + role.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Created At</TableHead>
              {hasActionPermissions && (
                <TableHead className="w-[100px] cursor-pointer  ">
                  Actions
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={hasActionPermissions ? 5 : 4}
                  className="text-center text-muted-foreground py-8"
                >
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant={user.role === "admin" ? "default" : "secondary"}
                    >
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  {hasActionPermissions && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4 cursor-pointer" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          className="bg-white dark:bg-gray-900"
                          align="end"
                        >
                          {userPermissions.edit_user && (
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={() => {
                                setEditingUser(user);
                                setIsEditUserDialogOpen(true);
                              }}
                            >
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit user
                            </DropdownMenuItem>
                          )}

                          {userPermissions.delete_user && (
                            <DropdownMenuItem
                              className="text-red-600 cursor-pointer"
                              onClick={() => handleDeleteUser(user.id)}
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

      {/* Edit User Dialog */}
      {userPermissions.edit_user && (
        <Dialog
          open={isEditUserDialogOpen}
          onOpenChange={setIsEditUserDialogOpen}
        >
          <DialogContent>
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
                  password: "", // Required by the type but not used in edit mode
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      )}

      <Toaster />
    </div>
  );
}
