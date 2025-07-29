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

import { Calendar } from "@/components/ui/utilities";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/interactive";
import { format } from "date-fns";
import {
  ArrowLeft,
  ArrowRight,
  Calendar as CalendarIcon,
  Euro,
  User,
  Package,
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
    id: "pbr_3d_model_future",
    label: "PBR 3D Model Creation (Future)",
    price: 15,
    description: "PBR 3D model creation for future models",
  },
  {
    id: "hard_3d_model",
    label: "Hard Surface 3D Model",
    price: 0, // Custom price
    description: "Hard surface 3D model with custom pricing",
  },
  {
    id: "hard_3d_model_future",
    label: "Hard Surface 3D Model (Future)",
    price: 0, // Custom price
    description: "Hard surface 3D model for future models with custom pricing",
  },
  {
    id: "texture_creation",
    label: "Texture Creation",
    price: 8,
    description: "Texture creation for existing models",
  },
  {
    id: "texture_creation_future",
    label: "Texture Creation (Future)",
    price: 6,
    description: "Texture creation for future models",
  },
  {
    id: "uv_unwrapping",
    label: "UV Unwrapping",
    price: 5,
    description: "UV unwrapping for existing models",
  },
  {
    id: "uv_unwrapping_future",
    label: "UV Unwrapping (Future)",
    price: 4,
    description: "UV unwrapping for future models",
  },
  {
    id: "retopology",
    label: "Retopology",
    price: 12,
    description: "Retopology for existing models",
  },
  {
    id: "retopology_future",
    label: "Retopology (Future)",
    price: 10,
    description: "Retopology for future models",
  },
];

export default function AllocateAssetsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<1 | 2>(1);
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
    qaId: string;
  }>({
    modelerId: "",
    qaId: "",
  });
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

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
      const { data, error } = await supabase
        .from("onboarding_assets")
        .select("*")
        .not("id", "in", `(${assignedAssetIds.join(",")})`);

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
    } catch (error) {
      console.error("Error fetching unallocated assets:", error);
      toast.error("Failed to fetch assets");
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  // Fetch users
  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, title, role")
        .in("role", ["modeler", "qa"]);

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
      // Start with step 1 (team assignment) if we have pre-selected assets
      setStep(1);
    }
  }, [searchParams]);

  // Initialize allocation data for selected assets
  const initializeAllocationData = () => {
    const modelers = users.filter((u) => u.role === "modeler");
    const qas = users.filter((u) => u.role === "qa");

    // Set global team assignment defaults
    if (modelers.length > 0 && !globalTeamAssignment.modelerId) {
      setGlobalTeamAssignment((prev) => ({
        ...prev,
        modelerId: modelers[0].id,
      }));
    }
    if (qas.length > 0 && !globalTeamAssignment.qaId) {
      setGlobalTeamAssignment((prev) => ({
        ...prev,
        qaId: qas[0].id,
      }));
    }

    const data: AllocationData[] = Array.from(selectedAssets).map(
      (assetId) => ({
        assetId,
        modelerId:
          globalTeamAssignment.modelerId ||
          (modelers.length > 0 ? modelers[0].id : ""),
        qaId: globalTeamAssignment.qaId || (qas.length > 0 ? qas[0].id : ""),
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
  }, [users, selectedAssets, allocationData.length, initializeAllocationData]);

  // Handle next step
  const handleNextStep = () => {
    if (step === 1) {
      // Validate that global team assignment is complete
      if (!globalTeamAssignment.modelerId || !globalTeamAssignment.qaId) {
        toast.error("Please assign both a modeler and a QA for all assets");
        return;
      }
      setStep(2);
    }
  };

  // Handle back to previous step
  const handleBackStep = () => {
    if (step === 2) {
      setStep(1);
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
  const updateGlobalTeamAssignment = (
    field: "modelerId" | "qaId",
    value: string
  ) => {
    setGlobalTeamAssignment((prev) => ({ ...prev, [field]: value }));

    // Apply the change to all assets
    setAllocationData((prev) =>
      prev.map((item) => ({ ...item, [field]: value }))
    );
  };

  // Handle allocation
  const handleAllocate = async () => {
    try {
      setLoading(true);

      // Validate that a modeler is selected
      if (!globalTeamAssignment.modelerId || !globalTeamAssignment.qaId) {
        toast.error(
          "Please select both a modeler and a QA for the asset group"
        );
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

      // Create allocation list using the new API
      const response = await fetch("/api/assets/assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assetIds: assetsToAllocate.map((data) => data.assetId),
          userIds: [globalTeamAssignment.modelerId],
          role: "modeler",
          deadline: new Date(
            groupSettings.deadline + "T00:00:00.000Z"
          ).toISOString(),
          bonus: groupSettings.bonus,
          allocationName: `Allocation ${new Date().toISOString().split("T")[0]} - ${assetsToAllocate.length} assets`,
          prices: assetsToAllocate.reduce(
            (acc, data) => {
              acc[data.assetId] = data.price;
              return acc;
            },
            {} as Record<string, number>
          ),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create allocation");
      }

      const result = await response.json();

      // Assign QA to the same assets
      const qaResponse = await fetch("/api/assets/assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assetIds: assetsToAllocate.map((data) => data.assetId),
          userIds: [globalTeamAssignment.qaId],
          role: "qa",
          deadline: new Date(
            groupSettings.deadline + "T00:00:00.000Z"
          ).toISOString(),
          bonus: 0, // QA doesn't get bonus
          allocationName: `QA Allocation ${new Date().toISOString().split("T")[0]} - ${assetsToAllocate.length} assets`,
          prices: {}, // QA doesn't have pricing
        }),
      });

      if (!qaResponse.ok) {
        const qaErrorData = await qaResponse.json();
        console.error("QA assignment failed:", qaErrorData);
        // Don't fail the entire process if QA assignment fails
        toast.warning(
          "Modeler assigned successfully, but QA assignment failed"
        );
      }

      // Send notifications to assigned modelers and QA
      try {
        const modeler = users.find(
          (u) => u.id === globalTeamAssignment.modelerId
        );
        const qa = users.find((u) => u.id === globalTeamAssignment.qaId);

        if (modeler) {
          const assetDetails = assetsToAllocate.map((data) => {
            const asset = getAssetById(data.assetId);
            return asset?.product_name || data.assetId;
          });

          await notificationService.sendAssetAllocationNotification({
            modelerId: globalTeamAssignment.modelerId,
            modelerEmail: modeler.email,
            assetIds: assetsToAllocate.map((data) => data.assetId),
            assetNames: assetDetails,
            deadline: new Date(
              groupSettings.deadline + "T00:00:00.000Z"
            ).toISOString(),
            price: assetsToAllocate.reduce((sum, data) => sum + data.price, 0),
            bonus: groupSettings.bonus,
            client:
              getAssetById(assetsToAllocate[0].assetId)?.client || "Unknown",
          });
        }

        if (qa) {
          const assetDetails = assetsToAllocate.map((data) => {
            const asset = getAssetById(data.assetId);
            return asset?.product_name || data.assetId;
          });

          await notificationService.sendAssetAllocationNotification({
            modelerId: globalTeamAssignment.qaId,
            modelerEmail: qa.email,
            assetIds: assetsToAllocate.map((data) => data.assetId),
            assetNames: assetDetails,
            deadline: new Date(
              groupSettings.deadline + "T00:00:00.000Z"
            ).toISOString(),
            price: 0, // QA doesn't get paid for review
            bonus: 0, // QA doesn't get bonus
            client:
              getAssetById(assetsToAllocate[0].assetId)?.client || "Unknown",
          });
        }
      } catch (notificationError) {
        console.error("Failed to send notifications:", notificationError);
        // Don't fail the allocation process if notifications fail
      }

      toast.success(result.message);

      // Redirect to production page
      router.push("/production");
    } catch (error) {
      console.error("Error allocating assets:", error);
      toast.error("Failed to allocate assets");
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get asset by ID
  const getAssetById = (id: string) => {
    return assets.find((asset) => asset.id === id);
  };

  // Get current pricing options based on tier
  const getCurrentPricingOptions = () => {
    return PRICING_OPTIONS.filter((option) =>
      pricingTier === "first_list"
        ? !option.id.includes("_future")
        : option.id.includes("_future")
    );
  };

  // Get pricing option by ID
  const getPricingOptionById = (id: string) => {
    const options = getCurrentPricingOptions();
    return options.find((option) => option.id === id);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/production")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Production
          </Button>
        </div>
        <div className="flex items-center gap-3 mb-2">
          <Package className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">
            {searchParams.getAll("selectedAssets").length > 0
              ? "Assign Selected Assets"
              : "Allocate Assets"}
          </h1>
        </div>
        <div className="flex items-center gap-4 text-muted-foreground">
          <p>
            {step === 1
              ? "Assign modelers to selected assets"
              : "Set pricing and deadline for the asset group"}
          </p>
          {selectedAssets.size > 0 && (
            <Badge variant="outline" className="text-sm">
              {selectedAssets.size} assets selected
            </Badge>
          )}
        </div>
      </div>

      {/* Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          className={`p-4 transition-all duration-200 ${step >= 1 ? "ring-2 ring-primary/20 bg-primary/5" : "bg-muted/50"}`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${step >= 1 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
            >
              <User className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">Step 1: Assign Team</p>
              <p className="text-xs text-muted-foreground">
                {globalTeamAssignment.modelerId && globalTeamAssignment.qaId
                  ? "Modeler and QA assigned"
                  : globalTeamAssignment.modelerId
                    ? "Modeler assigned, QA needed"
                    : globalTeamAssignment.qaId
                      ? "QA assigned, modeler needed"
                      : "No assignments"}
              </p>
            </div>
          </div>
        </Card>

        <Card
          className={`p-4 transition-all duration-200 ${step >= 2 ? "ring-2 ring-primary/20 bg-primary/5" : "bg-muted/50"}`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${step >= 2 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
            >
              <Euro className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">Step 2: Pricing & Deadline</p>
              <p className="text-xs text-muted-foreground">
                {groupSettings.deadline ? "Deadline set" : "No deadline set"}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {step === 1 ? (
        /* Step 1: Team Assignment */
        <Card>
          <CardHeader>
            <CardTitle>Assign Modeler & QA to All Assets</CardTitle>
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
                    onValueChange={(value) =>
                      updateGlobalTeamAssignment("modelerId", value)
                    }
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
                {/* QA Assignment */}
                <div className="space-y-3">
                  <label className="text-sm font-medium flex items-center">
                    <User className="h-4 w-4 mr-2" />
                    QA
                  </label>
                  <Select
                    value={globalTeamAssignment.qaId}
                    onValueChange={(value) =>
                      updateGlobalTeamAssignment("qaId", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose QA" />
                    </SelectTrigger>
                    <SelectContent>
                      {users
                        .filter((u) => u.role === "qa")
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

              {/* Step Navigation */}
              <div className="flex items-center justify-between pt-6 border-t mt-6">
                <div className="text-sm text-muted-foreground">
                  {globalTeamAssignment.modelerId &&
                  globalTeamAssignment.qaId ? (
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Modeler and QA assigned
                    </span>
                  ) : (
                    "Select both a modeler and a QA to continue"
                  )}
                </div>
                <Button
                  onClick={handleNextStep}
                  disabled={
                    !globalTeamAssignment.modelerId ||
                    !globalTeamAssignment.qaId
                  }
                  className="flex items-center gap-2"
                >
                  <ArrowRight className="h-4 w-4" />
                  Continue to Pricing
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Step 2: Group Pricing */
        <Card>
          <CardHeader>
            <CardTitle>Set Pricing & Deadline for Asset Group</CardTitle>
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
                            deadline: format(date || new Date(), "yyyy-MM-dd"),
                          }));
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Bonus */}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center">
                    <Euro className="h-4 w-4 mr-2" />
                    Bonus (%)
                  </label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={groupSettings.bonus}
                    onChange={(e) =>
                      setGroupSettings((prev) => ({
                        ...prev,
                        bonus: parseInt(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </div>

              {/* Individual Asset Pricing */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium mb-4">
                  Individual Asset Pricing
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {allocationData.map((data) => {
                    const asset = getAssetById(data.assetId);
                    if (!asset) return null;

                    return (
                      <Card key={data.assetId} className="p-4">
                        <div className="space-y-4">
                          <div>
                            <h4 className="font-medium text-sm">
                              {asset.product_name}
                            </h4>
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

              {/* Step Navigation */}
              <div className="flex items-center justify-between pt-6 border-t mt-6">
                <Button
                  variant="outline"
                  onClick={handleBackStep}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Team Assignment
                </Button>
                <div className="text-sm text-muted-foreground">
                  {groupSettings.deadline &&
                  allocationData.every((data) => data.price > 0) ? (
                    <span className="flex items-center gap-2">
                      <Euro className="h-4 w-4" />
                      Ready to allocate
                    </span>
                  ) : (
                    "Complete pricing and deadline to continue"
                  )}
                </div>
                <Button
                  onClick={handleAllocate}
                  disabled={
                    loading ||
                    !globalTeamAssignment.modelerId ||
                    !globalTeamAssignment.qaId ||
                    !groupSettings.deadline ||
                    allocationData.some((data) => data.price <= 0) ||
                    allocationData.some((data) => !data.pricingOptionId)
                  }
                  className="flex items-center gap-2"
                >
                  <Package className="h-4 w-4" />
                  Allocate & Notify
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
