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

// Helper to map backend role to UserForm role
const roleMap: Record<string, UserFormValues["role"]> = {
  admin: "Admin",
  user: "User",
  manager: "Manager",
  qa: "QA",
  qamanager: "QAmanager",
  modeler: "Modeler",
  modelermanager: "Modelermanager",
  client: "Client",
};

// Role badge color mapping (teal theme + distinct colors)
const roleBadgeClasses: Record<string, string> = {
  admin: "bg-red-700 text-white border-none", // admin - deep red
  manager: "bg-orange-600 text-white border-none", // manager - orange
  user: "bg-gray-200 text-gray-800 border-none", // user - neutral gray
  client: "bg-emerald-600 text-white border-none", // client - emerald
  qa: "bg-violet-500 text-white border-none", // qa - violet
  qamanager: "bg-purple-600 text-white border-none", // qa manager - purple
  modeler: "bg-cyan-500 text-white border-none", // modeler - cyan
  modelermanager: "bg-blue-600 text-white border-none", // modeler manager - blue
};

export default function UsersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");
  const [users, setUsers] = useState<User[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "name",
    direction: "asc",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const router = useRouter();
  const { data: session } = useSession();
  const { toast } = useToast();
  const role = session?.user?.role;
  const { hasAccess, loading: permLoading } = usePagePermission(role, "/users");

  // Debug log
  if (typeof window !== "undefined") {
    console.log("[DEBUG] session.user.role:", role);
    console.log("[DEBUG] hasAccess for /users:", hasAccess);
  }

  // Sort function
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

  // Filter function
  const filterData = (data: User[]) => {
    return data.filter(
      (user) =>
        (user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email.toLowerCase().includes(searchTerm.toLowerCase())) &&
        (selectedRole === "all" || user.role === selectedRole)
    );
  };

  // Handle sort
  const handleSort = (key: keyof User) => {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  // Get filtered and sorted data
  const filteredAndSortedUsers = sortData(filterData(users));

  const handleAddUser = async (formData: any) => {
    setIsAddingUser(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create user");
      }

      // Add the new user to the list
      setUsers((prevUsers) => [
        {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role,
        },
        ...prevUsers,
      ]);

      setIsAddUserDialogOpen(false);
      toast({
        title: "Success",
        description: "User created successfully",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to create user",
        variant: "destructive",
      });
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleEditUser = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (user) {
      setUserToEdit(user);
      setIsEditUserDialogOpen(true);
    }
  };

  const handleUpdateUser = async (formData: any) => {
    if (!userToEdit) return;
    try {
      // Update user info
      const { error: userError } = await supabase
        .from("users")
        .update({
          name: formData.name,
          email: formData.email,
        })
        .eq("id", userToEdit.id);
      if (userError) throw userError;

      // Update profile/role (convert to lowercase)
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ role: formData.role.toLowerCase() })
        .eq("user_id", userToEdit.id);
      if (profileError) throw profileError;

      // Update local state
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userToEdit.id
            ? {
                ...u,
                name: formData.name,
                email: formData.email,
                role: formData.role,
              }
            : u
        )
      );
      setIsEditUserDialogOpen(false);
      setUserToEdit(null);
      toast({
        title: "Success",
        description: "User updated successfully",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to update user. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    try {
      // First delete the profile
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("user_id", userToDelete.id);

      if (profileError) throw profileError;

      // Then delete the user
      const { error: userError } = await supabase
        .from("users")
        .delete()
        .eq("id", userToDelete.id);

      if (userError) throw userError;

      // Update the local state
      setUsers(users.filter((u) => u.id !== userToDelete.id));
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
    } catch (err) {
      console.error("Error deleting user:", err);
      toast({
        title: "Error",
        description: "Failed to delete user. Please try again.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (!role) return;
    async function fetchUsers() {
      try {
        // Fetch users with their roles using a join
        const { data: usersData, error: usersError } = await supabase
          .from("users")
          .select("id, name, email, profiles!profiles_user_id_fkey(role)")
          .order("created_at", { ascending: false });

        if (usersError) throw usersError;

        // Combine the data
        const transformedUsers: User[] = (usersData as any[]).map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: Array.isArray(user.profiles)
            ? user.profiles[0]?.role || "User"
            : user.profiles?.role || "User",
        }));

        setUsers(transformedUsers);
      } catch (err) {
        console.error("Error fetching users:", err);
        setError("Failed to load users");
      } finally {
        setIsLoading(false);
      }
    }
    fetchUsers();
  }, [hasAccess, router, role]);

  if (permLoading) {
    return (
      <div className="flex justify-center items-center h-64">Loading...</div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-destructive/10 text-destructive rounded-md">
        {error}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Users className="w-6 h-6" /> Users
        </h1>
        <Dialog
          open={isAddUserDialogOpen}
          onOpenChange={setIsAddUserDialogOpen}
        >
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Create a new user account with specified role and permissions.
              </DialogDescription>
            </DialogHeader>
            <UserForm onSubmit={handleAddUser} isLoading={isAddingUser} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          className="border rounded-md p-2"
        >
          {roleOptions.map((role) => (
            <option key={role} value={role}>
              {role === "all" ? "All Roles" : toTitleCase(role)}
            </option>
          ))}
        </select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort("name")}
              >
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Name
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort("email")}
              >
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort("role")}
              >
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Role
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center gap-2">
                  <MoreVertical className="w-4 h-4" />
                  Actions
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Badge
                    className={
                      roleBadgeClasses[user.role] ||
                      "bg-gray-200 text-teal-800 border-none"
                    }
                  >
                    {toTitleCase(user.role)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditUser(user.id)}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDeleteClick(user)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
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
            <DialogTitle className="flex items-center gap-2">
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
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isEditUserDialogOpen}
        onOpenChange={setIsEditUserDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and role.
            </DialogDescription>
          </DialogHeader>
          {userToEdit && (
            <UserForm
              onSubmit={handleUpdateUser}
              isLoading={false}
              defaultValues={{
                ...userToEdit,
                role: roleMap[userToEdit.role] || "User",
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
