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
  Eye,
  MapPin,
  Globe,
  Building,
  User,
  Link,
  CheckCircle,
  Loader2,
  AlertTriangle,
  Users,
  Briefcase,
  X,
  Upload,
  FileText,
  Download,
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
} from "@/components/ui/containers";
import { UserForm, UserFormValues } from "@/app/components/UserForm";
import { useToast } from "@/components/ui/utilities";
import { Toaster } from "@/components/ui/feedback";
import { Input } from "@/components/ui/inputs";
import { Label } from "@/components/ui/display";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs";
import { Badge, Alert, AlertDescription } from "@/components/ui/feedback";
import { Checkbox } from "@/components/ui/inputs/checkbox";
import { PhoneInput } from "@/components/ui/inputs/phone-input";
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
  getTimezoneFromCountry,
  getCurrentTimeInTimezone,
  getTimezoneDisplayName,
} from "@/lib/timezoneUtils";
import { getCountryNameByCode } from "@/lib/helpers";
import UserProfileDialog from "@/components/users/UserProfileDialog";
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
  name: string;
  email: string;
  role: string;
  created_at: string;
  country?: string | null;
  avatar?: string | null;
}

interface UserFormData {
  // Basic info
  email: string;
  firstName: string;
  lastName: string;
  role: "client" | "modeler" | "qa" | "admin";
  password: string;
  confirmPassword: string;

  // Client fields
  clientName: string;
  title: string;
  phoneNumber: string;

  // QA fields
  discordName: string;

  // Modeler fields
  softwareExperience: string[];
  modelTypes: string[];
  dailyHours: number;
  exclusiveWork: boolean;
  country: string;
  portfolioLinks: string[];
}

const roleOptions = ["all", "admin", "client", "user"] as const;

const SOFTWARE_OPTIONS = [
  "Blender",
  "Maya",
  "3ds Max",
  "Cinema 4D",
  "Houdini",
  "ZBrush",
  "Substance Painter",
  "Substance Designer",
  "Marvelous Designer",
  "SketchUp",
  "Rhino",
  "Fusion 360",
  "SolidWorks",
  "Other",
];

const MODEL_TYPE_OPTIONS = ["Hard Surface", "Soft Surface"];

interface FeaturePermissions {
  view_user_details: boolean;
  edit_user: boolean;
  add_user: boolean;
  delete_user: boolean;
}

export default function UsersPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | undefined>();
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
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

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // Comprehensive user creation state
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [formData, setFormData] = useState<UserFormData>({
    email: "",
    firstName: "",
    lastName: "",
    role: "client",
    password: "",
    confirmPassword: "",
    clientName: "",
    title: "",
    phoneNumber: "",
    discordName: "",
    softwareExperience: [],
    modelTypes: [],
    dailyHours: 8,
    exclusiveWork: false,
    country: "",
    portfolioLinks: [""],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] =
    useState<(typeof roleOptions)[number]>("all");

  // Profile dialog state
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);

  // Bulk CSV upload state
  const [isBulkUploadDialogOpen, setIsBulkUploadDialogOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [bulkResults, setBulkResults] = useState<{
    success: number;
    errors: string[];
  } | null>(null);

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
        setCurrentUserId(user.id);
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
                    <TableHead className="font-medium text-left">
                      User
                    </TableHead>
                    <TableHead className="font-medium text-left">
                      Role
                    </TableHead>
                    <TableHead className="font-medium hidden md:table-cell text-left">
                      Created
                    </TableHead>
                    <TableHead className="w-[80px] text-left">
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
                      <TableCell className="text-left">
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
                      <TableCell className="text-left">
                        <div className="inline-flex h-6 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-muted text-muted-foreground">
                          <div className="w-12 animate-pulse" />
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-left">
                        <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                      </TableCell>
                      <TableCell className="text-left">
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

  // Profile dialog functions
  const handleViewProfile = (userId: string) => {
    setSelectedUserId(userId);
    setIsProfileDialogOpen(true);
  };

  const handleCloseProfile = () => {
    setSelectedUserId(null);
    setIsProfileDialogOpen(false);
  };

  // Comprehensive user creation functions
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Basic validation
    if (!formData.email) newErrors.email = "Email is required";
    if (!formData.firstName) newErrors.firstName = "First name is required";
    if (!formData.lastName) newErrors.lastName = "Last name is required";
    if (!formData.password) newErrors.password = "Password is required";
    if (formData.password.length < 8)
      newErrors.password = "Password must be at least 8 characters";
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    // Role-specific validation
    switch (formData.role) {
      case "client":
        if (!formData.clientName)
          newErrors.clientName = "Client name is required";
        if (!formData.title) newErrors.title = "Job title is required";
        if (!formData.phoneNumber)
          newErrors.phoneNumber = "Phone number is required";
        break;
      case "qa":
        if (!formData.phoneNumber)
          newErrors.phoneNumber = "Phone number is required";
        if (!formData.discordName)
          newErrors.discordName = "Discord username is required";
        break;
      case "modeler":
        if (!formData.phoneNumber)
          newErrors.phoneNumber = "Phone number is required";
        if (!formData.country) newErrors.country = "Country is required";
        if (formData.softwareExperience.length === 0) {
          newErrors.softwareExperience =
            "At least one software experience is required";
        }
        if (formData.modelTypes.length === 0) {
          newErrors.modelTypes = "At least one model type is required";
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateUser = async () => {
    if (!validateForm()) {
      toast({
        title: "Error",
        description: "Please fix the errors before submitting",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingUser(true);
    try {
      const response = await fetch("/api/users/create-provisional", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create user");
      }

      toast({
        title: "Success",
        description:
          data.message ||
          `Successfully created ${formData.role} user: ${formData.email}`,
      });

      // Reset form
      setFormData({
        email: "",
        firstName: "",
        lastName: "",
        role: "client",
        password: "",
        confirmPassword: "",
        clientName: "",
        title: "",
        phoneNumber: "",
        discordName: "",
        softwareExperience: [],
        modelTypes: [],
        dailyHours: 8,
        exclusiveWork: false,
        country: "",
        portfolioLinks: [""],
      });
      setErrors({});
      setIsCreateUserDialogOpen(false);
      setShowConfirmDialog(false);
      await fetchUsers();
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive",
      });
    } finally {
      setIsCreatingUser(false);
    }
  };

  const updateFormData = (field: keyof UserFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const addPortfolioLink = () => {
    setFormData((prev) => ({
      ...prev,
      portfolioLinks: [...prev.portfolioLinks, ""],
    }));
  };

  const removePortfolioLink = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      portfolioLinks: prev.portfolioLinks.filter((_, i) => i !== index),
    }));
  };

  const updatePortfolioLink = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      portfolioLinks: prev.portfolioLinks.map((link, i) =>
        i === index ? value : link
      ),
    }));
  };

  const fillMockData = (role: "client" | "modeler" | "qa") => {
    const mockData = {
      client: {
        email: "john.smith@acmecorp.com",
        firstName: "John",
        lastName: "Smith",
        role: "client" as const,
        password: "password123",
        confirmPassword: "password123",
        clientName: "Acme Corporation",
        title: "Creative Director",
        phoneNumber: "+46701234567",
        discordName: "",
        softwareExperience: [],
        modelTypes: [],
        dailyHours: 8,
        exclusiveWork: false,
        country: "",
        portfolioLinks: [""],
      },
      modeler: {
        email: "sarah.johnson@freelance.com",
        firstName: "Sarah",
        lastName: "Johnson",
        role: "modeler" as const,
        password: "password123",
        confirmPassword: "password123",
        clientName: "",
        title: "",
        phoneNumber: "+46701234567",
        discordName: "sarah3d#5678",
        softwareExperience: ["Blender", "Maya", "Substance Painter", "ZBrush"],
        modelTypes: ["Hard Surface", "Soft Surface"],
        dailyHours: 6,
        exclusiveWork: true,
        country: "Sweden",
        portfolioLinks: [
          "https://artstation.com/sarahjohnson",
          "https://behance.net/sarahjohnson",
          "https://sketchfab.com/sarahjohnson",
        ],
      },
      qa: {
        email: "mike.chen@qualityassurance.com",
        firstName: "Mike",
        lastName: "Chen",
        role: "qa" as const,
        password: "password123",
        confirmPassword: "password123",
        clientName: "",
        title: "",
        phoneNumber: "+46701234567",
        discordName: "mikechen#1234",
        softwareExperience: [],
        modelTypes: [],
        dailyHours: 8,
        exclusiveWork: false,
        country: "",
        portfolioLinks: [""],
      },
    };

    setFormData(mockData[role]);
    setErrors({});
    toast({
      title: "Success",
      description: `Filled with mock ${role} data`,
    });
  };

  const clearForm = () => {
    setFormData({
      email: "",
      firstName: "",
      lastName: "",
      role: "client",
      password: "",
      confirmPassword: "",
      clientName: "",
      title: "",
      phoneNumber: "",
      discordName: "",
      softwareExperience: [],
      modelTypes: [],
      dailyHours: 8,
      exclusiveWork: false,
      country: "",
      portfolioLinks: [""],
    });
    setErrors({});
    toast({
      title: "Success",
      description: "Form cleared",
    });
  };

  // Bulk CSV upload functions
  const handleCsvFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "text/csv") {
      setCsvFile(file);
      setBulkResults(null);
    } else {
      toast({
        title: "Error",
        description: "Please select a valid CSV file",
        variant: "destructive",
      });
    }
  };

  const processBulkCsv = async () => {
    if (!csvFile) return;

    setIsProcessingBulk(true);
    setBulkResults(null);

    try {
      const csvText = await csvFile.text();
      const lines = csvText.split("\n").filter((line) => line.trim());

      if (lines.length < 2) {
        throw new Error("CSV must have at least a header row and one data row");
      }

      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const requiredHeaders = ["email", "clientname"];

      // Check if all required headers are present
      const missingHeaders = requiredHeaders.filter(
        (header) => !headers.includes(header)
      );
      if (missingHeaders.length > 0) {
        throw new Error(
          `Missing required headers: ${missingHeaders.join(", ")}`
        );
      }

      const results = {
        success: 0,
        errors: [] as string[],
      };

      // Process each row (skip header)
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        try {
          const values = line.split(",").map((v) => v.trim());
          if (values.length !== headers.length) {
            results.errors.push(`Row ${i + 1}: Column count mismatch`);
            continue;
          }

          // Create user data object
          const userData: UserFormData = {
            email: values[headers.indexOf("email")] || "",
            firstName: "Client", // Default first name
            lastName: "User", // Default last name
            role: "client",
            password: "TempPassword123!", // Default password for bulk uploads
            confirmPassword: "TempPassword123!",
            clientName: values[headers.indexOf("clientname")] || "",
            title: "Manager", // Default title
            phoneNumber: "", // Empty phone number
            discordName: "",
            softwareExperience: [],
            modelTypes: [],
            dailyHours: 8,
            exclusiveWork: false,
            country: "",
            portfolioLinks: [""],
          };

          // Validate required fields
          if (!userData.email || !userData.clientName) {
            results.errors.push(
              `Row ${i + 1}: Missing required fields (email or clientname)`
            );
            continue;
          }

          // Create user via API
          const response = await fetch("/api/users/create-provisional", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(userData),
          });

          if (response.ok) {
            results.success++;
          } else {
            const errorData = await response.json();
            results.errors.push(
              `Row ${i + 1}: ${errorData.error || "Failed to create user"}`
            );
          }
        } catch (error) {
          results.errors.push(
            `Row ${i + 1}: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }
      }

      setBulkResults(results);

      if (results.success > 0) {
        toast({
          title: "Bulk Upload Complete",
          description: `Successfully created ${results.success} users. ${results.errors.length} errors occurred.`,
        });
        await fetchUsers(); // Refresh the user list
      } else {
        toast({
          title: "Bulk Upload Failed",
          description: "No users were created. Check the error details.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error processing CSV:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to process CSV file",
        variant: "destructive",
      });
    } finally {
      setIsProcessingBulk(false);
    }
  };

  const downloadCsvTemplate = () => {
    const templateData = [
      "Email,ClientName",
      "john.smith@acmecorp.com,Acme Corporation",
      "jane.doe@techcorp.com,Tech Corp",
      "bob.wilson@designco.com,Design Co",
    ].join("\n");

    const blob = new Blob([templateData], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bulk-client-template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Template Downloaded",
      description: "CSV template downloaded successfully",
    });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "client":
        return <User className="h-5 w-5" />;
      case "modeler":
        return <Building className="h-5 w-5" />;
      case "qa":
        return <Shield className="h-5 w-5" />;
      case "admin":
        return <Users className="h-5 w-5" />;
      default:
        return <User className="h-5 w-5" />;
    }
  };

  const getRoleDescription = (role: string) => {
    switch (role) {
      case "client":
        return "Clients can browse models, create projects, and manage their assets";
      case "modeler":
        return "3D modelers create and upload 3D models with detailed specifications";
      case "qa":
        return "Quality assurance reviewers validate and approve 3D models";
      case "admin":
        return "Administrators have full system access and user management";
      default:
        return "";
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
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex justify-between items-center ">
        <h1 className="text-2xl font-bold">Users</h1>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsBulkUploadDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Bulk Upload
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsCreateUserDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Create User
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
                  <TableHead className="font-medium text-left">User</TableHead>
                  <TableHead className="font-medium text-left">Role</TableHead>
                  <TableHead className="font-medium text-left hidden md:table-cell">
                    Created
                  </TableHead>
                  {hasActionPermissions && (
                    <TableHead className="w-[80px] text-left">
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
                      <TableCell className="text-left">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border border-border ">
                            <AvatarImage
                              src={user.avatar || undefined}
                              alt={user.name}
                            />
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
                            {user.country && (
                              <div className="flex items-center gap-2 mt-1">
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <MapPin className="h-3 w-3" />
                                  {getCountryNameByCode(user.country)}
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Globe className="h-3 w-3" />
                                  <span
                                    title={getTimezoneDisplayName(
                                      getTimezoneFromCountry(user.country)
                                    )}
                                  >
                                    {getCurrentTimeInTimezone(
                                      getTimezoneFromCountry(user.country)
                                    )}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-left">
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
                      <TableCell className="hidden md:table-cell text-left text-muted-foreground">
                        {formatDate(user.created_at)}
                      </TableCell>
                      {(hasActionPermissions ||
                        userPermissions.view_user_details) && (
                        <TableCell className="text-left">
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
                              {userPermissions.view_user_details && (
                                <DropdownMenuItem
                                  className="cursor-pointer flex items-center"
                                  onClick={() => handleViewProfile(user.id)}
                                >
                                  <Eye className="w-4 h-4 mr-2" />
                                  View Profile
                                </DropdownMenuItem>
                              )}

                              {userPermissions.view_user_details &&
                                userPermissions.edit_user && (
                                  <DropdownMenuSeparator />
                                )}

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
        <Dialog
          open={isEditUserDialogOpen}
          onOpenChange={setIsEditUserDialogOpen}
        >
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
        </Dialog>
      )}

      {/* User Profile Dialog */}
      <UserProfileDialog
        isOpen={isProfileDialogOpen}
        onClose={handleCloseProfile}
        userId={selectedUserId}
        currentUserRole={userRole}
        currentUserId={currentUserId || ""}
      />

      {/* Comprehensive User Creation Dialog */}
      <Dialog
        open={isCreateUserDialogOpen}
        onOpenChange={setIsCreateUserDialogOpen}
      >
        <DialogContent className="w-[95vw] sm:w-full max-w-6xl h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-3 sm:pb-4">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <UserPlus className="h-4 w-4 sm:h-5 sm:w-5" />
              Create User
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 sm:space-y-6">
            {/* Basic Information */}
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
                <User className="h-3 w-3 sm:h-4 sm:w-4" />
                Basic Information
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2 block">
                    First Name *
                  </Label>
                  <Input
                    value={formData.firstName}
                    onChange={(e) =>
                      updateFormData("firstName", e.target.value)
                    }
                    placeholder="John"
                    className={`text-sm sm:text-base ${errors.firstName ? "border-red-500" : ""}`}
                  />
                  {errors.firstName && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.firstName}
                    </p>
                  )}
                </div>

                <div>
                  <Label className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2 block">
                    Last Name *
                  </Label>
                  <Input
                    value={formData.lastName}
                    onChange={(e) => updateFormData("lastName", e.target.value)}
                    placeholder="Doe"
                    className={`text-sm sm:text-base ${errors.lastName ? "border-red-500" : ""}`}
                  />
                  {errors.lastName && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.lastName}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2 block">
                  Email Address *
                </Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateFormData("email", e.target.value)}
                  placeholder="user@example.com"
                  className={`text-sm sm:text-base ${errors.email ? "border-red-500" : ""}`}
                />
                {errors.email && (
                  <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2 block">
                    Password *
                  </Label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => updateFormData("password", e.target.value)}
                    placeholder="••••••••"
                    className={`text-sm sm:text-base ${errors.password ? "border-red-500" : ""}`}
                  />
                  {errors.password && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.password}
                    </p>
                  )}
                </div>

                <div>
                  <Label className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2 block">
                    Confirm Password *
                  </Label>
                  <Input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      updateFormData("confirmPassword", e.target.value)
                    }
                    placeholder="••••••••"
                    className={`text-sm sm:text-base ${errors.confirmPassword ? "border-red-500" : ""}`}
                  />
                  {errors.confirmPassword && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.confirmPassword}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2 block">
                  Role *
                </Label>
                <Select
                  value={formData.role}
                  onValueChange={(
                    value: "client" | "modeler" | "qa" | "admin"
                  ) => updateFormData("role", value)}
                >
                  <SelectTrigger className="text-sm sm:text-base">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client">
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3 sm:h-4 sm:w-4" />
                        Client
                      </div>
                    </SelectItem>
                    <SelectItem value="modeler">
                      <div className="flex items-center gap-2">
                        <Building className="h-3 w-3 sm:h-4 sm:w-4" />
                        3D Modeler
                      </div>
                    </SelectItem>
                    <SelectItem value="qa">
                      <div className="flex items-center gap-2">
                        <Shield className="h-3 w-3 sm:h-4 sm:w-4" />
                        Quality Assurance
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                        Administrator
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {getRoleDescription(formData.role)}
                </p>
              </div>

              {/* Mock Data Buttons */}
              <div className="pt-2">
                <Label className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 sm:mb-3 block">
                  Quick Fill (Testing)
                </Label>
                <div className="grid grid-cols-2 sm:flex gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fillMockData("client")}
                    className="text-xs"
                  >
                    <User className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">Fill Client</span>
                    <span className="sm:hidden">Client</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fillMockData("modeler")}
                    className="text-xs"
                  >
                    <Building className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">Fill Modeler</span>
                    <span className="sm:hidden">Modeler</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fillMockData("qa")}
                    className="text-xs"
                  >
                    <Shield className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">Fill QA</span>
                    <span className="sm:hidden">QA</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearForm}
                    className="text-xs text-error hover:text-error/80 col-span-2 sm:col-span-1"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear Form
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Click any button to auto-fill the form with sample data for
                  testing
                </p>
              </div>
            </div>

            {/* Role-specific fields */}
            {formData.role === "client" && (
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
                  <Briefcase className="h-3 w-3 sm:h-4 sm:w-4" />
                  Client Information
                </h3>

                <div>
                  <Label className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2 block">
                    Client/Brand Name *
                  </Label>
                  <Input
                    value={formData.clientName}
                    onChange={(e) =>
                      updateFormData("clientName", e.target.value)
                    }
                    placeholder="Company Name"
                    className={`text-sm sm:text-base ${errors.clientName ? "border-red-500" : ""}`}
                  />
                  {errors.clientName && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.clientName}
                    </p>
                  )}
                </div>

                <div>
                  <Label className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2 block">
                    Job Title *
                  </Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => updateFormData("title", e.target.value)}
                    placeholder="e.g., Creative Director, Product Manager"
                    className={`text-sm sm:text-base ${errors.title ? "border-red-500" : ""}`}
                  />
                  {errors.title && (
                    <p className="text-red-500 text-xs mt-1">{errors.title}</p>
                  )}
                </div>

                <div>
                  <Label className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2 block">
                    Phone Number *
                  </Label>
                  <PhoneInput
                    value={formData.phoneNumber}
                    onChange={(value) =>
                      updateFormData("phoneNumber", value || "")
                    }
                    defaultCountry="SE"
                    className={`text-sm sm:text-base ${errors.phoneNumber ? "border-red-500" : ""}`}
                    placeholder="(xxx) xxx-xxxx"
                  />
                  {errors.phoneNumber && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.phoneNumber}
                    </p>
                  )}
                </div>
              </div>
            )}

            {formData.role === "qa" && (
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
                  <Shield className="h-3 w-3 sm:h-4 sm:w-4" />
                  QA Information
                </h3>

                <div>
                  <Label className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2 block">
                    Phone Number *
                  </Label>
                  <PhoneInput
                    value={formData.phoneNumber}
                    onChange={(value) =>
                      updateFormData("phoneNumber", value || "")
                    }
                    defaultCountry="SE"
                    className={`text-sm sm:text-base ${errors.phoneNumber ? "border-red-500" : ""}`}
                    placeholder="(xxx) xxx-xxxx"
                  />
                  {errors.phoneNumber && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.phoneNumber}
                    </p>
                  )}
                </div>

                <div>
                  <Label className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2 block">
                    Discord Username *
                  </Label>
                  <Input
                    value={formData.discordName}
                    onChange={(e) =>
                      updateFormData("discordName", e.target.value)
                    }
                    placeholder="username#1234"
                    className={`text-sm sm:text-base ${errors.discordName ? "border-red-500" : ""}`}
                  />
                  {errors.discordName && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.discordName}
                    </p>
                  )}
                </div>
              </div>
            )}

            {formData.role === "modeler" && (
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
                  <Building className="h-3 w-3 sm:h-4 sm:w-4" />
                  3D Modeler Information
                </h3>

                <div>
                  <Label className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2 block">
                    Phone Number *
                  </Label>
                  <PhoneInput
                    value={formData.phoneNumber}
                    onChange={(value) =>
                      updateFormData("phoneNumber", value || "")
                    }
                    defaultCountry="SE"
                    className={`text-sm sm:text-base ${errors.phoneNumber ? "border-red-500" : ""}`}
                    placeholder="(xxx) xxx-xxxx"
                  />
                  {errors.phoneNumber && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.phoneNumber}
                    </p>
                  )}
                </div>

                <div>
                  <Label className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2 block">
                    Country *
                  </Label>
                  <Input
                    value={formData.country}
                    onChange={(e) => updateFormData("country", e.target.value)}
                    placeholder="e.g., United States, Canada, UK"
                    className={`text-sm sm:text-base ${errors.country ? "border-red-500" : ""}`}
                  />
                  {errors.country && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.country}
                    </p>
                  )}
                </div>

                <div>
                  <Label className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 block">
                    Software Experience *
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {SOFTWARE_OPTIONS.map((software) => (
                      <div
                        key={software}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={software}
                          checked={formData.softwareExperience.includes(
                            software
                          )}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              updateFormData("softwareExperience", [
                                ...formData.softwareExperience,
                                software,
                              ]);
                            } else {
                              updateFormData(
                                "softwareExperience",
                                formData.softwareExperience.filter(
                                  (s) => s !== software
                                )
                              );
                            }
                          }}
                        />
                        <Label
                          htmlFor={software}
                          className="text-xs sm:text-sm cursor-pointer"
                        >
                          {software}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {errors.softwareExperience && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.softwareExperience}
                    </p>
                  )}
                </div>

                <div>
                  <Label className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 block">
                    Model Types *
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {MODEL_TYPE_OPTIONS.map((type) => (
                      <div key={type} className="flex items-center space-x-2">
                        <Checkbox
                          id={type}
                          checked={formData.modelTypes.includes(type)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              updateFormData("modelTypes", [
                                ...formData.modelTypes,
                                type,
                              ]);
                            } else {
                              updateFormData(
                                "modelTypes",
                                formData.modelTypes.filter((t) => t !== type)
                              );
                            }
                          }}
                        />
                        <Label
                          htmlFor={type}
                          className="text-xs sm:text-sm cursor-pointer"
                        >
                          {type}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {errors.modelTypes && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.modelTypes}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <Label className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 sm:mb-2 block">
                      Daily Hours Available
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      max="24"
                      value={formData.dailyHours}
                      onChange={(e) =>
                        updateFormData(
                          "dailyHours",
                          parseInt(e.target.value) || 8
                        )
                      }
                      placeholder="8"
                      className="text-sm sm:text-base"
                    />
                  </div>

                  <div className="flex items-center space-x-2 pt-6">
                    <Checkbox
                      id="exclusive"
                      checked={formData.exclusiveWork}
                      onCheckedChange={(checked) =>
                        updateFormData("exclusiveWork", !!checked)
                      }
                    />
                    <Label htmlFor="exclusive" className="text-xs sm:text-sm">
                      Available for exclusive work
                    </Label>
                  </div>
                </div>

                <div>
                  <Label className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 block">
                    Portfolio Links
                  </Label>
                  {formData.portfolioLinks.map((link, index) => (
                    <div
                      key={index}
                      className="flex flex-col sm:flex-row gap-2 mb-2"
                    >
                      <Input
                        value={link}
                        onChange={(e) =>
                          updatePortfolioLink(index, e.target.value)
                        }
                        placeholder="https://portfolio.example.com"
                        className="text-sm sm:text-base"
                      />
                      {formData.portfolioLinks.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removePortfolioLink(index)}
                          className="px-3 text-xs sm:text-sm w-full sm:w-auto"
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addPortfolioLink}
                    className="mt-2 text-xs sm:text-sm"
                  >
                    <Link className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    Add Portfolio Link
                  </Button>
                </div>
              </div>
            )}

            <div className="flex gap-3 sm:gap-4 pt-4 sm:pt-6">
              <Button
                onClick={() => {
                  const isValid = validateForm();
                  if (isValid) {
                    setShowConfirmDialog(true);
                  } else {
                    toast({
                      title: "Error",
                      description: "Please fix the errors before submitting",
                      variant: "destructive",
                    });
                  }
                }}
                disabled={isCreatingUser}
                className="flex-1 text-sm sm:text-base"
              >
                {isCreatingUser ? (
                  <>
                    <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 animate-spin" />
                    <span className="hidden sm:inline">Creating User...</span>
                    <span className="sm:hidden">Creating...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    Create User
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="w-[95vw] sm:w-full max-w-md h-fit overflow-y-auto">
          <DialogHeader className="pb-3 sm:pb-4">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />
              Confirm User Creation
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-4">
            <p className="text-xs sm:text-sm text-muted-foreground">
              Are you sure you want to create a new user with the following
              details?
            </p>

            <div className="space-y-2 text-xs sm:text-sm">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                <span className="font-medium">Name:</span>
                <span className="break-words">
                  {formData.firstName} {formData.lastName}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                <span className="font-medium">Email:</span>
                <span className="break-all">{formData.email}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                <span className="font-medium">Role:</span>
                <Badge variant="outline" className="text-xs w-fit">
                  {getRoleIcon(formData.role)}
                  {formData.role === "modeler"
                    ? "3D Modeler"
                    : formData.role === "qa"
                      ? "QA"
                      : formData.role.charAt(0).toUpperCase() +
                        formData.role.slice(1)}
                </Badge>
              </div>
              {formData.role === "client" && formData.clientName && (
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <span className="font-medium">Client:</span>
                  <span className="break-words">{formData.clientName}</span>
                </div>
              )}
            </div>

            <Alert>
              <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4" />
              <AlertDescription className="text-xs sm:text-sm">
                The user will be created immediately and can log in with the
                provided email and password.
              </AlertDescription>
            </Alert>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              className="w-full sm:w-auto text-sm sm:text-base"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateUser}
              disabled={isCreatingUser}
              className="w-full sm:w-auto text-sm sm:text-base"
            >
              {isCreatingUser ? (
                <>
                  <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  Create User
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Dialog */}
      <Dialog
        open={isBulkUploadDialogOpen}
        onOpenChange={setIsBulkUploadDialogOpen}
      >
        <DialogContent className="w-[95vw] sm:w-full max-w-2xl h-fit overflow-y-auto">
          <DialogHeader className="pb-3 sm:pb-4">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Upload className="h-4 w-4 sm:h-5 sm:w-5" />
              Bulk Upload Client Users
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 sm:space-y-6">
            <div className="space-y-3">
              <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
                <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
                CSV Upload
              </h3>

              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label className="text-sm font-medium text-muted-foreground">
                      Select CSV File
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Upload a CSV file with client user data. Only Email and
                      ClientName are required.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="bulk-csv-upload"
                      type="file"
                      accept=".csv"
                      onChange={handleCsvFileUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        document.getElementById("bulk-csv-upload")?.click()
                      }
                      className="flex items-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Choose CSV
                    </Button>
                    <Button
                      onClick={downloadCsvTemplate}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Template
                    </Button>
                  </div>
                </div>

                {csvFile && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {csvFile.name}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          ({(csvFile.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCsvFile(null)}
                        className="text-slate-500 hover:text-slate-700"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                )}

                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                    Required CSV Format
                  </h4>
                  <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                    <p>
                      <strong>Headers:</strong> Email, ClientName
                    </p>
                    <p>
                      <strong>Note:</strong> All users will be created with
                      default values: Name: &quot;Client User&quot;, Title:
                      &quot;Manager&quot;, Password:
                      &quot;TempPassword123!&quot;
                    </p>
                    <p>
                      <strong>Role:</strong> All users will be assigned the
                      &quot;client&quot; role
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {bulkResults && (
              <div className="space-y-3">
                <h3 className="text-base sm:text-lg font-semibold">
                  Upload Results
                </h3>
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-800 dark:text-green-200">
                        Success: {bulkResults.success} users created
                      </span>
                    </div>
                    {bulkResults.errors.length > 0 && (
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                        <span className="font-medium text-red-800 dark:text-red-200">
                          Errors: {bulkResults.errors.length}
                        </span>
                      </div>
                    )}
                  </div>

                  {bulkResults.errors.length > 0 && (
                    <div className="mt-3">
                      <h4 className="font-medium text-sm mb-2">
                        Error Details:
                      </h4>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {bulkResults.errors.map((error, index) => (
                          <p
                            key={index}
                            className="text-xs text-red-600 dark:text-red-400"
                          >
                            {error}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-3 sm:gap-4 pt-4 sm:pt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setIsBulkUploadDialogOpen(false);
                  setCsvFile(null);
                  setBulkResults(null);
                }}
                className="flex-1 text-sm sm:text-base"
              >
                Cancel
              </Button>
              <Button
                onClick={processBulkCsv}
                disabled={!csvFile || isProcessingBulk}
                className="flex-1 text-sm sm:text-base"
              >
                {isProcessingBulk ? (
                  <>
                    <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 animate-spin" />
                    <span className="hidden sm:inline">Processing...</span>
                    <span className="sm:hidden">Processing...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Upload Users</span>
                    <span className="sm:hidden">Upload</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}
