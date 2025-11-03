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
  Plus,
  Clock,
  AlertCircle,
  Copy,
  ArrowRight,
  Building2,
  Edit,
  ChevronDown,
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
import { Textarea } from "@/components/ui/inputs";
import { Switch } from "@/components/ui/inputs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/interactive";
import { DatePicker } from "@/components/ui/utilities";
import { useUser } from "@/contexts/useUser";
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
import { EditCompaniesDialog } from "@/components/users/EditCompaniesDialog";
import { AllowedRolesManager } from "@/components/users/AllowedRolesManager";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/display/tooltip";
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

interface Client {
  id: string;
  email: string;
  role: string;
  client: string[] | null;
  created_at: string;
  onboardingAssetsCount: number;
  assetsCount: number;
  totalAssetsCount: number;
}

interface Company {
  id: string;
  name: string;
  company: string;
  contract_type: "standard" | "premium" | "enterprise" | "custom";
  contract_value: number;
  models_in_contract?: number | null;
  change_percentage?: number | null;
  payment_terms: string;
  start_date: string;
  end_date: string | null;
  status: "active" | "inactive" | "pending";
  specifications: string;
  requirements: string;
  notes: string;
  client_guide?: string | null;
  client_guide_links?: string[] | null;
  viewer_type?: "v6_aces" | "v5_tester" | "synsam" | "v2" | null;
  bunny_custom_structure?: boolean | null;
  bunny_custom_url?: string | null;
  bunny_custom_access_key?: string | null;
  created_at: string;
  updated_at: string;
  isPlaceholder?: boolean;
}

interface CompanyFormData {
  name: string;
  company: string;
  contract_type: "standard" | "premium" | "enterprise" | "custom";
  contract_value: number;
  models_in_contract?: number;
  change_percentage?: number;
  payment_terms: string;
  start_date: string;
  status: "active" | "inactive";
  specifications: string;
  requirements: string;
  notes: string;
  client_guide?: string;
  client_guide_links?: string[];
  viewer_type?: "v6_aces" | "v5_tester" | "synsam" | "v2" | null;
  bunny_custom_structure?: boolean;
  bunny_custom_url?: string;
  bunny_custom_access_key?: string;
}

interface CompanyAssetCount {
  [companyName: string]: {
    onboarding: number;
    production: number;
    total: number;
  };
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
  clientNames: string[]; // Changed to array for multiple companies
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

const roleOptions = [
  "all",
  "admin",
  "manager",
  "user",
  "qa",
  "qamanager",
  "modeler",
  "modelermanager",
  "client",
] as const;

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
    clientNames: [""], // Changed to array for multiple companies - start with one empty field
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

  // Edit companies dialog state
  const [isEditCompaniesDialogOpen, setIsEditCompaniesDialogOpen] =
    useState(false);
  const [editCompaniesUserId, setEditCompaniesUserId] = useState<string>("");
  const [editCompaniesUserEmail, setEditCompaniesUserEmail] =
    useState<string>("");

  // Bulk CSV upload state
  const [isBulkUploadDialogOpen, setIsBulkUploadDialogOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [bulkResults, setBulkResults] = useState<{
    success: number;
    errors: string[];
  } | null>(null);

  // Invitation state
  const [isInvitationDialogOpen, setIsInvitationDialogOpen] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [newInviteData, setNewInviteData] = useState({
    email: "",
    client_name: "",
    role: "client",
    onboarding: true,
  });
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    invitation: Invitation | null;
  }>({ open: false, invitation: null });
  const [clearHistoryDialog, setClearHistoryDialog] = useState(false);

  // Client view state
  const [viewType, setViewType] = useState<"all" | "companies">("all");
  const [clients, setClients] = useState<Client[]>([]);
  const [totalOnboardingAssets, setTotalOnboardingAssets] = useState(0);
  const [totalProductionAssets, setTotalProductionAssets] = useState(0);

  // Company view state
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<Company[]>([]);
  const [companySearchTerm, setCompanySearchTerm] = useState("");
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isEditCompanyDialogOpen, setIsEditCompanyDialogOpen] = useState(false);
  const [isViewCompanyDialogOpen, setIsViewCompanyDialogOpen] = useState(false);
  const [isAddCompanyDialogOpen, setIsAddCompanyDialogOpen] = useState(false);
  const [companyAssetCounts, setCompanyAssetCounts] =
    useState<CompanyAssetCount>({});
  const [companyFormData, setCompanyFormData] = useState<CompanyFormData>({
    name: "",
    company: "",
    contract_type: "standard",
    contract_value: 0,
    models_in_contract: 0,
    change_percentage: 0,
    payment_terms: "",
    start_date: "",
    status: "active",
    specifications: "",
    requirements: "",
    notes: "",
    client_guide: "",
    client_guide_links: [],
    viewer_type: null,
    bunny_custom_structure: false,
    bunny_custom_url: "",
    bunny_custom_access_key: "",
  });

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

  // Fetch invitations
  const fetchInvitations = async () => {
    setLoadingInvitations(true);
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
      setLoadingInvitations(false);
    }
  };

  // Fetch invitations when dialog opens
  useEffect(() => {
    if (isInvitationDialogOpen && userRole === "admin") {
      fetchInvitations();
    }
  }, [isInvitationDialogOpen, userRole]);

  // Fetch clients
  const fetchClients = async () => {
    try {
      const response = await fetch("/api/production/client-users");
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch clients");
      }

      setClients(result.clients || []);

      // Set totals from API response
      if (result.totals) {
        setTotalOnboardingAssets(result.totals.onboarding);
        setTotalProductionAssets(result.totals.production);
      }
    } catch (error: any) {
      console.error("Error fetching clients:", error);
      toast({
        title: "Error",
        description: "Failed to fetch clients",
        variant: "destructive",
      });
    }
  };

  const handleClientSelect = (client: Client) => {
    router.push(`/production/onboard-client?clientId=${client.id}`);
  };

  // Company functions
  const fetchCompanyAssetCounts = async (companyNames: string[]) => {
    try {
      const counts: CompanyAssetCount = {};

      const { data: onboardingData, error: onboardingError } = await supabase
        .from("onboarding_assets")
        .select("client, transferred")
        .in("client", companyNames);

      if (onboardingError) throw onboardingError;

      const { data: assetsData, error: assetsError } = await supabase
        .from("assets")
        .select("client, active")
        .in("client", companyNames);

      if (assetsError) throw assetsError;

      companyNames.forEach((name) => {
        const onboardingCount =
          onboardingData?.filter(
            (item) =>
              item.client === name &&
              (item.transferred === false || item.transferred === null)
          ).length || 0;

        const productionCount =
          assetsData?.filter(
            (item) =>
              item.client === name &&
              (item.active === true || item.active === null)
          ).length || 0;

        counts[name] = {
          onboarding: onboardingCount,
          production: productionCount,
          total: onboardingCount + productionCount,
        };
      });

      return counts;
    } catch (error) {
      console.error("Error fetching asset counts:", error);
      return {};
    }
  };

  const fetchCompanies = async () => {
    try {
      setLoadingCompanies(true);
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      const existingCompanies = data || [];

      // Collect company names referenced elsewhere
      const [profilesRes, assetsRes] = await Promise.all([
        supabase.from("profiles").select("client").eq("role", "client"),
        supabase.from("onboarding_assets").select("client"),
      ]);

      const referencedNames = new Set<string>();
      existingCompanies.forEach((c) => c.name && referencedNames.add(c.name));

      if (!profilesRes.error && profilesRes.data) {
        profilesRes.data.forEach((r: any) => {
          if (Array.isArray(r.client)) {
            r.client
              .filter((x: string) => x && x.trim().length > 0)
              .forEach((n: string) => referencedNames.add(n));
          } else if (
            typeof r.client === "string" &&
            r.client.trim().length > 0
          ) {
            referencedNames.add(r.client);
          }
        });
      }
      if (!assetsRes.error && assetsRes.data) {
        assetsRes.data
          .map((r: any) => r.client)
          .filter((x: any) => typeof x === "string" && x.trim().length > 0)
          .forEach((n: string) => referencedNames.add(n));
      }

      // Create placeholder entries for companies without a row in clients table
      const existingNames = new Set(existingCompanies.map((c) => c.name));
      const placeholders: Company[] = Array.from(referencedNames)
        .filter((n) => !existingNames.has(n))
        .map((name) => ({
          id: `placeholder-${name}`,
          name,
          email: "",
          company: "",
          contract_type: "standard",
          contract_value: 0,
          models_in_contract: null,
          payment_terms: "",
          start_date: "",
          end_date: null,
          status: "pending",
          specifications: "",
          requirements: "",
          notes: "",
          client_guide: null,
          client_guide_links: [],
          viewer_type: null,
          bunny_custom_structure: null,
          bunny_custom_url: null,
          bunny_custom_access_key: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          isPlaceholder: true,
        }));

      const merged = [...existingCompanies, ...placeholders].sort((a, b) =>
        a.name.localeCompare(b.name)
      );

      setCompanies(merged);

      // Fetch asset counts for all companies
      const companyNames = merged.map((c) => c.name);
      const counts = await fetchCompanyAssetCounts(companyNames);
      setCompanyAssetCounts(counts);

      // Calculate totals for summary cards
      let totalOnboarding = 0;
      let totalProduction = 0;
      Object.values(counts).forEach((count) => {
        totalOnboarding += count.onboarding;
        totalProduction += count.production;
      });
      setTotalOnboardingAssets(totalOnboarding);
      setTotalProductionAssets(totalProduction);
    } catch (error) {
      console.error("Error fetching companies:", error);
      toast({
        title: "Error",
        description: "Failed to fetch companies",
        variant: "destructive",
      });
    } finally {
      setLoadingCompanies(false);
    }
  };

  // Fetch companies when switching to companies view
  useEffect(() => {
    if (
      viewType === "companies" &&
      (userRole === "admin" || userRole === "production")
    ) {
      fetchCompanies();
      // Also fetch clients to enable onboarding functionality
      fetchClients();
    }
  }, [viewType, userRole]);

  // Filter companies based on search term
  useEffect(() => {
    if (viewType === "companies") {
      const filtered = companies.filter(
        (company) =>
          company.name
            .toLowerCase()
            .includes(companySearchTerm.toLowerCase()) ||
          company.company
            .toLowerCase()
            .includes(companySearchTerm.toLowerCase())
      );
      setFilteredCompanies(filtered);
    }
  }, [companies, companySearchTerm, viewType]);

  const handleEditCompany = (company: Company) => {
    setSelectedCompany(company);
    setCompanyFormData({
      name: company.name,
      company: company.company,
      contract_type: company.contract_type,
      contract_value: company.contract_value,
      models_in_contract: company.models_in_contract || 0,
      change_percentage: company.change_percentage || 0,
      payment_terms: company.payment_terms,
      start_date: company.start_date,
      status: company.status === "inactive" ? "inactive" : "active",
      specifications: company.specifications,
      requirements: company.requirements,
      notes: company.notes,
      client_guide: company.client_guide || "",
      client_guide_links: company.client_guide_links || [],
      viewer_type: company.viewer_type || null,
      bunny_custom_structure: company.bunny_custom_structure || false,
      bunny_custom_url: company.bunny_custom_url || "",
      bunny_custom_access_key: company.bunny_custom_access_key || "",
    });
    setIsEditCompanyDialogOpen(true);
  };

  const handleViewCompany = (company: Company) => {
    setSelectedCompany(company);
    setIsViewCompanyDialogOpen(true);
  };

  const handleAddCompany = () => {
    setCompanyFormData({
      name: "",
      company: "",
      contract_type: "standard",
      contract_value: 0,
      models_in_contract: 0,
      change_percentage: 0,
      payment_terms: "",
      start_date: "",
      status: "active",
      specifications: "",
      requirements: "",
      notes: "",
      client_guide: "",
      client_guide_links: [],
      viewer_type: null,
      bunny_custom_structure: false,
      bunny_custom_url: "",
      bunny_custom_access_key: "",
    });
    setIsAddCompanyDialogOpen(true);
  };

  const handleAddCompanyPrefill = (name: string) => {
    setCompanyFormData({
      name,
      company: "",
      contract_type: "standard",
      contract_value: 0,
      models_in_contract: 0,
      change_percentage: 0,
      payment_terms: "",
      start_date: "",
      status: "active",
      specifications: "",
      requirements: "",
      notes: "",
      client_guide: "",
      client_guide_links: [],
      viewer_type: null,
      bunny_custom_structure: false,
      bunny_custom_url: "",
      bunny_custom_access_key: "",
    });
    setIsAddCompanyDialogOpen(true);
  };

  const handleSubmitCompany = async (isEdit: boolean) => {
    try {
      const MAX_NUMERIC_10_2 = 99999999.99;
      if (
        companyFormData.contract_value < 0 ||
        Math.abs(companyFormData.contract_value) > MAX_NUMERIC_10_2
      ) {
        toast({
          title: "Contract value too large",
          description:
            "The amount must be between 0 and 99,999,999.99 to fit the database limit.",
          variant: "destructive",
        });
        return;
      }

      if (isEdit && selectedCompany) {
        const { error } = await supabase
          .from("clients")
          .update({
            ...companyFormData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", selectedCompany.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Company information updated successfully",
        });
      } else {
        const { error } = await supabase.from("clients").insert({
          ...companyFormData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (error) throw error;

        toast({
          title: "Success",
          description: "Company added successfully",
        });
      }

      setCompanyFormData({
        name: "",
        company: "",
        contract_type: "standard",
        contract_value: 0,
        models_in_contract: 0,
        change_percentage: 0,
        payment_terms: "",
        start_date: "",
        status: "active",
        specifications: "",
        requirements: "",
        notes: "",
        client_guide: "",
        client_guide_links: [],
        viewer_type: null,
        bunny_custom_structure: false,
        bunny_custom_url: "",
        bunny_custom_access_key: "",
      });
      setIsEditCompanyDialogOpen(false);
      setIsAddCompanyDialogOpen(false);
      setSelectedCompany(null);
      fetchCompanies();
    } catch (error: any) {
      console.error("Error saving company:", error);
      let errorMessage = "Failed to save company";
      if (error?.code === "23505") {
        if (error?.details?.includes("name")) {
          errorMessage = `A company with the name "${companyFormData.name}" already exists. Please use a different name.`;
        } else {
          errorMessage =
            "A company with this information already exists. Please check for duplicates.";
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const getCompanyStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
      case "inactive":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
    }
  };

  const getCompanyContractTypeColor = (type: string) => {
    switch (type) {
      case "premium":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400";
      case "enterprise":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
      case "custom":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
    }
  };

  const isInitialLoading = permissionLoading || usersLoading || !userRole;

  // Show loading state while checking permissions or loading data
  if (isInitialLoading) {
    return (
      <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
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
        if (!formData.clientNames || formData.clientNames.length === 0)
          newErrors.clientNames = "At least one client name is required";
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
        clientNames: [""],
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
        clientNames: ["Acme Corporation", "ACME Retail"], // Example with multiple companies
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
        clientNames: [],
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
        clientNames: [],
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
      clientNames: [""],
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
          const clientNameValue = values[headers.indexOf("clientname")] || "";
          const userData: UserFormData = {
            email: values[headers.indexOf("email")] || "",
            firstName: "Client", // Default first name
            lastName: "User", // Default last name
            role: "client",
            password: "TempPassword123!", // Default password for bulk uploads
            confirmPassword: "TempPassword123!",
            clientNames: clientNameValue ? [clientNameValue] : [""], // Convert to array
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
          if (!userData.email || !userData.clientNames[0]) {
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

  // Invitation functions
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
        setNewInviteData({
          email: "",
          client_name: "",
          role: "client",
          onboarding: true,
        });
        fetchInvitations();
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
        fetchInvitations();
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
        fetchInvitations();
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
        fetchInvitations();
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

  const formatInvitationDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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
          {userRole === "admin" && (
            <Button
              variant="outline"
              onClick={() => setIsInvitationDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <Mail className="w-4 h-4" />
              Invitations
            </Button>
          )}
          {viewType === "companies" && (
            <>
              {userRole === "admin" && (
                <Button
                  onClick={handleAddCompany}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Company
                </Button>
              )}
            </>
          )}
          {viewType === "all" && (
            <Button
              variant="outline"
              onClick={() => setIsCreateUserDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Create User
            </Button>
          )}
        </div>
      </div>

      {/* View Toggle Tabs */}
      {(userRole === "admin" || userRole === "production") && (
        <div className="flex gap-2 border-b">
          <button
            onClick={() => setViewType("all")}
            className={`px-4 py-2 font-medium transition-colors cursor-pointer ${
              viewType === "all"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All Users
          </button>
          <button
            onClick={() => setViewType("companies")}
            className={`px-4 py-2 font-medium transition-colors cursor-pointer ${
              viewType === "companies"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Companies
          </button>
        </div>
      )}

      {viewType === "companies" &&
      (userRole === "admin" || userRole === "production") ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border border-slate-200 dark:border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                    <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Unique Companies
                    </p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {filteredCompanies.length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 dark:border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                    <Building2 className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Onboarding Assets
                    </p>
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {totalOnboardingAssets.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 dark:border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                    <Plus className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Production Assets
                    </p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {totalProductionAssets.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Companies View */}
          <Card>
            <CardContent className="pt-4 sm:pt-6">
              <div className="flex gap-3 sm:gap-4 mb-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search companies by name, description, or email..."
                      value={companySearchTerm}
                      onChange={(e) => setCompanySearchTerm(e.target.value)}
                      className="pl-10 text-sm sm:text-base"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="text-lg sm:text-xl">
                Companies ({filteredCompanies.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              {loadingCompanies ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="ml-2">Loading companies...</span>
                </div>
              ) : filteredCompanies.length === 0 ? (
                <div className="text-center py-14">
                  <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    No companies found
                  </h3>
                  <p className="text-muted-foreground">
                    {companySearchTerm
                      ? "No companies match your search criteria"
                      : "No companies have been created yet"}
                  </p>
                </div>
              ) : (
                <TooltipProvider>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-left">
                            Company Name
                          </TableHead>
                          <TableHead className="text-left">
                            Description
                          </TableHead>
                          <TableHead className="text-left">Contract</TableHead>
                          <TableHead className="text-left">Value</TableHead>
                          <TableHead className="text-left">Models</TableHead>
                          <TableHead className="text-left">
                            Onboarding Assets
                          </TableHead>
                          <TableHead className="text-left">
                            Production Assets
                          </TableHead>
                          <TableHead className="text-left">
                            Total Assets
                          </TableHead>
                          <TableHead className="text-left">Status</TableHead>
                          <TableHead className="text-left">
                            Start Date
                          </TableHead>
                          <TableHead className="text-left">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCompanies.map((company) => {
                          const assetCount = companyAssetCounts[
                            company.name
                          ] || {
                            onboarding: 0,
                            production: 0,
                            total: 0,
                          };
                          return (
                            <TableRow key={company.id}>
                              <TableCell className="text-left">
                                <div>
                                  <div className="font-medium">
                                    {company.name}
                                  </div>
                                  {company.isPlaceholder && (
                                    <div className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                                      Please fill in info for this company
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-left">
                                {company.company || "-"}
                              </TableCell>
                              <TableCell className="text-left">
                                {company.isPlaceholder ? (
                                  "-"
                                ) : (
                                  <Badge
                                    className={getCompanyContractTypeColor(
                                      company.contract_type
                                    )}
                                  >
                                    {company.contract_type === "standard"
                                      ? "Small"
                                      : company.contract_type === "premium"
                                        ? "Medium"
                                        : company.contract_type === "enterprise"
                                          ? "Big"
                                          : "Custom"}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-left">
                                {company.isPlaceholder
                                  ? "-"
                                  : `€${company.contract_value.toLocaleString()}`}
                              </TableCell>
                              <TableCell className="text-left">
                                {company.isPlaceholder
                                  ? "-"
                                  : `${assetCount.total} / ${company.models_in_contract || 0}`}
                              </TableCell>
                              <TableCell className="text-left">
                                <div className="text-sm font-medium text-orange-600 dark:text-orange-400">
                                  {assetCount.onboarding}
                                </div>
                              </TableCell>
                              <TableCell className="text-left">
                                <div className="text-sm font-medium text-green-600 dark:text-green-400">
                                  {assetCount.production}
                                </div>
                              </TableCell>
                              <TableCell className="text-left">
                                <div className="text-sm font-bold text-foreground">
                                  {assetCount.total}
                                </div>
                              </TableCell>
                              <TableCell className="text-left">
                                {company.isPlaceholder ? (
                                  "-"
                                ) : (
                                  <Badge
                                    className={getCompanyStatusColor(
                                      company.status
                                    )}
                                  >
                                    {company.status.charAt(0).toUpperCase() +
                                      company.status.slice(1)}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-left">
                                {company.start_date
                                  ? new Date(
                                      company.start_date
                                    ).toLocaleDateString()
                                  : "-"}
                              </TableCell>
                              <TableCell className="text-left">
                                <div className="flex gap-1">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        onClick={() => {
                                          // Find a client user for this company to onboard
                                          const clientUser = clients.find(
                                            (c) =>
                                              Array.isArray(c.client)
                                                ? c.client.includes(
                                                    company.name
                                                  )
                                                : c.client === company.name
                                          );
                                          if (clientUser) {
                                            handleClientSelect(clientUser);
                                          } else {
                                            // Navigate with company name if no user found
                                            router.push(
                                              `/production/onboard-client?company=${encodeURIComponent(company.name)}`
                                            );
                                          }
                                        }}
                                        variant="outline"
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                      >
                                        <ArrowRight className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Onboard Assets</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  {company.isPlaceholder ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() =>
                                            handleAddCompanyPrefill(
                                              company.name
                                            )
                                          }
                                          className="h-8 w-8 p-0"
                                        >
                                          <Plus className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Add Company Information</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    userRole === "admin" && (
                                      <>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() =>
                                                handleViewCompany(company)
                                              }
                                              className="h-8 w-8 p-0"
                                            >
                                              <Eye className="h-4 w-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>View Company Details</p>
                                          </TooltipContent>
                                        </Tooltip>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() =>
                                                handleEditCompany(company)
                                              }
                                              className="h-8 w-8 p-0"
                                            >
                                              <Edit className="h-4 w-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Edit Company</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </>
                                    )
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </TooltipProvider>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          {/* All Users View */}
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
                {roleOptions.map((role) => {
                  const roleLabels: Record<string, string> = {
                    all: "All Roles",
                    admin: "Admin",
                    manager: "Manager",
                    user: "User",
                    qa: "QA",
                    qamanager: "QA Manager",
                    modeler: "Modeler",
                    modelermanager: "Modeler Manager",
                    client: "Client",
                  };
                  return (
                    <SelectItem
                      key={role}
                      value={role}
                      className="cursor-pointer bg-background dark:bg-background text-muted-foreground hover:bg-muted-foreground/10 hover:text-muted-foreground"
                    >
                      {roleLabels[role] || role}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <Card className="border border-border bg-card shadow-sm">
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
                                    <>
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
                                      {user.role === "client" && (
                                        <DropdownMenuItem
                                          className="cursor-pointer flex items-center"
                                          onClick={() => {
                                            setEditCompaniesUserId(user.id);
                                            setEditCompaniesUserEmail(
                                              user.email
                                            );
                                            setIsEditCompaniesDialogOpen(true);
                                          }}
                                        >
                                          <Building className="w-4 h-4 mr-2" />
                                          Edit Companies
                                        </DropdownMenuItem>
                                      )}
                                    </>
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
        </>
      )}

      {/* Edit User Dialog */}
      {userPermissions.edit_user && (
        <Dialog
          open={isEditUserDialogOpen}
          onOpenChange={setIsEditUserDialogOpen}
        >
          <EditUserDialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {editingUser && (
                <>
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

                  {/* Allowed Roles Manager - Only show for admins */}
                  {userRole === "admin" && (
                    <AllowedRolesManager
                      userId={editingUser.id}
                      currentRole={editingUser.role}
                      onUpdate={() => {
                        // Refresh user list after update
                        fetchUsers();
                      }}
                    />
                  )}
                </>
              )}
            </div>
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

      {/* Edit Companies Dialog */}
      <EditCompaniesDialog
        isOpen={isEditCompaniesDialogOpen}
        onClose={() => setIsEditCompaniesDialogOpen(false)}
        userId={editCompaniesUserId}
        userEmail={editCompaniesUserEmail}
        onSuccess={() => fetchUsers()}
      />

      {/* Comprehensive User Creation Dialog */}
      <Dialog
        open={isCreateUserDialogOpen}
        onOpenChange={setIsCreateUserDialogOpen}
      >
        <DialogContent className="w-[95vw] sm:w-full min-w-6xl h-[75vh] max-h-[90vh] overflow-y-auto">
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
                    Client/Brand Names *
                  </Label>
                  <div className="space-y-2">
                    {formData.clientNames.map((clientName, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={clientName}
                          onChange={(e) => {
                            const newClientNames = [...formData.clientNames];
                            newClientNames[index] = e.target.value;
                            updateFormData("clientNames", newClientNames);
                          }}
                          placeholder={`Company Name ${index + 1}`}
                          className={`text-sm sm:text-base ${errors.clientNames ? "border-red-500" : ""}`}
                        />
                        {formData.clientNames.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newClientNames =
                                formData.clientNames.filter(
                                  (_, i) => i !== index
                                );
                              updateFormData("clientNames", newClientNames);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        updateFormData("clientNames", [
                          ...formData.clientNames,
                          "",
                        ]);
                      }}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Another Company
                    </Button>
                  </div>
                  {errors.clientNames && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.clientNames}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Add all companies this client should have access to
                  </p>
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
              {formData.role === "client" &&
                formData.clientNames &&
                formData.clientNames.length > 0 && (
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                    <span className="font-medium">Clients:</span>
                    <span className="break-words">
                      {formData.clientNames.filter((n) => n.trim()).join(", ")}
                    </span>
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

      {/* Invitation Management Dialog */}
      {userRole === "admin" && (
        <Dialog
          open={isInvitationDialogOpen}
          onOpenChange={setIsInvitationDialogOpen}
        >
          <DialogContent className="w-[95vw] sm:w-full min-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Client Invitations
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Send Invitation Form */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Send New Invitation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label
                      className="text-sm font-medium mb-1"
                      htmlFor="invite_email"
                    >
                      Email Address
                    </Label>
                    <Input
                      id="invite_email"
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
                      <Label
                        htmlFor="client_name"
                        className="block text-sm font-medium mb-1"
                      >
                        Client Name
                      </Label>
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
                      <Label
                        htmlFor="client_name"
                        className="block text-sm font-medium mb-1"
                      >
                        Name
                      </Label>
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
                    <Label className="text-sm font-medium mb-1">Role</Label>
                    <Select
                      value={newInviteData.role}
                      onValueChange={(value) =>
                        setNewInviteData((prev) => ({ ...prev, role: value }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="client">Client</SelectItem>
                        <SelectItem value="modeler">3D Modeler</SelectItem>
                        <SelectItem value="qa">Quality Assurance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={sendInvitation}
                    disabled={sendingInvite}
                    className="w-full"
                  >
                    {sendingInvite ? "Sending..." : "Send Invitation"}
                  </Button>
                </CardContent>
              </Card>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-4">
                    <Mail className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Total</p>
                      <p className="text-2xl font-bold">{invitations.length}</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-4">
                    <Clock className="h-5 w-5 text-yellow-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Pending</p>
                      <p className="text-2xl font-bold">
                        {
                          invitations.filter((i) => i.status === "pending")
                            .length
                        }
                      </p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-4">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Accepted</p>
                      <p className="text-2xl font-bold">
                        {
                          invitations.filter((i) => i.status === "accepted")
                            .length
                        }
                      </p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-4">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Expired/Cancelled
                      </p>
                      <p className="text-2xl font-bold">
                        {
                          invitations.filter(
                            (i) =>
                              i.status === "expired" || i.status === "cancelled"
                          ).length
                        }
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Invitations Table */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      Invitation History
                    </CardTitle>
                    {invitations.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setClearHistoryDialog(true)}
                        className="text-error hover:text-error/80 hover:bg-error-muted"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear History
                        <span className="ml-1 text-xs">
                          (
                          {
                            invitations.filter(
                              (inv) => inv.status !== "accepted"
                            ).length
                          }
                          )
                        </span>
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingInvitations ? (
                    <div className="space-y-2 ">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-12 bg-muted animate-pulse rounded"
                        />
                      ))}
                    </div>
                  ) : invitations.length === 0 ? (
                    <div className="text-center py-8">
                      <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        No invitations sent yet.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-left">Email</TableHead>
                            <TableHead className="text-left">Client</TableHead>
                            <TableHead className="text-left">Role</TableHead>
                            <TableHead className="text-left">Status</TableHead>
                            <TableHead className="text-left">Invited</TableHead>
                            <TableHead className="text-left">Expires</TableHead>
                            <TableHead className="text-left">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {invitations.map((invitation) => (
                            <TableRow key={invitation.id}>
                              <TableCell className="font-medium text-left">
                                {invitation.email}
                              </TableCell>
                              <TableCell className="text-left">
                                {invitation.client_name}
                              </TableCell>
                              <TableCell className="text-left">
                                <Badge variant="outline">
                                  {invitation.role}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-left">
                                {getStatusBadge(invitation.status)}
                              </TableCell>
                              <TableCell className="text-left">
                                {formatInvitationDate(invitation.invited_at)}
                              </TableCell>
                              <TableCell className="text-left">
                                {formatInvitationDate(invitation.expires_at)}
                              </TableCell>
                              <TableCell className="text-left">
                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      copyInvitationLink(
                                        invitation.invitation_link
                                      )
                                    }
                                    title="Copy invitation link"
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                  {invitation.status === "pending" && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        cancelInvitation(invitation.id)
                                      }
                                      title="Cancel invitation"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {invitation.status !== "accepted" && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        setDeleteDialog({
                                          open: true,
                                          invitation,
                                        })
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
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Invitation Confirmation Dialog */}
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

      {/* Add Company Dialog */}
      {userRole === "admin" && (
        <Dialog
          open={isAddCompanyDialogOpen}
          onOpenChange={setIsAddCompanyDialogOpen}
        >
          <DialogContent className="w-[95vw] sm:w-full min-w-4xl max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="pb-3 sm:pb-4">
              <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline">
                  Add Company Information
                </span>
                <span className="sm:hidden">Add Company</span>
              </DialogTitle>
            </DialogHeader>
            <CompanyForm
              formData={companyFormData}
              setFormData={setCompanyFormData}
              onSubmit={() => handleSubmitCompany(false)}
              onCancel={() => setIsAddCompanyDialogOpen(false)}
              companyName={undefined}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Company Dialog */}
      {userRole === "admin" && (
        <Dialog
          open={isEditCompanyDialogOpen}
          onOpenChange={setIsEditCompanyDialogOpen}
        >
          <DialogContent className="w-[95vw] sm:w-full min-w-5xl max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="pb-3 sm:pb-4">
              <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Edit className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline">
                  Edit Company: {selectedCompany?.name}
                </span>
                <span className="sm:hidden">Edit: {selectedCompany?.name}</span>
              </DialogTitle>
            </DialogHeader>
            <CompanyForm
              formData={companyFormData}
              setFormData={setCompanyFormData}
              onSubmit={() => handleSubmitCompany(true)}
              onCancel={() => setIsEditCompanyDialogOpen(false)}
              companyName={selectedCompany?.name}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* View Company Dialog */}
      {userRole === "admin" && (
        <Dialog
          open={isViewCompanyDialogOpen}
          onOpenChange={setIsViewCompanyDialogOpen}
        >
          <DialogContent className="w-[95vw] sm:w-full min-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="pb-3 sm:pb-4">
              <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline">
                  Company Details: {selectedCompany?.name}
                </span>
                <span className="sm:hidden">{selectedCompany?.name}</span>
              </DialogTitle>
            </DialogHeader>
            {selectedCompany && <CompanyView company={selectedCompany} />}
          </DialogContent>
        </Dialog>
      )}

      <Toaster />
    </div>
  );
}

// Company Form Component
function CompanyForm({
  formData,
  setFormData,
  onSubmit,
  onCancel,
  companyName,
}: {
  formData: CompanyFormData;
  setFormData: (data: CompanyFormData) => void;
  onSubmit: () => void;
  onCancel: () => void;
  companyName?: string;
}) {
  const user = useUser();
  const role = (user?.metadata?.role || "").toLowerCase();
  const [usersWithAccess, setUsersWithAccess] = useState<
    Array<{ id: string; email: string; client: string[] }>
  >([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [editingUserCompanies, setEditingUserCompanies] = useState<{
    userId: string;
    email: string;
  } | null>(null);
  const [isEditCompaniesDialogOpen, setIsEditCompaniesDialogOpen] =
    useState(false);

  // Fetch client users who have access to this company
  useEffect(() => {
    const fetchUsersWithAccess = async () => {
      if (!companyName) return;

      setLoadingUsers(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, email, client")
          .eq("role", "client");

        if (error) throw error;

        const filtered =
          data?.filter((u: any) => {
            if (Array.isArray(u.client)) {
              return u.client.includes(companyName);
            }
            return u.client === companyName;
          }) || [];

        setUsersWithAccess(filtered);
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsersWithAccess();
  }, [companyName]);

  const handleEditUserCompanies = (userId: string, email: string) => {
    setEditingUserCompanies({ userId, email });
    setIsEditCompaniesDialogOpen(true);
  };

  return (
    <>
      <div className="space-y-3 sm:space-y-4">
        {/* Basic Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="name" className="text-sm">
              Company Name
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Enter company name"
              className="text-sm sm:text-base"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="company" className="text-sm">
              Description
            </Label>
            <Input
              id="company"
              value={formData.company}
              onChange={(e) =>
                setFormData({ ...formData, company: e.target.value })
              }
              placeholder="Enter company description"
              className="text-sm sm:text-base"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="status" className="text-sm">
              Status
            </Label>
            <Select
              value={formData.status}
              onValueChange={(value: "active" | "inactive") =>
                setFormData({ ...formData, status: value })
              }
            >
              <SelectTrigger className="text-sm sm:text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Contract Information - Collapsible */}
        <div className="border-t pt-3 sm:pt-4">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="contract-details" className="border-none">
              <AccordionTrigger className="py-2 hover:no-underline">
                <h3 className="text-sm sm:text-base font-medium flex items-center gap-2">
                  <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                  Contract Details
                </h3>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor="contract_type" className="text-sm">
                          Contract Size
                        </Label>
                        <Select
                          value={formData.contract_type}
                          onValueChange={(
                            value:
                              | "standard"
                              | "premium"
                              | "enterprise"
                              | "custom"
                          ) =>
                            setFormData({ ...formData, contract_type: value })
                          }
                        >
                          <SelectTrigger className="text-sm sm:text-base">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="standard">Small</SelectItem>
                            <SelectItem value="premium">Medium</SelectItem>
                            <SelectItem value="enterprise">Big</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="contract_value" className="text-sm">
                          Contract Value (€)
                        </Label>
                        <Input
                          id="contract_value"
                          type="number"
                          min="0"
                          max="99999999.99"
                          step="0.01"
                          value={
                            formData.contract_value === 0
                              ? ""
                              : formData.contract_value
                          }
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              contract_value:
                                e.target.value === ""
                                  ? 0
                                  : parseFloat(e.target.value) || 0,
                            })
                          }
                          placeholder="0.00"
                          className="text-sm sm:text-base"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="models_in_contract" className="text-sm">
                          Models in Contract
                        </Label>
                        <Input
                          id="models_in_contract"
                          type="number"
                          min="0"
                          value={formData.models_in_contract || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              models_in_contract: parseInt(e.target.value) || 0,
                            })
                          }
                          placeholder="0"
                          className="text-sm sm:text-base"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="change_percentage" className="text-sm">
                          Change Percentage (%)
                        </Label>
                        <Input
                          id="change_percentage"
                          type="number"
                          min="0"
                          max="100"
                          value={formData.change_percentage || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              change_percentage: parseInt(e.target.value) || 0,
                            })
                          }
                          placeholder="0"
                          className="text-sm sm:text-base"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">Start Date</Label>
                      <DatePicker
                        value={
                          formData.start_date
                            ? new Date(formData.start_date)
                            : undefined
                        }
                        onChange={(date) => {
                          if (!date) return;
                          const yyyy = date.getFullYear();
                          const mm = String(date.getMonth() + 1).padStart(
                            2,
                            "0"
                          );
                          const dd = String(date.getDate()).padStart(2, "0");
                          const iso = `${yyyy}-${mm}-${dd}`;
                          setFormData({ ...formData, start_date: iso });
                        }}
                        placeholder="Select start date"
                      />
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Specifications and Requirements - Collapsible */}
        <div className="border-t pt-3 sm:pt-4">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="specifications" className="border-none">
              <AccordionTrigger className="py-2 hover:no-underline">
                <h3 className="text-sm sm:text-base font-medium flex items-center gap-2">
                  <Building2 className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                  Project Specifications
                </h3>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <Label htmlFor="specifications" className="text-sm">
                      Client Specifications
                    </Label>
                    <Textarea
                      id="specifications"
                      value={formData.specifications}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          specifications: e.target.value,
                        })
                      }
                      placeholder="Enter detailed client specifications, requirements, and any special instructions..."
                      rows={3}
                      className="text-sm sm:text-base"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="requirements" className="text-sm">
                        Project Requirements
                      </Label>
                      <Textarea
                        id="requirements"
                        value={formData.requirements}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            requirements: e.target.value,
                          })
                        }
                        placeholder="Enter technical requirements, quality standards, and project scope..."
                        rows={3}
                        className="text-sm sm:text-base"
                      />
                    </div>
                    {role === "admin" && (
                      <div className="space-y-1">
                        <Label htmlFor="notes" className="text-sm">
                          Additional Notes (Admin only)
                        </Label>
                        <Textarea
                          id="notes"
                          value={formData.notes}
                          onChange={(e) =>
                            setFormData({ ...formData, notes: e.target.value })
                          }
                          placeholder="Any additional notes or comments..."
                          rows={3}
                          className="text-sm sm:text-base"
                        />
                      </div>
                    )}
                  </div>
                  {(role === "admin" || role === "qa") && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-sm">
                          Guideline Link (For Modelers)
                        </Label>
                        <Input
                          value={
                            (formData.client_guide_links &&
                              formData.client_guide_links[0]) ||
                            ""
                          }
                          onChange={(e) => {
                            const first = e.target.value;
                            const next = [
                              ...(formData.client_guide_links || []),
                            ];
                            if (next.length === 0) next.push(first);
                            else next[0] = first;
                            setFormData({
                              ...formData,
                              client_guide_links: next,
                            });
                          }}
                          className="text-sm sm:text-base"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="viewer_type" className="text-sm">
                          Choose Viewer
                        </Label>
                        <Select
                          value={formData.viewer_type || ""}
                          onValueChange={(
                            value:
                              | "v6_aces"
                              | "v5_tester"
                              | "synsam"
                              | "v2"
                              | ""
                          ) =>
                            setFormData({
                              ...formData,
                              viewer_type: value || null,
                            })
                          }
                        >
                          <SelectTrigger className="text-sm sm:text-base">
                            <SelectValue placeholder="Select a viewer type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="v6_aces">
                              V6 ACES Tester
                            </SelectItem>
                            <SelectItem value="v5_tester">V5 Tester</SelectItem>
                            <SelectItem value="synsam">Synsam</SelectItem>
                            <SelectItem value="v2" disabled>
                              V2 (Under Construction)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                  {role === "admin" && (
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="bunny_custom_structure"
                            checked={formData.bunny_custom_structure || false}
                            onCheckedChange={(checked) =>
                              setFormData({
                                ...formData,
                                bunny_custom_structure: checked,
                              })
                            }
                          />
                          <Label
                            htmlFor="bunny_custom_structure"
                            className="text-sm"
                          >
                            Use Custom Storage Zone (Client has their own
                            BunnyCDN storage zone)
                          </Label>
                        </div>

                        {formData.bunny_custom_structure && (
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <Label
                                htmlFor="bunny_custom_url"
                                className="text-sm"
                              >
                                Custom Storage Zone Name
                              </Label>
                              <Input
                                id="bunny_custom_url"
                                value={formData.bunny_custom_url || ""}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    bunny_custom_url: e.target.value,
                                  })
                                }
                                placeholder="e.g., Polhus"
                                className="text-sm sm:text-base font-mono"
                              />
                              <div className="text-xs space-y-1">
                                <p className="text-muted-foreground">
                                  Case-sensitive! Must match BunnyCDN exactly.
                                </p>
                                {formData.bunny_custom_url && (
                                  <p className="text-blue-600 font-mono">
                                    CDN URL:
                                    https://cdn.charpstar.net/QC/filename.glb
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label
                                htmlFor="bunny_custom_access_key"
                                className="text-sm"
                              >
                                Custom Storage Zone Access Key
                              </Label>
                              <Input
                                id="bunny_custom_access_key"
                                type="password"
                                value={formData.bunny_custom_access_key || ""}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    bunny_custom_access_key: e.target.value,
                                  })
                                }
                                placeholder="Enter BunnyCDN AccessKey for this storage zone"
                                className="text-sm sm:text-base font-mono"
                              />
                              <p className="text-xs text-muted-foreground">
                                Required: Each storage zone has its own
                                AccessKey
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>
                          • <strong>Folders auto-created</strong> on first asset
                          upload with QC/, Android/, iOS/ subfolders
                        </p>
                        <p>
                          • <strong>Default:</strong> Storage zone
                          &quot;maincdn&quot; with folder {"{ClientName}"}
                        </p>
                        <p>
                          • <strong>Custom:</strong> Custom storage zone
                          (replaces &quot;maincdn&quot;)
                        </p>
                        <p>
                          • <strong>Storage Path:</strong>{" "}
                          {(() => {
                            const clientName = (
                              formData.name || "ClientName"
                            ).replace(/[^a-zA-Z0-9._-]/g, "_");
                            if (
                              formData.bunny_custom_structure &&
                              formData.bunny_custom_url
                            ) {
                              const customZone =
                                formData.bunny_custom_url.replace(
                                  /^\/+|\/+$/g,
                                  ""
                                );
                              return `${customZone}/QC/, Android/, iOS/`;
                            }
                            return `maincdn/${clientName}/QC/, Android/, iOS/`;
                          })()}
                        </p>
                        <p>
                          • <strong>CDN URL:</strong>{" "}
                          {(() => {
                            const clientName = (
                              formData.name || "ClientName"
                            ).replace(/[^a-zA-Z0-9._-]/g, "_");
                            if (
                              formData.bunny_custom_structure &&
                              formData.bunny_custom_url
                            ) {
                              return `cdn.charpstar.net/QC/filename.glb`;
                            }
                            return `cdn.charpstar.net/${clientName}/QC/filename.glb`;
                          })()}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Connected Client Users Section */}
        {companyName && (
          <div className="border-t pt-3 sm:pt-4">
            <button
              type="button"
              onClick={() => setShowUsers(!showUsers)}
              className="flex items-center justify-between w-full text-left hover:bg-muted/50 rounded-lg p-2 -m-2 transition-colors"
            >
              <h3 className="text-sm sm:text-base font-medium flex items-center gap-2">
                <Users className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600" />
                Client Users Connected to {companyName}
                {usersWithAccess.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {usersWithAccess.length}
                  </Badge>
                )}
              </h3>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  showUsers ? "rotate-180" : ""
                }`}
              />
            </button>
            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                showUsers ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <div className="mt-3">
                {loadingUsers ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  </div>
                ) : usersWithAccess.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">
                    No client users connected to this company yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {usersWithAccess.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors duration-200"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium">{user.email}</p>
                          <p className="text-xs text-muted-foreground">
                            Companies:{" "}
                            {Array.isArray(user.client)
                              ? user.client.join(", ")
                              : user.client}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleEditUserCompanies(user.id, user.email)
                          }
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Edit Companies
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-3 sm:pt-4 border-t">
          <Button
            variant="outline"
            onClick={onCancel}
            className="w-full sm:w-auto text-sm sm:text-base"
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            className="w-full sm:w-auto text-sm sm:text-base"
          >
            Save Company
          </Button>
        </div>
      </div>

      {/* Edit Companies Dialog */}
      {editingUserCompanies && (
        <EditCompaniesDialog
          isOpen={isEditCompaniesDialogOpen}
          onClose={() => {
            setIsEditCompaniesDialogOpen(false);
            setEditingUserCompanies(null);
          }}
          userId={editingUserCompanies.userId}
          userEmail={editingUserCompanies.email}
          onSuccess={() => {
            setLoadingUsers(true);
            supabase
              .from("profiles")
              .select("id, email, client")
              .eq("role", "client")
              .then(({ data, error }) => {
                if (!error && data && companyName) {
                  const filtered = data.filter((u: any) => {
                    if (Array.isArray(u.client)) {
                      return u.client.includes(companyName);
                    }
                    return u.client === companyName;
                  });
                  setUsersWithAccess(filtered);
                }
                setLoadingUsers(false);
              });
          }}
        />
      )}
    </>
  );
}

// Company View Component
function CompanyView({ company }: { company: Company }) {
  const user = useUser();
  const role = (user?.metadata?.role || "").toLowerCase();
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Basic Information */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <div className="space-y-3 sm:space-y-4">
          <div>
            <h4 className="font-medium text-muted-foreground text-sm">
              Company Name
            </h4>
            <p className="text-base sm:text-lg">{company.name}</p>
          </div>
          <div>
            <h4 className="font-medium text-muted-foreground text-sm">
              Description
            </h4>
            <p className="text-sm sm:text-base">{company.company || "N/A"}</p>
          </div>
          <div>
            <h4 className="font-medium text-muted-foreground text-sm">
              Status
            </h4>
            <Badge
              className={`${
                company.status === "active"
                  ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                  : company.status === "inactive"
                    ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                    : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
              } text-xs`}
            >
              {company.status.charAt(0).toUpperCase() + company.status.slice(1)}
            </Badge>
          </div>
        </div>
        <div className="space-y-3 sm:space-y-4">
          <div>
            <h4 className="font-medium text-muted-foreground text-sm">
              Contract Type
            </h4>
            <Badge
              className={`${
                company.contract_type === "premium"
                  ? "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400"
                  : company.contract_type === "enterprise"
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
                    : company.contract_type === "custom"
                      ? "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400"
                      : "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400"
              } text-xs`}
            >
              {company.contract_type === "standard"
                ? "Small"
                : company.contract_type === "premium"
                  ? "Medium"
                  : company.contract_type === "enterprise"
                    ? "Big"
                    : "Custom"}
            </Badge>
          </div>
          <div>
            <h4 className="font-medium text-muted-foreground text-sm">
              Contract Value
            </h4>
            <p className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400">
              €{company.contract_value.toLocaleString()}
            </p>
          </div>
          {company.models_in_contract && (
            <div>
              <h4 className="font-medium text-muted-foreground text-sm">
                Models in Contract
              </h4>
              <p className="text-lg sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
                {company.models_in_contract.toLocaleString()}
              </p>
            </div>
          )}
          {company.change_percentage && (
            <div>
              <h4 className="font-medium text-muted-foreground text-sm">
                Change Percentage
              </h4>
              <p className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400">
                {company.change_percentage}%
              </p>
            </div>
          )}
          <div>
            <h4 className="font-medium text-muted-foreground text-sm">
              Start Date
            </h4>
            <p className="text-sm sm:text-base">
              {new Date(company.start_date).toLocaleDateString()}
            </p>
          </div>
          {company.viewer_type && (
            <div>
              <h4 className="font-medium text-muted-foreground text-sm">
                Viewer Type
              </h4>
              <Badge
                className={`${
                  company.viewer_type === "v6_aces"
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
                    : company.viewer_type === "v5_tester"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                      : company.viewer_type === "synsam"
                        ? "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400"
                } text-xs`}
              >
                {company.viewer_type === "v6_aces"
                  ? "V6 ACES Tester"
                  : company.viewer_type === "v5_tester"
                    ? "V5 Tester"
                    : company.viewer_type === "synsam"
                      ? "Synsam"
                      : "V2 (Under Construction)"}
              </Badge>
            </div>
          )}
          {(company.bunny_custom_structure || company.bunny_custom_url) && (
            <div>
              <h4 className="font-medium text-muted-foreground text-sm">
                BunnyCDN Configuration
              </h4>
              <div className="mt-1">
                <div className="space-y-2">
                  <div>
                    <span className="text-xs font-medium">
                      {company.bunny_custom_structure &&
                      company.bunny_custom_url
                        ? "Custom Storage Zone:"
                        : "Storage Zone:"}
                    </span>
                    <code className="text-xs bg-muted px-2 py-1 rounded font-mono ml-1">
                      {company.bunny_custom_structure &&
                      company.bunny_custom_url
                        ? company.bunny_custom_url
                        : "maincdn"}
                    </code>
                  </div>
                  {!(
                    company.bunny_custom_structure && company.bunny_custom_url
                  ) && (
                    <div>
                      <span className="text-xs font-medium">
                        Company Folder:
                      </span>
                      <code className="text-xs bg-muted px-2 py-1 rounded font-mono ml-1">
                        {company.name.replace(/[^a-zA-Z0-9._-]/g, "_")}
                      </code>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>
                      <strong>Storage Path:</strong>{" "}
                      {(() => {
                        const companyName = company.name.replace(
                          /[^a-zA-Z0-9._-]/g,
                          "_"
                        );
                        if (
                          company.bunny_custom_structure &&
                          company.bunny_custom_url
                        ) {
                          const customZone = company.bunny_custom_url.replace(
                            /^\/+|\/+$/g,
                            ""
                          );
                          return `${customZone}/QC/, Android/, iOS/`;
                        }
                        return `maincdn/${companyName}/QC/, Android/, iOS/`;
                      })()}
                    </p>
                    <p>
                      <strong>CDN URL:</strong>{" "}
                      {(() => {
                        const companyName = company.name.replace(
                          /[^a-zA-Z0-9._-]/g,
                          "_"
                        );
                        if (
                          company.bunny_custom_structure &&
                          company.bunny_custom_url
                        ) {
                          return `cdn.charpstar.net/QC/filename.glb`;
                        }
                        return `cdn.charpstar.net/${companyName}/QC/filename.glb`;
                      })()}
                    </p>
                    <p>• QC/ = Files pending approval</p>
                    <p>• Android/ = Approved files for Live 3D & Android AR</p>
                    <p>• iOS/ = USDZ files for iOS AR</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Specifications, Guide and Requirements */}
      {(company.specifications ||
        company.requirements ||
        company.client_guide ||
        (role === "admin" && company.notes)) && (
        <div className="border-t pt-4 sm:pt-6">
          <h4 className="text-base sm:text-lg font-medium mb-3 sm:mb-4">
            Project Details
          </h4>
          <div className="space-y-3 sm:space-y-4">
            {company.specifications && (
              <div>
                <h5 className="font-medium text-muted-foreground mb-2 text-sm">
                  Company Specifications
                </h5>
                <div className="p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="whitespace-pre-wrap text-sm sm:text-base">
                    {company.specifications}
                  </p>
                </div>
              </div>
            )}
            {(company.client_guide ||
              (company.client_guide_links &&
                company.client_guide_links.length > 0)) && (
              <div>
                <h5 className="font-medium text-muted-foreground mb-2 text-sm">
                  Company Guide (For Modelers)
                </h5>
                {company.client_guide && (
                  <div className="p-3 sm:p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="whitespace-pre-wrap text-sm sm:text-base">
                      {company.client_guide}
                    </p>
                  </div>
                )}
                {company.client_guide_links &&
                  company.client_guide_links.length > 0 && (
                    <ul className="list-disc pl-4 sm:pl-6 mt-2 sm:mt-3 space-y-1">
                      {company.client_guide_links.map((url, i) => (
                        <li key={i} className="text-sm sm:text-base">
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 underline break-all"
                          >
                            {url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
              </div>
            )}
            {company.requirements && (
              <div>
                <h5 className="font-medium text-muted-foreground mb-2 text-sm">
                  Project Requirements
                </h5>
                <div className="p-3 sm:p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="whitespace-pre-wrap text-sm sm:text-base">
                    {company.requirements}
                  </p>
                </div>
              </div>
            )}
            {role === "admin" && company.notes && (
              <div>
                <h5 className="font-medium text-muted-foreground mb-2 text-sm">
                  Additional Notes
                </h5>
                <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg border border-gray-200 dark:border-gray-800">
                  <p className="whitespace-pre-wrap text-sm sm:text-base">
                    {company.notes}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timestamps */}
      <div className="border-t pt-4 sm:pt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
          <div>
            <span className="font-medium">Created:</span>{" "}
            {new Date(company.created_at).toLocaleString()}
          </div>
          <div>
            <span className="font-medium">Last Updated:</span>{" "}
            {new Date(company.updated_at).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
