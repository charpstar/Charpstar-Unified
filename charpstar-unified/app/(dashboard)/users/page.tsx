"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ROLES, useHasPermission } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";
import {
  MoreVertical,
  Pencil,
  Trash2,
  Search,
  UserPlus,
  Plus,
  User,
  Mail,
  Shield,
  AlertCircle,
  Users,
} from "lucide-react";
import { UserForm } from "@/app/components/UserForm";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastAction,
  ToastDescription,
  ToastProvider,
  ToastViewport,
} from "@/components/ui/toast";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/components/ui/use-toast";
import type { UserFormValues } from "@/app/components/UserForm";
import { usePagePermission } from "@/lib/usePagePermission";
import { useFeaturePermission } from "@/lib/useFeaturePermission";
import { useUsers } from "@/lib/useUsers";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Add role options array for filtering
const roleOptions = [
  "all",
  "admin",
  "manager",
  "qa",
  "qamanager",
  "modeler",
  "modelermanager",
  "client",
  "user",
];

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface SortConfig {
  key: keyof User;
  direction: "asc" | "desc";
}

// Helper to convert role to title case for display
function toTitleCase(str: string) {
  if (!str) return str;
  if (str === "qamanager") return "QA Manager";
  if (str === "modelermanager") return "Modeler Manager";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Update roleMap and validUserFormRoles to exclude 'User'
const roleMap: Record<string, UserFormValues["role"]> = {
  admin: "Admin",
  manager: "Manager",
  qa: "QA",
  qamanager: "QAmanager",
  modeler: "Modeler",
  modelermanager: "Modelermanager",
  client: "Client",
};
const validUserFormRoles = [
  "Admin",
  "Manager",
  "QA",
  "QAmanager",
  "Modeler",
  "Modelermanager",
  "Client",
] as const;
function toUserFormRole(role: string): UserFormValues["role"] | undefined {
  const mapped = roleMap[role];
  return mapped && validUserFormRoles.includes(mapped as any)
    ? mapped
    : undefined;
}

// Role badge color mapping (teal theme + distinct colors)
const roleBadgeClasses: Record<string, string> = {
  admin: "bg-primary/80 text-primary-foreground border-none",
  manager: "bg-accent text-accent-foreground border-none",
  user: "bg-muted text-foreground border-none",
  client: "bg-primary/60 text-primary-foreground border-none",
  qa: "bg-accent/80 text-accent-foreground border-none",
  qamanager: "bg-accent/60 text-accent-foreground border-none",
  modeler: "bg-primary/60 text-primary-foreground border-none",
  modelermanager: "bg-primary/70 text-primary-foreground border-none",
};

export default function UsersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const { data: session } = useSession();
  const { toast } = useToast();
  const role = session?.user?.role;
  const { hasAccess, loading: permLoading } = usePagePermission(role, "/users");
  const { hasAccess: canAddUser, loading: addUserLoading } =
    useFeaturePermission(role, "add_user");
  const { hasAccess: canEditUser, loading: editUserLoading } =
    useFeaturePermission(role, "edit_user");
  const { hasAccess: canDeleteUser, loading: deleteUserLoading } =
    useFeaturePermission(role, "delete_user");

  // Use the new useUsers hook
  const {
    users,
    loading: isLoading,
    error,
    addUser,
    updateUser,
    deleteUser,
    refetch,
    isAddingUser,
    isDeletingUser,
    pendingUserId,
  } = useUsers(!!role && hasAccess);

  // Fetch users only when role and hasAccess are ready
  useEffect(() => {
    if (role && hasAccess) {
      refetch();
    }
  }, [role, hasAccess, refetch]);

  // Sort and filter logic
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "name",
    direction: "asc",
  });
  const sortData = (data: User[]) => {
    return [...data].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }
      return 0;
    });
  };
  const filterData = (data: User[]) => {
    return data.filter(
      (user) =>
        (user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email.toLowerCase().includes(searchTerm.toLowerCase())) &&
        (selectedRole === "all" || user.role === selectedRole)
    );
  };
  const handleSort = (key: keyof User) => {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };
  const filteredAndSortedUsers = sortData(filterData(users));

  if (permLoading || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-foreground bg-background">
        <div className="animate-spin h-10 w-10 rounded-full border-2 border-ring border-t-transparent" />
        <p className="mt-4 text-sm text-muted-foreground">
          {permLoading ? "Checking permissions..." : "Loading users..."}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[60vh] px-4">
        <div className="max-w-md w-full p-6 rounded-lg border border-destructive bg-destructive/10 text-destructive shadow-sm">
          <h2 className="text-lg font-semibold mb-2">Error</h2>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-background text-foreground">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold flex items-center gap-2 text-foreground">
          <Users className="w-6 h-6" /> Users
        </h1>
        {canAddUser && (
          <Dialog
            open={isAddUserDialogOpen}
            onOpenChange={setIsAddUserDialogOpen}
          >
            <DialogTrigger asChild>
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={addUserLoading}
              >
                <UserPlus className="w-4 h-4 mr-2 text-primary" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
                <DialogDescription>
                  Create a new user account with specified role and permissions.
                </DialogDescription>
                §
              </DialogHeader>
              <UserForm
                onSubmit={async (formData) => {
                  const result = await addUser(formData);
                  if (result.success) {
                    setIsAddUserDialogOpen(false);
                    toast({
                      title: "Success",
                      description: "User created successfully",
                    });
                  } else {
                    toast({
                      title: "Error",
                      description: result.error || "Failed to create user",
                      variant: "destructive",
                    });
                  }
                }}
                isLoading={isAddingUser}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-background text-foreground border border-border focus:ring-primary"
          />
        </div>
        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          className="border border-border rounded-md p-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {roleOptions.map((role) => (
            <option
              key={role}
              value={role}
              className="bg-background text-foreground"
            >
              {role === "all" ? "All Roles" : toTitleCase(role)}
            </option>
          ))}
        </select>
      </div>
      <div className="border border-border rounded-lg bg-card text-foreground">
        <Table>
          <TableHeader>
            <TableRow className="bg-card text-foreground">
              <TableHead className="bg-card text-foreground">Name</TableHead>
              <TableHead className="bg-card text-foreground">Email</TableHead>
              <TableHead className="bg-card text-foreground">Role</TableHead>
              <TableHead className="bg-card text-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedUsers.map((user) => (
              <TableRow className="bg-card text-foreground">
                <TableCell className="bg-card text-foreground">
                  {user.name}
                </TableCell>
                <TableCell className="bg-card text-foreground">
                  {user.email}
                </TableCell>
                <TableCell>
                  <Badge
                    className={
                      roleBadgeClasses[user.role] ||
                      "bg-muted text-foreground border-none"
                    }
                  >
                    {toTitleCase(user.role)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-primary bg-transparent"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-background">
                      <DropdownMenuItem
                        onClick={() => {
                          setUserToEdit(user);
                          setIsEditUserDialogOpen(true);
                        }}
                        disabled={
                          !canEditUser ||
                          editUserLoading ||
                          pendingUserId === user.id
                        }
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        {pendingUserId === user.id && (
                          <span className="animate-spin">⏳</span>
                        )}
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => {
                          setUserToDelete(user);
                          setIsDeleteDialogOpen(true);
                        }}
                        disabled={
                          !canDeleteUser ||
                          deleteUserLoading ||
                          pendingUserId === user.id
                        }
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {pendingUserId === user.id && (
                          <span className="animate-spin">⏳</span>
                        )}
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <AlertCircle className="w-5 h-5 text-destructive" />
              Confirm Deletion
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {userToDelete?.name}? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!userToDelete) return;
                const result = await deleteUser(userToDelete);
                if (result.success) {
                  setUserToDelete(null);
                  setIsDeleteDialogOpen(false);
                  toast({
                    title: "Success",
                    description: "User deleted successfully",
                  });
                } else {
                  toast({
                    title: "Error",
                    description: result.error || "Failed to delete user",
                    variant: "destructive",
                  });
                }
              }}
              disabled={isDeletingUser}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={isEditUserDialogOpen}
        onOpenChange={setIsEditUserDialogOpen}
      >
        <DialogContent className="bg-background [&_select]:bg-transparent">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and role.
            </DialogDescription>
          </DialogHeader>
          {userToEdit && (
            <UserForm
              onSubmit={async (formData) => {
                const result = await updateUser(userToEdit.id, formData);
                if (result.success) {
                  setIsEditUserDialogOpen(false);
                  setUserToEdit(null);
                  toast({
                    title: "Success",
                    description: "User updated successfully",
                  });
                } else {
                  toast({
                    title: "Error",
                    description: result.error || "Failed to update user",
                    variant: "destructive",
                  });
                }
              }}
              isLoading={false}
              defaultValues={{
                ...userToEdit,
                role: toUserFormRole(userToEdit.role),
              }}
              isEdit
            />
          )}
        </DialogContent>
      </Dialog>
      <Toaster />
    </div>
  );
}
