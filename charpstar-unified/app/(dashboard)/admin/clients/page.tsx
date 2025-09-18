"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
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
import { Plus, Edit, Eye, Search, Building2, FileText } from "lucide-react";
import { DatePicker } from "@/components/ui/utilities";

import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/utilities";
import { useUser } from "@/contexts/useUser";

interface Client {
  id: string;
  name: string;
  email: string;
  company: string;
  contract_type: "standard" | "premium" | "enterprise" | "custom";
  contract_value: number;
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
  created_at: string;
  updated_at: string;
  isPlaceholder?: boolean;
}

interface ClientFormData {
  name: string;
  email: string;
  company: string;
  contract_type: "standard" | "premium" | "enterprise" | "custom";
  contract_value: number;
  payment_terms: string;
  start_date: string;
  status: "active" | "inactive";
  specifications: string;
  requirements: string;
  notes: string;
  client_guide?: string;
  client_guide_links?: string[];
  viewer_type?: "v6_aces" | "v5_tester" | "synsam" | "v2" | null;
}

export default function AdminClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [formData, setFormData] = useState<ClientFormData>({
    name: "",
    email: "",
    company: "",
    contract_type: "standard",
    contract_value: 0,
    payment_terms: "",
    start_date: "",
    status: "active",
    specifications: "",
    requirements: "",
    notes: "",
    client_guide: "",
    client_guide_links: [],
    viewer_type: null,
  });
  const { toast } = useToast();

  // Fetch clients on component mount
  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      const existingClients = data || [];

      // Collect client names referenced elsewhere (only from actual clients and onboarding assets)
      const [profilesRes, assetsRes] = await Promise.all([
        supabase.from("profiles").select("client").eq("role", "client"),
        supabase.from("onboarding_assets").select("client"),
      ]);

      const referencedNames = new Set<string>();
      existingClients.forEach((c) => c.name && referencedNames.add(c.name));

      if (!profilesRes.error && profilesRes.data) {
        profilesRes.data
          .map((r: any) => r.client)
          .filter((x: any) => typeof x === "string" && x.trim().length > 0)
          .forEach((n: string) => referencedNames.add(n));
      }
      if (!assetsRes.error && assetsRes.data) {
        assetsRes.data
          .map((r: any) => r.client)
          .filter((x: any) => typeof x === "string" && x.trim().length > 0)
          .forEach((n: string) => referencedNames.add(n));
      }

      // Create placeholder entries for clients without a row in clients table
      const existingNames = new Set(existingClients.map((c) => c.name));
      const placeholders: Client[] = Array.from(referencedNames)
        .filter((n) => !existingNames.has(n))
        .map((name) => ({
          id: `placeholder-${name}`,
          name,
          email: "",
          company: "",
          contract_type: "standard",
          contract_value: 0,
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
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          isPlaceholder: true,
        }));

      // Merge and sort by name
      const merged = [...existingClients, ...placeholders].sort((a, b) =>
        a.name.localeCompare(b.name)
      );

      setClients(merged);
    } catch (error) {
      console.error("Error fetching clients:", error);
      toast({
        title: "Error",
        description: "Failed to fetch clients",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(
    (client) =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditClient = (client: Client) => {
    setSelectedClient(client);
    setFormData({
      name: client.name,
      email: client.email,
      company: client.company,
      contract_type: client.contract_type,
      contract_value: client.contract_value,
      payment_terms: client.payment_terms,
      start_date: client.start_date,
      status: client.status === "inactive" ? "inactive" : "active",
      specifications: client.specifications,
      requirements: client.requirements,
      notes: client.notes,
      client_guide: client.client_guide || "",
      client_guide_links: client.client_guide_links || [],
      viewer_type: client.viewer_type || null,
    });
    setIsEditDialogOpen(true);
  };

  const handleViewClient = (client: Client) => {
    setSelectedClient(client);
    setIsViewDialogOpen(true);
  };

  const handleAddClient = () => {
    setFormData({
      name: "",
      email: "",
      company: "",
      contract_type: "standard",
      contract_value: 0,
      payment_terms: "",
      start_date: "",
      status: "active",
      specifications: "",
      requirements: "",
      notes: "",
      client_guide: "",
      client_guide_links: [],
      viewer_type: null,
    });
    setIsAddDialogOpen(true);
  };

  const handleAddClientPrefill = (name: string) => {
    setFormData({
      name,
      email: "",
      company: "",
      contract_type: "standard",
      contract_value: 0,
      payment_terms: "",
      start_date: "",
      status: "active",
      specifications: "",
      requirements: "",
      notes: "",
      client_guide: "",
      client_guide_links: [],
      viewer_type: null,
    });
    setIsAddDialogOpen(true);
  };

  const handleSubmit = async (isEdit: boolean) => {
    try {
      // Validate required fields
      if (!formData.start_date) {
        toast({
          title: "Missing start date",
          description: "Please pick a start date before saving.",
          variant: "destructive",
        });
        return;
      }

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

      if (isEdit && selectedClient) {
        const { error } = await supabase
          .from("clients")
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", selectedClient.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Client updated successfully",
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
          description: "Client added successfully",
        });
      }

      // Reset form and close dialog
      setFormData({
        name: "",
        email: "",
        company: "",
        contract_type: "standard",
        contract_value: 0,
        payment_terms: "",
        start_date: "",
        status: "active",
        specifications: "",
        requirements: "",
        notes: "",
        client_guide: "",
        client_guide_links: [],
        viewer_type: null,
      });
      setIsEditDialogOpen(false);
      setIsAddDialogOpen(false);
      setSelectedClient(null);
      fetchClients(); // Refresh the list
    } catch (error) {
      console.error("Error saving client:", error);
      toast({
        title: "Error",
        description: "Failed to save client",
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
        <div className="text-lg">Loading clients...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
            <span className="hidden sm:inline">Client Management</span>
            <span className="sm:hidden">Clients</span>
          </h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
            Manage client information, contracts, and specifications
          </p>
        </div>
        <Button
          onClick={handleAddClient}
          className="flex items-center gap-2 w-full sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add Client</span>
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
                  placeholder="Search clients by name, company, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 text-sm sm:text-base"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clients Table */}
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="text-lg sm:text-xl">
            Clients ({filteredClients.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-left">Client</TableHead>
                  <TableHead className="text-left">Company</TableHead>
                  <TableHead className="text-left">Contract</TableHead>
                  <TableHead className="text-left">Value</TableHead>
                  <TableHead className="text-left">Status</TableHead>
                  <TableHead className="text-left">Start Date</TableHead>
                  <TableHead className="text-left">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="text-left">
                      <div>
                        <div className="font-medium">{client.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {client.email}
                        </div>
                        {client.isPlaceholder && (
                          <div className="text-xs text-amber-700 mt-1">
                            Please fill in info for this client
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-left">
                      {client.company}
                    </TableCell>
                    <TableCell className="text-left">
                      {client.isPlaceholder ? (
                        "-"
                      ) : (
                        <Badge
                          className={getContractTypeColor(client.contract_type)}
                        >
                          {client.contract_type === "standard"
                            ? "Small"
                            : client.contract_type === "premium"
                              ? "Medium"
                              : client.contract_type === "enterprise"
                                ? "Big"
                                : "Custom"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-left">
                      {client.isPlaceholder
                        ? "-"
                        : `€${client.contract_value.toLocaleString()}`}
                    </TableCell>
                    <TableCell className="text-left">
                      {client.isPlaceholder ? (
                        "-"
                      ) : (
                        <Badge className={getStatusColor(client.status)}>
                          {client.status.charAt(0).toUpperCase() +
                            client.status.slice(1)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-left">
                      {client.start_date
                        ? new Date(client.start_date).toLocaleDateString()
                        : "-"}
                    </TableCell>
                    <TableCell className="text-left">
                      <div className="flex gap-2">
                        {client.isPlaceholder ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddClientPrefill(client.name)}
                          >
                            Add Info
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewClient(client)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditClient(client)}
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
            {filteredClients.map((client) => (
              <div key={client.id} className="border rounded-lg p-4 space-y-3">
                {/* Client Info */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-base">{client.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {client.email}
                      </p>
                      {client.company && (
                        <p className="text-sm text-muted-foreground">
                          {client.company}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {client.isPlaceholder ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddClientPrefill(client.name)}
                          className="text-xs px-2 py-1"
                        >
                          Add Info
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewClient(client)}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditClient(client)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {client.isPlaceholder && (
                    <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded">
                      Please fill in info for this client
                    </div>
                  )}
                </div>

                {/* Contract Details */}
                {!client.isPlaceholder && (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Contract:</span>
                      <div className="mt-1">
                        <Badge
                          className={`${getContractTypeColor(client.contract_type)} text-xs`}
                        >
                          {client.contract_type === "standard"
                            ? "Small"
                            : client.contract_type === "premium"
                              ? "Medium"
                              : client.contract_type === "enterprise"
                                ? "Big"
                                : "Custom"}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Value:</span>
                      <p className="font-medium">
                        €{client.contract_value.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>
                      <div className="mt-1">
                        <Badge
                          className={`${getStatusColor(client.status)} text-xs`}
                        >
                          {client.status.charAt(0).toUpperCase() +
                            client.status.slice(1)}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Start Date:</span>
                      <p className="font-medium">
                        {client.start_date
                          ? new Date(client.start_date).toLocaleDateString()
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

      {/* Add Client Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="w-[95vw] sm:w-full min-w-4xl max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-3 sm:pb-4">
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">Add New Client</span>
              <span className="sm:hidden">Add Client</span>
            </DialogTitle>
          </DialogHeader>

          <ClientForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={() => handleSubmit(false)}
            onCancel={() => setIsAddDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Client Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="w-[95vw] sm:w-full min-w-4xl max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-3 sm:pb-4">
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Edit className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">
                Edit Client: {selectedClient?.name}
              </span>
              <span className="sm:hidden">Edit: {selectedClient?.name}</span>
            </DialogTitle>
          </DialogHeader>

          <ClientForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={() => handleSubmit(true)}
            onCancel={() => setIsEditDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* View Client Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="w-[95vw] sm:w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-3 sm:pb-4">
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">
                Client Details: {selectedClient?.name}
              </span>
              <span className="sm:hidden">{selectedClient?.name}</span>
            </DialogTitle>
          </DialogHeader>
          {selectedClient && <ClientView client={selectedClient} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Client Form Component
function ClientForm({
  formData,
  setFormData,
  onSubmit,
  onCancel,
}: {
  formData: ClientFormData;
  setFormData: (data: ClientFormData) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const user = useUser();
  const role = (user?.metadata?.role || "").toLowerCase();

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Basic Information */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="name" className="text-sm">
            Client Name *
          </Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter client name"
            required
            className="text-sm sm:text-base"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="email" className="text-sm">
            Email *
          </Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            placeholder="Enter email address"
            required
            className="text-sm sm:text-base"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="company" className="text-sm">
            Company
          </Label>
          <Input
            id="company"
            value={formData.company}
            onChange={(e) =>
              setFormData({ ...formData, company: e.target.value })
            }
            placeholder="Enter company name"
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

      {/* Contract Information */}
      <div className="border-t pt-3 sm:pt-4">
        <h3 className="text-sm sm:text-base font-medium mb-3 flex items-center gap-2">
          <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
          Contract Details
        </h3>
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
                  value: "standard" | "premium" | "enterprise" | "custom"
                ) => setFormData({ ...formData, contract_type: value })}
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
                  formData.contract_value === 0 ? "" : formData.contract_value
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
          </div>

          {/* Start Date */}
          <div className="space-y-1">
            <Label className="text-sm">Start Date</Label>
            <DatePicker
              value={
                formData.start_date ? new Date(formData.start_date) : undefined
              }
              onChange={(date) => {
                if (!date) return;
                const yyyy = date.getFullYear();
                const mm = String(date.getMonth() + 1).padStart(2, "0");
                const dd = String(date.getDate()).padStart(2, "0");
                const iso = `${yyyy}-${mm}-${dd}`;
                setFormData({ ...formData, start_date: iso });
              }}
              placeholder="Select start date"
            />
          </div>
        </div>
      </div>

      {/* Specifications and Requirements */}
      <div className="border-t pt-3 sm:pt-4">
        <h3 className="text-sm sm:text-base font-medium mb-3 flex items-center gap-2">
          <Building2 className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
          Project Specifications
        </h3>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="specifications" className="text-sm">
              Client Specifications
            </Label>
            <Textarea
              id="specifications"
              value={formData.specifications}
              onChange={(e) =>
                setFormData({ ...formData, specifications: e.target.value })
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
                  setFormData({ ...formData, requirements: e.target.value })
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
                <Label className="text-sm">Guideline Link (For Modelers)</Label>
                <Input
                  value={
                    (formData.client_guide_links &&
                      formData.client_guide_links[0]) ||
                    ""
                  }
                  onChange={(e) => {
                    const first = e.target.value;
                    const next = [...(formData.client_guide_links || [])];
                    if (next.length === 0) next.push(first);
                    else next[0] = first;
                    setFormData({ ...formData, client_guide_links: next });
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
                    value: "v6_aces" | "v5_tester" | "synsam" | "v2" | ""
                  ) => setFormData({ ...formData, viewer_type: value || null })}
                >
                  <SelectTrigger className="text-sm sm:text-base">
                    <SelectValue placeholder="Select a viewer type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="v6_aces">V6 ACES Tester</SelectItem>
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
        </div>
      </div>

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
          Save Client
        </Button>
      </div>
    </div>
  );
}

// Client View Component
function ClientView({ client }: { client: Client }) {
  const user = useUser();
  const role = (user?.metadata?.role || "").toLowerCase();
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Basic Information */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <div className="space-y-3 sm:space-y-4">
          <div>
            <h4 className="font-medium text-muted-foreground text-sm">
              Client Name
            </h4>
            <p className="text-base sm:text-lg">{client.name}</p>
          </div>
          <div>
            <h4 className="font-medium text-muted-foreground text-sm">Email</h4>
            <p className="text-sm sm:text-base break-all">{client.email}</p>
          </div>
          <div>
            <h4 className="font-medium text-muted-foreground text-sm">
              Company
            </h4>
            <p className="text-sm sm:text-base">{client.company || "N/A"}</p>
          </div>
          <div>
            <h4 className="font-medium text-muted-foreground text-sm">
              Status
            </h4>
            <Badge
              className={`${
                client.status === "active"
                  ? "bg-green-100 text-green-800"
                  : client.status === "inactive"
                    ? "bg-red-100 text-red-800"
                    : "bg-yellow-100 text-yellow-800"
              } text-xs`}
            >
              {client.status.charAt(0).toUpperCase() + client.status.slice(1)}
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
                client.contract_type === "premium"
                  ? "bg-purple-100 text-purple-800"
                  : client.contract_type === "enterprise"
                    ? "bg-blue-100 text-blue-800"
                    : client.contract_type === "custom"
                      ? "bg-orange-100 text-orange-800"
                      : "bg-gray-100 text-gray-800"
              } text-xs`}
            >
              {client.contract_type === "standard"
                ? "Small"
                : client.contract_type === "premium"
                  ? "Medium"
                  : client.contract_type === "enterprise"
                    ? "Big"
                    : "Custom"}
            </Badge>
          </div>
          <div>
            <h4 className="font-medium text-muted-foreground text-sm">
              Contract Value
            </h4>
            <p className="text-lg sm:text-2xl font-bold text-green-600">
              €{client.contract_value.toLocaleString()}
            </p>
          </div>

          <div>
            <h4 className="font-medium text-muted-foreground text-sm">
              Start Date
            </h4>
            <p className="text-sm sm:text-base">
              {new Date(client.start_date).toLocaleDateString()}
            </p>
          </div>
          {client.viewer_type && (
            <div>
              <h4 className="font-medium text-muted-foreground text-sm">
                Viewer Type
              </h4>
              <Badge
                className={`${
                  client.viewer_type === "v6_aces"
                    ? "bg-blue-100 text-blue-800"
                    : client.viewer_type === "v5_tester"
                      ? "bg-green-100 text-green-800"
                      : client.viewer_type === "synsam"
                        ? "bg-purple-100 text-purple-800"
                        : "bg-gray-100 text-gray-800"
                } text-xs`}
              >
                {client.viewer_type === "v6_aces"
                  ? "V6 ACES Tester"
                  : client.viewer_type === "v5_tester"
                    ? "V5 Tester"
                    : client.viewer_type === "synsam"
                      ? "Synsam"
                      : "V2 (Under Construction)"}
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Specifications, Guide and Requirements */}
      {(client.specifications ||
        client.requirements ||
        client.client_guide ||
        (role === "admin" && client.notes)) && (
        <div className="border-t pt-4 sm:pt-6">
          <h4 className="text-base sm:text-lg font-medium mb-3 sm:mb-4">
            Project Details
          </h4>
          <div className="space-y-3 sm:space-y-4">
            {client.specifications && (
              <div>
                <h5 className="font-medium text-muted-foreground mb-2 text-sm">
                  Client Specifications
                </h5>
                <div className="p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="whitespace-pre-wrap text-sm sm:text-base">
                    {client.specifications}
                  </p>
                </div>
              </div>
            )}
            {(client.client_guide ||
              (client.client_guide_links &&
                client.client_guide_links.length > 0)) && (
              <div>
                <h5 className="font-medium text-muted-foreground mb-2 text-sm">
                  Client Guide
                </h5>
                {client.client_guide && (
                  <div className="p-3 sm:p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="whitespace-pre-wrap text-sm sm:text-base">
                      {client.client_guide}
                    </p>
                  </div>
                )}
                {client.client_guide_links &&
                  client.client_guide_links.length > 0 && (
                    <ul className="list-disc pl-4 sm:pl-6 mt-2 sm:mt-3 space-y-1">
                      {client.client_guide_links.map((url, i) => (
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
            {client.requirements && (
              <div>
                <h5 className="font-medium text-muted-foreground mb-2 text-sm">
                  Project Requirements
                </h5>
                <div className="p-3 sm:p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="whitespace-pre-wrap text-sm sm:text-base">
                    {client.requirements}
                  </p>
                </div>
              </div>
            )}
            {role === "admin" && client.notes && (
              <div>
                <h5 className="font-medium text-muted-foreground mb-2 text-sm">
                  Additional Notes
                </h5>
                <div className="p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="whitespace-pre-wrap text-sm sm:text-base">
                    {client.notes}
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
            {new Date(client.created_at).toLocaleString()}
          </div>
          <div>
            <span className="font-medium">Last Updated:</span>{" "}
            {new Date(client.updated_at).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
