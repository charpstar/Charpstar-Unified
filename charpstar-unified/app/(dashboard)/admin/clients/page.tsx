/**
 * ⚠️ DEPRECATED - THIS PAGE IS NO LONGER USED
 *
 * This admin/clients page has been merged into the Users page (/users).
 * All company management functionality is now available through the "Companies"
 * tab in the Users page, which is accessible to both admin and production roles.
 *
 * This file is kept for reference only and should not be accessed directly.
 * Navigation to this page has been removed from the sidebar.
 */

"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/interactive";
import { Button } from "@/components/ui/display";
import { Input } from "@/components/ui/inputs";
import { Label } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
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
} from "@/components/ui/containers";
import { Textarea } from "@/components/ui/inputs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs";
import { Switch } from "@/components/ui/inputs";
import {
  Plus,
  Edit,
  Eye,
  Search,
  Building2,
  FileText,
  Users,
  ChevronDown,
} from "lucide-react";
import { DatePicker } from "@/components/ui/utilities";

import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/utilities";
import { useUser } from "@/contexts/useUser";
import { EditCompaniesDialog } from "@/components/users/EditCompaniesDialog";

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
  [companyName: string]: number;
}

export default function AdminClientsPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [assetCounts, setAssetCounts] = useState<CompanyAssetCount>({});
  const [formData, setFormData] = useState<CompanyFormData>({
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
  const { toast } = useToast();

  // Fetch companies on component mount
  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchAssetCounts = async (companyNames: string[]) => {
    try {
      const counts: CompanyAssetCount = {};

      // Query onboarding_assets table - get all records to filter manually
      const { data: onboardingData, error: onboardingError } = await supabase
        .from("onboarding_assets")
        .select("client, transferred")
        .in("client", companyNames);

      if (onboardingError) throw onboardingError;

      // Query assets table - get all records to filter manually
      const { data: assetsData, error: assetsError } = await supabase
        .from("assets")
        .select("client, active")
        .in("client", companyNames);

      if (assetsError) throw assetsError;

      // Count assets per company
      companyNames.forEach((name) => {
        // Debug: Log the data for this company
        const companyOnboardingData = onboardingData?.filter(
          (item) => item.client === name
        );
        const companyAssetsData = assetsData?.filter(
          (item) => item.client === name
        );
        console.log(
          `Admin - Company: ${name}, Onboarding data:`,
          companyOnboardingData
        );
        console.log(
          `Admin - Company: ${name}, Assets data:`,
          companyAssetsData
        );

        // Filter onboarding_assets: exclude where transferred = true
        const onboardingCount =
          onboardingData?.filter(
            (item) =>
              item.client === name &&
              (item.transferred === false || item.transferred === null)
          ).length || 0;

        // Filter assets: exclude where active = false
        const assetsCount =
          assetsData?.filter(
            (item) =>
              item.client === name &&
              (item.active === true || item.active === null)
          ).length || 0;

        counts[name] = onboardingCount + assetsCount;
      });

      return counts;
    } catch (error) {
      console.error("Error fetching asset counts:", error);
      return {};
    }
  };

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      const existingCompanies = data || [];

      // Collect company names referenced elsewhere (from client user profiles and assets)
      const [profilesRes, assetsRes] = await Promise.all([
        supabase.from("profiles").select("client").eq("role", "client"),
        supabase.from("onboarding_assets").select("client"),
      ]);

      const referencedNames = new Set<string>();
      existingCompanies.forEach((c) => c.name && referencedNames.add(c.name));

      if (!profilesRes.error && profilesRes.data) {
        profilesRes.data.forEach((r: any) => {
          // Handle both old (string) and new (array) format
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

      // Merge and sort by name
      const merged = [...existingCompanies, ...placeholders].sort((a, b) =>
        a.name.localeCompare(b.name)
      );

      setCompanies(merged);

      // Fetch asset counts for all companies
      const companyNames = merged.map((c) => c.name);
      const counts = await fetchAssetCounts(companyNames);
      setAssetCounts(counts);
    } catch (error) {
      console.error("Error fetching companies:", error);
      toast({
        title: "Error",
        description: "Failed to fetch companies",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredCompanies = companies.filter(
    (company) =>
      company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.company.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditCompany = (company: Company) => {
    setSelectedCompany(company);
    setFormData({
      name: company.name,
      company: company.company,
      contract_type: company.contract_type,
      contract_value: company.contract_value,
      models_in_contract: company.models_in_contract || 0,
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
    setIsEditDialogOpen(true);
  };

  const handleViewCompany = (company: Company) => {
    setSelectedCompany(company);
    setIsViewDialogOpen(true);
  };

  const handleAddCompany = () => {
    setFormData({
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
    });
    setIsAddDialogOpen(true);
  };

  const handleAddCompanyPrefill = (name: string) => {
    setFormData({
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
    });
    setIsAddDialogOpen(true);
  };

  const handleSubmit = async (isEdit: boolean) => {
    try {
      // Validate contract_value against NUMERIC(10,2) limit
      const MAX_NUMERIC_10_2 = 99999999.99; // absolute must be < 1e8
      if (
        formData.contract_value < 0 ||
        Math.abs(formData.contract_value) > MAX_NUMERIC_10_2
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
            ...formData,
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
          ...formData,

          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (error) throw error;

        toast({
          title: "Success",
          description: "Company added successfully",
        });
      }

      // Reset form and close dialog
      setFormData({
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
      });
      setIsEditDialogOpen(false);
      setIsAddDialogOpen(false);
      setSelectedCompany(null);
      fetchCompanies(); // Refresh the list
    } catch (error: any) {
      console.error("Error saving company:", error);

      // Provide specific error messages for common issues
      let errorMessage = "Failed to save company";

      if (error?.code === "23505") {
        // Unique constraint violation
        if (error?.details?.includes("name")) {
          errorMessage = `A company with the name "${formData.name}" already exists. Please use a different name.`;
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "inactive":
        return "bg-red-100 text-red-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getContractTypeColor = (type: string) => {
    switch (type) {
      case "premium":
        return "bg-purple-100 text-purple-800";
      case "enterprise":
        return "bg-blue-100 text-blue-800";
      case "custom":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading companies...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <span className="hidden sm:inline">Company Management</span>
            <span className="sm:hidden">Companies</span>
          </h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
            Manage company information, contracts, and connected client users
          </p>
        </div>
        <Button
          onClick={handleAddCompany}
          className="flex items-center gap-2 w-full sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add Company</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-4 sm:pt-6">
          <div className="flex gap-3 sm:gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search companies by name, description, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 text-sm sm:text-base"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Companies Table */}
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="text-lg sm:text-xl">
            Companies ({filteredCompanies.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-left">Company Name</TableHead>
                  <TableHead className="text-left">Description</TableHead>
                  <TableHead className="text-left">Contract</TableHead>
                  <TableHead className="text-left">Value</TableHead>
                  <TableHead className="text-left">Models</TableHead>
                  <TableHead className="text-left">Status</TableHead>
                  <TableHead className="text-left">Start Date</TableHead>
                  <TableHead className="text-left">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="text-left">
                      <div>
                        <div className="font-medium">{company.name}</div>

                        {company.isPlaceholder && (
                          <div className="text-xs text-amber-700 mt-1">
                            Please fill in info for this company
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-left">
                      {company.company}
                    </TableCell>
                    <TableCell className="text-left">
                      {company.isPlaceholder ? (
                        "-"
                      ) : (
                        <Badge
                          className={getContractTypeColor(
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
                        : `${assetCounts[company.name] || 0} / ${company.models_in_contract || 0}`}
                    </TableCell>
                    <TableCell className="text-left">
                      {company.isPlaceholder ? (
                        "-"
                      ) : (
                        <Badge className={getStatusColor(company.status)}>
                          {company.status.charAt(0).toUpperCase() +
                            company.status.slice(1)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-left">
                      {company.start_date
                        ? new Date(company.start_date).toLocaleDateString()
                        : "-"}
                    </TableCell>
                    <TableCell className="text-left">
                      <div className="flex gap-2">
                        {company.isPlaceholder ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleAddCompanyPrefill(company.name)
                            }
                          >
                            Add Info
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewCompany(company)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditCompany(company)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3 p-4">
            {filteredCompanies.map((company) => (
              <div key={company.id} className="border rounded-lg p-4 space-y-3">
                {/* Company Info */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-base">{company.name}</h3>
                      {company.company && (
                        <p className="text-sm text-muted-foreground">
                          {company.company}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {company.isPlaceholder ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddCompanyPrefill(company.name)}
                          className="text-xs px-2 py-1"
                        >
                          Add Info
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewCompany(company)}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditCompany(company)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {company.isPlaceholder && (
                    <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded">
                      Please fill in info for this company
                    </div>
                  )}
                </div>

                {/* Contract Details */}
                {!company.isPlaceholder && (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Contract:</span>
                      <div className="mt-1">
                        <Badge
                          className={`${getContractTypeColor(company.contract_type)} text-xs`}
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
                    </div>
                    <div>
                      <span className="text-muted-foreground">Value:</span>
                      <p className="font-medium">
                        €{company.contract_value.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Models:</span>
                      <p className="font-medium">
                        {assetCounts[company.name] || 0} /{" "}
                        {company.models_in_contract || 0}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>
                      <div className="mt-1">
                        <Badge
                          className={`${getStatusColor(company.status)} text-xs`}
                        >
                          {company.status.charAt(0).toUpperCase() +
                            company.status.slice(1)}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Start Date:</span>
                      <p className="font-medium">
                        {company.start_date
                          ? new Date(company.start_date).toLocaleDateString()
                          : "-"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Add Company Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="w-[95vw] sm:w-full min-w-4xl max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-3 sm:pb-4">
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">Add Company Information</span>
              <span className="sm:hidden">Add Company</span>
            </DialogTitle>
          </DialogHeader>

          <CompanyForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={() => handleSubmit(false)}
            onCancel={() => setIsAddDialogOpen(false)}
            companyName={undefined}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Company Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
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
            formData={formData}
            setFormData={setFormData}
            onSubmit={() => handleSubmit(true)}
            onCancel={() => setIsEditDialogOpen(false)}
            companyName={selectedCompany?.name}
          />
        </DialogContent>
      </Dialog>

      {/* View Company Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
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

        // Filter client users who have this company in their array
        const filtered =
          data?.filter((u: any) => {
            if (Array.isArray(u.client)) {
              return u.client.includes(companyName);
            }
            // Handle old format (string)
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
                    {/* Contract Size and Value */}
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

                    {/* Start Date */}
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
            // Refresh the users list
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
                  ? "bg-green-100 text-green-800"
                  : company.status === "inactive"
                    ? "bg-red-100 text-red-800"
                    : "bg-yellow-100 text-yellow-800"
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
                  ? "bg-purple-100 text-purple-800"
                  : company.contract_type === "enterprise"
                    ? "bg-blue-100 text-blue-800"
                    : company.contract_type === "custom"
                      ? "bg-orange-100 text-orange-800"
                      : "bg-gray-100 text-gray-800"
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
            <p className="text-lg sm:text-2xl font-bold text-green-600">
              €{company.contract_value.toLocaleString()}
            </p>
          </div>
          {company.models_in_contract && (
            <div>
              <h4 className="font-medium text-muted-foreground text-sm">
                Models in Contract
              </h4>
              <p className="text-lg sm:text-2xl font-bold text-blue-600">
                {company.models_in_contract.toLocaleString()}
              </p>
            </div>
          )}
          {company.change_percentage && (
            <div>
              <h4 className="font-medium text-muted-foreground text-sm">
                Change Percentage
              </h4>
              <p className="text-lg sm:text-2xl font-bold text-green-600">
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
                    ? "bg-blue-100 text-blue-800"
                    : company.viewer_type === "v5_tester"
                      ? "bg-green-100 text-green-800"
                      : company.viewer_type === "synsam"
                        ? "bg-purple-100 text-purple-800"
                        : "bg-gray-100 text-gray-800"
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
                <div className="p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200">
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
                  <div className="p-3 sm:p-4 bg-amber-50 rounded-lg border border-amber-200">
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
                            className="text-blue-600 underline break-all"
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
                <div className="p-3 sm:p-4 bg-green-50 rounded-lg border border-green-200">
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
                <div className="p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200">
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
