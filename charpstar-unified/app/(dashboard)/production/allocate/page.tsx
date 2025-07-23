"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import { Input } from "@/components/ui/inputs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/display";
import { Checkbox } from "@/components/ui/inputs";
import { Calendar } from "@/components/ui/utilities";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/interactive";
import { format } from "date-fns";
import {
  Search,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  Calendar as CalendarIcon,
  Euro,
  User,
  ShieldCheck,
  Package,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { notificationService } from "@/lib/notificationService";
import { toast } from "sonner";

interface UnallocatedAsset {
  id: string;
  product_name: string;
  article_id: string;
  product_link?: string;
  glb_link?: string;
  category: string;
  subcategory: string;
  client: string;
  priority: number;
  delivery_date: string;
  status: string;
}

interface User {
  id: string;
  email: string;
  title?: string;
  role: string;
}

interface AllocationData {
  assetId: string;
  modelerId: string;
  qaId: string;
  price: number;
  pricingOptionId: string;
}

interface GroupSettings {
  deadline: string;
  bonus: number;
}

interface PricingOption {
  id: string;
  label: string;
  price: number;
  description?: string;
}

// Predefined pricing options based on the pricing structure
const PRICING_OPTIONS: PricingOption[] = [
  {
    id: "pbr_3d_model",
    label: "PBR 3D Model Creation",
    price: 18,
    description: "Standard PBR 3D model creation",
  },
  {
    id: "hard_3d_model",
    label: "Hard 3D Models",
    price: 0,
    description:
      "Models that can take an extremely long time to complete (Vehicles, detailed electronics, etc.) - Price to be decided",
  },
  {
    id: "additional_colors",
    label: "Additional Colors",
    price: 1,
    description: "Additional colors for already made 3D models",
  },
  {
    id: "additional_textures",
    label: "Additional Textures/Materials",
    price: 5,
    description: "Additional textures/materials for already made 3D models",
  },
  {
    id: "additional_sizes",
    label: "Additional Sizes",
    price: 4,
    description: "Additional sizes for already made 3D models",
  },
];

// Future pricing options (after first list completion)
const FUTURE_PRICING_OPTIONS: PricingOption[] = [
  {
    id: "pbr_3d_model_future",
    label: "PBR 3D Model Creation (Future)",
    price: 30,
    description: "Standard PBR 3D model creation - Future pricing",
  },
  {
    id: "hard_3d_model_future",
    label: "Hard 3D Models (Future)",
    price: 0,
    description:
      "Models that can take an extremely long time to complete - Price to be decided",
  },
  {
    id: "additional_colors_future",
    label: "Additional Colors (Future)",
    price: 1.5,
    description:
      "Additional colors for already made 3D models - Future pricing",
  },
  {
    id: "additional_textures_future",
    label: "Additional Textures/Materials (Future)",
    price: 7,
    description:
      "Additional textures/materials for already made 3D models - Future pricing",
  },
  {
    id: "additional_sizes_future",
    label: "Additional Sizes (Future)",
    price: 5,
    description: "Additional sizes for already made 3D models - Future pricing",
  },
];

export default function AllocateAssetsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [assets, setAssets] = useState<UnallocatedAsset[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [allocationData, setAllocationData] = useState<AllocationData[]>([]);
  const [groupSettings, setGroupSettings] = useState<GroupSettings>({
    deadline: format(
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      "yyyy-MM-dd"
    ),
    bonus: 0,
  });
  const [pricingTier, setPricingTier] = useState<"first_list" | "future">(
    "first_list"
  );
  const [globalTeamAssignment, setGlobalTeamAssignment] = useState<{
    modelerId: string;
  }>({
    modelerId: "",
  });
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [clients, setClients] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  // Fetch unallocated assets
  const fetchUnallocatedAssets = useCallback(async () => {
    try {
      setLoading(true);

      // Get all assets that don't have accepted modeler assignments
      const { data: assignedAssets, error: assignmentError } = await supabase
        .from("asset_assignments")
        .select("asset_id")
        .eq("role", "modeler")
        .eq("status", "accepted");

      if (assignmentError) throw assignmentError;

      const assignedAssetIds = assignedAssets?.map((a) => a.asset_id) || [];

      // Get pre-selected assets from URL parameters
      const selectedAssetsParam = searchParams.getAll("selectedAssets");

      // Fetch unallocated assets
      let query = supabase
        .from("onboarding_assets")
        .select("*")
        .not("id", "in", `(${assignedAssetIds.join(",")})`);

      if (clientFilter !== "all") {
        query = query.eq("client", clientFilter);
      }

      if (categoryFilter !== "all") {
        query = query.eq("category", categoryFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      let allAssets = data || [];

      // If we have pre-selected assets that are already assigned, fetch them too
      if (selectedAssetsParam.length > 0) {
        const preSelectedAssetIds = selectedAssetsParam.filter(
          (id) => !assignedAssetIds.includes(id)
        );

        if (preSelectedAssetIds.length > 0) {
          const { data: preSelectedAssets, error: preSelectedError } =
            await supabase
              .from("onboarding_assets")
              .select("*")
              .in("id", preSelectedAssetIds);

          if (!preSelectedError && preSelectedAssets) {
            // Combine assets and remove duplicates based on ID
            const existingAssetIds = new Set(allAssets.map((a) => a.id));
            const uniquePreSelectedAssets = preSelectedAssets.filter(
              (asset) => !existingAssetIds.has(asset.id)
            );
            allAssets = [...allAssets, ...uniquePreSelectedAssets];
          }
        }
      }

      setAssets(allAssets);

      // Extract unique clients and categories
      const uniqueClients = [...new Set(allAssets?.map((a) => a.client) || [])];
      const uniqueCategories = [
        ...new Set(allAssets?.map((a) => a.category) || []),
      ];
      setClients(uniqueClients);
      setCategories(uniqueCategories);
    } catch (error) {
      console.error("Error fetching unallocated assets:", error);
      toast.error("Failed to fetch unallocated assets");
    } finally {
      setLoading(false);
    }
  }, [clientFilter, categoryFilter, searchParams]);

  // Fetch users (modelers and QA)
  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, title, role")
        .in("role", ["modeler", "qa"])
        .order("email");

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to fetch users");
    }
  };

  useEffect(() => {
    fetchUnallocatedAssets();
    fetchUsers();
  }, [fetchUnallocatedAssets]);

  // Check for pre-selected assets from admin-review page
  useEffect(() => {
    const selectedAssetsParam = searchParams.getAll("selectedAssets");
    if (selectedAssetsParam.length > 0) {
      // Set the selected assets from URL parameters
      setSelectedAssets(new Set(selectedAssetsParam));
      // Move to step 2 if we have pre-selected assets
      setStep(2);
    }
  }, [searchParams]);

  // Filter assets based on search term and ensure uniqueness
  const filteredAssets = assets
    .filter(
      (asset) =>
        asset.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.article_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.client.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter(
      (asset, index, self) => index === self.findIndex((a) => a.id === asset.id)
    );

  // Handle asset selection
  const handleAssetSelect = (assetId: string, checked: boolean) => {
    const newSelected = new Set(selectedAssets);
    if (checked) {
      newSelected.add(assetId);
    } else {
      newSelected.delete(assetId);
    }
    setSelectedAssets(newSelected);
  };

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedAssets(new Set(filteredAssets.map((a) => a.id)));
    } else {
      setSelectedAssets(new Set());
    }
  };

  // Initialize allocation data for selected assets
  const initializeAllocationData = () => {
    const modelers = users.filter((u) => u.role === "modeler");
    const qaUsers = users.filter((u) => u.role === "qa");

    // Set global team assignment defaults
    if (modelers.length > 0 && !globalTeamAssignment.modelerId) {
      setGlobalTeamAssignment((prev) => ({
        ...prev,
        modelerId: modelers[0].id,
      }));
    }

    const data: AllocationData[] = Array.from(selectedAssets).map(
      (assetId) => ({
        assetId,
        modelerId:
          globalTeamAssignment.modelerId ||
          (modelers.length > 0 ? modelers[0].id : ""),
        qaId: "", // QA will be implemented in next phase
        price: 0,
        pricingOptionId: "pbr_3d_model", // Default to PBR 3D Model Creation
      })
    );

    setAllocationData(data);
  };

  // Initialize allocation data when users are loaded and we have pre-selected assets
  useEffect(() => {
    if (
      users.length > 0 &&
      selectedAssets.size > 0 &&
      allocationData.length === 0
    ) {
      initializeAllocationData();
    }
  }, [users, selectedAssets, allocationData.length]);

  // Handle next step
  const handleNextStep = () => {
    if (step === 1) {
      if (selectedAssets.size === 0) {
        toast.error("Please select at least one asset");
        return;
      }
      initializeAllocationData();
      setStep(2);
    } else if (step === 2) {
      // Validate that global team assignment is complete
      if (!globalTeamAssignment.modelerId) {
        toast.error("Please assign a modeler for all assets");
        return;
      }
      setStep(3);
    }
  };

  // Handle back to previous step
  const handleBackStep = () => {
    if (step === 2) {
      setStep(1);
      setAllocationData([]);
    } else if (step === 3) {
      setStep(2);
    }
  };

  // Update allocation data
  const updateAllocationData = (
    assetId: string,
    field: keyof AllocationData,
    value: any
  ) => {
    setAllocationData((prev) =>
      prev.map((item) =>
        item.assetId === assetId ? { ...item, [field]: value } : item
      )
    );
  };

  // Update global team assignment and apply to all assets
  const updateGlobalTeamAssignment = (value: string) => {
    setGlobalTeamAssignment((prev) => ({ ...prev, modelerId: value }));

    // Apply the change to all assets
    setAllocationData((prev) =>
      prev.map((item) => ({ ...item, modelerId: value }))
    );
  };

  // Handle allocation
  const handleAllocate = async () => {
    try {
      setLoading(true);

      // Validate that a modeler is selected
      if (!globalTeamAssignment.modelerId) {
        toast.error("Please select a modeler for the asset group");
        return;
      }

      // Validate group settings and individual prices
      if (!groupSettings.deadline) {
        toast.error("Please set deadline for the asset group");
        return;
      }

      const hasInvalidPrices = allocationData.some((data) => data.price <= 0);
      if (hasInvalidPrices) {
        toast.error("Please set a valid price for all assets");
        return;
      }

      const hasMissingPricingOptions = allocationData.some(
        (data) => !data.pricingOptionId
      );
      if (hasMissingPricingOptions) {
        toast.error("Please select pricing options for all assets");
        return;
      }

      // Check for existing assignments to prevent duplicates
      const assetIds = allocationData.map((data) => data.assetId);
      const { data: existingAssignments, error: checkError } = await supabase
        .from("asset_assignments")
        .select("asset_id, user_id, role, status")
        .in("asset_id", assetIds)
        .eq("role", "modeler");

      if (checkError) throw checkError;

      // Filter out assets that already have assignments
      const existingAssetIds = new Set(
        existingAssignments?.map((a) => a.asset_id) || []
      );
      const assetsToAllocate = allocationData.filter(
        (data) => !existingAssetIds.has(data.assetId)
      );

      if (assetsToAllocate.length === 0) {
        toast.error("All selected assets are already assigned");
        return;
      }

      if (assetsToAllocate.length < allocationData.length) {
        const alreadyAssignedCount =
          allocationData.length - assetsToAllocate.length;
        toast.warning(
          `${alreadyAssignedCount} asset(s) are already assigned and will be skipped`
        );
      }

      // Create asset assignments using global team assignment
      const assignments = assetsToAllocate.map((data) => ({
        asset_id: data.assetId,
        user_id: globalTeamAssignment.modelerId,
        role: "modeler",
        start_time: new Date().toISOString(),
        deadline: groupSettings.deadline,
        price: data.price,
        bonus: groupSettings.bonus,
        status: "pending", // Explicitly set pending status
      }));

      const { data: createdAssignments, error: assignmentError } =
        await supabase.from("asset_assignments").insert(assignments).select();

      if (assignmentError) throw assignmentError;

      // Note: Asset status will be updated to "in_production" only when modeler accepts
      // For now, assets remain in their current status until accepted

      // Send notifications to modelers
      try {
        // Group allocations by modeler to send consolidated notifications
        const modelerAllocations = new Map<
          string,
          {
            modelerId: string;
            modelerEmail: string;
            assetIds: string[];
            assetNames: string[];
            client: string;
          }
        >();

        // Group assets by modeler using global team assignment (only for actually allocated assets)
        assetsToAllocate.forEach((data) => {
          const asset = getAssetById(data.assetId);
          if (!asset) return;

          const modeler = users.find(
            (u) => u.id === globalTeamAssignment.modelerId
          );
          if (!modeler) return;

          if (!modelerAllocations.has(globalTeamAssignment.modelerId)) {
            modelerAllocations.set(globalTeamAssignment.modelerId, {
              modelerId: globalTeamAssignment.modelerId,
              modelerEmail: modeler.email,
              assetIds: [],
              assetNames: [],
              client: asset.client,
            });
          }

          const allocation = modelerAllocations.get(
            globalTeamAssignment.modelerId
          )!;
          allocation.assetIds.push(data.assetId);
          allocation.assetNames.push(asset.product_name);
        });

        // Send notifications to each modeler
        const notificationPromises = Array.from(
          modelerAllocations.values()
        ).map((allocation) =>
          notificationService.sendAssetAllocationNotification({
            modelerId: allocation.modelerId,
            modelerEmail: allocation.modelerEmail,
            assetIds: allocation.assetIds,
            assetNames: allocation.assetNames,
            deadline: groupSettings.deadline,
            price:
              allocationData.find((d) => d.assetId === allocation.assetIds[0])
                ?.price || 0,
            bonus: groupSettings.bonus,
            client: allocation.client,
          })
        );

        await Promise.all(notificationPromises);
      } catch (notificationError) {
        console.error("Failed to send notifications:", notificationError);
        // Don't fail the allocation process if notifications fail
      }

      toast.success(
        `Successfully allocated ${assetsToAllocate.length} assets and sent notifications`
      );
      setSelectedAssets(new Set());
      setAllocationData([]);
      setGroupSettings({
        deadline: format(
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          "yyyy-MM-dd"
        ),
        bonus: 0,
      });
      setStep(1);
      fetchUnallocatedAssets(); // Refresh the list
    } catch (error) {
      console.error("Error allocating assets:", error);
      toast.error("Failed to allocate assets");
    } finally {
      setLoading(false);
    }
  };

  const getAssetById = (id: string) => {
    // First try to find in current assets
    const asset = assets.find((a) => a.id === id);
    if (asset) return asset;

    // If not found, it might be a pre-selected asset from admin-review
    // We'll need to fetch it or handle it differently
    return null;
  };

  const getCurrentPricingOptions = () => {
    return pricingTier === "first_list"
      ? PRICING_OPTIONS
      : FUTURE_PRICING_OPTIONS;
  };

  const getPricingOptionById = (id: string) => {
    const options = getCurrentPricingOptions();
    return options.find((option) => option.id === id);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {searchParams.getAll("selectedAssets").length > 0
              ? "Assign Selected Assets"
              : "Allocate Assets"}
          </h1>
          <p className="text-muted-foreground">
            {step === 1
              ? "Step 1: Select assets to allocate"
              : step === 2
                ? "Step 2: Assign modelers and QA to assets"
                : "Step 3: Set pricing and deadline for the asset group"}
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/production")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Production
        </Button>
      </div>

      {/* Step indicator */}
      <div className="flex items-center space-x-4">
        <div
          className={`flex items-center space-x-2 ${step >= 1 ? "text-primary" : "text-muted-foreground"}`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            1
          </div>
          <span>Select Assets</span>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <div
          className={`flex items-center space-x-2 ${step >= 2 ? "text-primary" : "text-muted-foreground"}`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            2
          </div>
          <span>Assign Modeler</span>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <div
          className={`flex items-center space-x-2 ${step >= 3 ? "text-primary" : "text-muted-foreground"}`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            3
          </div>
          <span>Set Pricing & Deadline</span>
        </div>
      </div>

      {/* Pre-selected assets indicator */}
      {searchParams.getAll("selectedAssets").length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">
              Pre-selected {selectedAssets.size} assets from Admin Review
            </span>
          </div>
          <p className="text-sm text-blue-600 mt-1">
            These assets have been automatically selected and you can proceed
            directly to team assignment.
          </p>
        </div>
      )}

      {step === 1 ? (
        /* Step 1: Asset Selection */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>
                {searchParams.getAll("selectedAssets").length > 0
                  ? `Selected Assets (${selectedAssets.size})`
                  : `Available Assets (${filteredAssets.length})`}
              </span>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchTerm("");
                    setClientFilter("all");
                    setCategoryFilter("all");
                  }}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
                <Button
                  onClick={handleNextStep}
                  disabled={selectedAssets.size === 0}
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Next: Assign Team ({selectedAssets.size})
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex items-center space-x-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search assets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client} value={client}>
                      {client}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Assets Table */}
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Loading assets...</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          selectedAssets.size === filteredAssets.length &&
                          filteredAssets.length > 0
                        }
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Article ID</TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Subcategory</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssets.map((asset) => (
                    <TableRow key={asset.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedAssets.has(asset.id)}
                          onCheckedChange={(checked) =>
                            handleAssetSelect(asset.id, checked as boolean)
                          }
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {asset.article_id}
                      </TableCell>
                      <TableCell className="font-medium">
                        {asset.product_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{asset.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{asset.subcategory}</Badge>
                      </TableCell>
                      <TableCell>{asset.client}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            asset.priority === 1
                              ? "destructive"
                              : asset.priority === 2
                                ? "default"
                                : "secondary"
                          }
                        >
                          P{asset.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{asset.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          {asset.product_link && (
                            <a
                              href={asset.product_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8 p-0"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                          {asset.glb_link && (
                            <a
                              href={asset.glb_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8 p-0"
                            >
                              <Package className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {filteredAssets.length === 0 && !loading && (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchParams.getAll("selectedAssets").length > 0
                    ? "No assets found matching your selection"
                    : "No available assets found"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : step === 2 ? (
        /* Step 2: Team Assignment */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Assign Modeler to All Assets</span>
              <div className="flex items-center space-x-2">
                <Button variant="outline" onClick={handleBackStep}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Selection
                </Button>
                <Button onClick={handleNextStep} disabled={loading}>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Next: Set Pricing
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Global Team Assignment */}
              <div className="grid grid-cols-1 gap-6">
                {/* Modeler Assignment */}
                <div className="space-y-3">
                  <label className="text-sm font-medium flex items-center">
                    <User className="h-4 w-4 mr-2" />
                    Modeler
                  </label>
                  <Select
                    value={globalTeamAssignment.modelerId}
                    onValueChange={(value) => updateGlobalTeamAssignment(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose modeler" />
                    </SelectTrigger>
                    <SelectContent>
                      {users
                        .filter((u) => u.role === "modeler")
                        .map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.email}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Assets Summary */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium mb-4">
                  Assets to be assigned ({selectedAssets.size})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {allocationData.map((data) => {
                    const asset = getAssetById(data.assetId);
                    if (!asset) return null;

                    return (
                      <Card key={data.assetId} className="p-3">
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm">
                            {asset.product_name}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {asset.article_id}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {asset.category}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {asset.client}
                            </Badge>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Step 3: Group Pricing */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Set Pricing & Deadline for Asset Group</span>
              <div className="flex items-center space-x-2">
                <Button variant="outline" onClick={handleBackStep}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Team Assignment
                </Button>
                <Button
                  onClick={handleAllocate}
                  disabled={
                    loading ||
                    !globalTeamAssignment.modelerId ||
                    !groupSettings.deadline ||
                    allocationData.some((data) => data.price <= 0) ||
                    allocationData.some((data) => !data.pricingOptionId)
                  }
                >
                  Allocate & Notify
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Group Settings */}
            <div className="space-y-6">
              {/* Pricing Tier Selection */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Pricing Tier</label>
                <Select
                  value={pricingTier}
                  onValueChange={(value: "first_list" | "future") =>
                    setPricingTier(value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select pricing tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="first_list">
                      First List Pricing
                    </SelectItem>
                    <SelectItem value="future">
                      Future Models Pricing
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {pricingTier === "first_list"
                    ? "Standard pricing for the first list of models"
                    : "Pricing for all future models after completing the first list"}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Deadline */}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Deadline
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(new Date(groupSettings.deadline), "PPP")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={new Date(groupSettings.deadline)}
                        onSelect={(date) => {
                          setGroupSettings((prev) => ({
                            ...prev,
                            deadline: date
                              ? format(date, "yyyy-MM-dd")
                              : prev.deadline,
                          }));
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Bonus */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Bonus %</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={groupSettings.bonus}
                    onChange={(e) =>
                      setGroupSettings((prev) => ({
                        ...prev,
                        bonus: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </div>

              {/* Individual Asset Pricing */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Asset Pricing</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {allocationData.map((data) => {
                    const asset = getAssetById(data.assetId);
                    if (!asset) return null;
                    return (
                      <Card key={data.assetId} className="p-4">
                        <div className="space-y-3">
                          <div>
                            <p className="font-medium text-sm">
                              {asset.product_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {asset.article_id}
                            </p>
                            <Badge variant="outline" className="text-xs mt-1">
                              {asset.category}
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center">
                              <Euro className="h-4 w-4 mr-2" />
                              Pricing Option
                            </label>
                            <Select
                              value={data.pricingOptionId}
                              onValueChange={(value) => {
                                const option = getPricingOptionById(value);
                                updateAllocationData(
                                  data.assetId,
                                  "pricingOptionId",
                                  value
                                );
                                updateAllocationData(
                                  data.assetId,
                                  "price",
                                  option?.price || 0
                                );
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select pricing option" />
                              </SelectTrigger>
                              <SelectContent>
                                {getCurrentPricingOptions().map((option) => (
                                  <SelectItem key={option.id} value={option.id}>
                                    {option.label} - €{option.price}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {data.pricingOptionId === "hard_3d_model" ||
                            data.pricingOptionId === "hard_3d_model_future" ? (
                              <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center">
                                  <Euro className="h-4 w-4 mr-2" />
                                  Custom Price (€)
                                </label>
                                <Input
                                  type="number"
                                  placeholder="Enter custom price"
                                  value={data.price}
                                  onChange={(e) =>
                                    updateAllocationData(
                                      data.assetId,
                                      "price",
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                />
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                Price: €{data.price}
                              </p>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>

              {/* Summary */}
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Summary</h4>
                <div className="space-y-1 text-sm">
                  <p>Total Assets: {selectedAssets.size}</p>
                  <p>
                    Total Price: €
                    {allocationData.reduce((sum, data) => sum + data.price, 0)}
                  </p>
                  <p>
                    Average Price: €
                    {(
                      allocationData.reduce(
                        (sum, data) => sum + data.price,
                        0
                      ) / selectedAssets.size
                    ).toFixed(2)}
                  </p>
                  <p>Bonus: {groupSettings.bonus}%</p>
                  <p>
                    Deadline: {format(new Date(groupSettings.deadline), "PPP")}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
