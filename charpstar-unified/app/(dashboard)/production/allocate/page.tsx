"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
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
  ShieldCheck,
  AlertTriangle,
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

interface AssetFileHistory {
  assetId: string;
  previousModelerId: string;
  previousModelerName: string;
  files: {
    glb_link?: string;
    reference?: string[];
    other_files?: string[];
  };
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
  const [allocating, setAllocating] = useState(false);
  const [fetchingDefaultQA, setFetchingDefaultQA] = useState(false);
  const [noDefaultQA, setNoDefaultQA] = useState(false);
  const [allocationData, setAllocationData] = useState<AllocationData[]>([]);
  const [selectedForPricing, setSelectedForPricing] = useState<Set<string>>(
    new Set()
  );
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
  const [assetFileHistory, setAssetFileHistory] = useState<AssetFileHistory[]>(
    []
  );
  const [existingAssignments, setExistingAssignments] = useState<any[]>([]);

  // Ref to prevent infinite loops when updating pricing
  const isUpdatingPricing = useRef(false);

  // Add new assets to allocation data with correct pricing
  const addAssetsToAllocation = useCallback(
    (newAssetIds: string[]) => {
      if (newAssetIds.length === 0) return;

      const modelers = users.filter((u) => u.role === "modeler");
      const qas = users.filter((u) => u.role === "qa");

      // Get default pricing based on current pricing tier
      const defaultPricingOption =
        pricingTier === "future" ? "pbr_3d_model_future" : "pbr_3d_model";
      const defaultPrice = pricingTier === "future" ? 15 : 18;

      const newAllocationData: AllocationData[] = newAssetIds.map(
        (assetId) => ({
          assetId,
          modelerId:
            globalTeamAssignment.modelerId ||
            (modelers.length > 0 ? modelers[0].id : ""),
          qaId: globalTeamAssignment.qaId || (qas.length > 0 ? qas[0].id : ""),
          price: defaultPrice,
          pricingOptionId: defaultPricingOption,
        })
      );

      setAllocationData((prev) => [...prev, ...newAllocationData]);
    },
    [users, globalTeamAssignment, pricingTier]
  );

  // Update pricing when pricing tier changes
  const updatePricingForTierChange = useCallback(
    (newPricingTier: "first_list" | "future") => {
      if (allocationData.length === 0 || isUpdatingPricing.current) return;

      isUpdatingPricing.current = true;

      const updatedData = allocationData.map((item) => {
        let newPricingOptionId = item.pricingOptionId;
        let newPrice = item.price;

        // Define pricing mappings for all product types
        const pricingMappings: Record<
          string,
          {
            future: string;
            first_list: string;
            futurePrice: number;
            firstListPrice: number;
          }
        > = {
          // PBR 3D Model
          pbr_3d_model: {
            future: "pbr_3d_model_future",
            first_list: "pbr_3d_model",
            futurePrice: 15,
            firstListPrice: 18,
          },
          pbr_3d_model_future: {
            future: "pbr_3d_model_future",
            first_list: "pbr_3d_model",
            futurePrice: 15,
            firstListPrice: 18,
          },

          // Hard Surface 3D Model
          hard_3d_model: {
            future: "hard_3d_model_future",
            first_list: "hard_3d_model",
            futurePrice: 0,
            firstListPrice: 0,
          }, // Custom pricing
          hard_3d_model_future: {
            future: "hard_3d_model_future",
            first_list: "hard_3d_model",
            futurePrice: 0,
            firstListPrice: 0,
          }, // Custom pricing

          // Texture Creation
          texture_creation: {
            future: "texture_creation_future",
            first_list: "texture_creation",
            futurePrice: 6,
            firstListPrice: 8,
          },
          texture_creation_future: {
            future: "texture_creation_future",
            first_list: "texture_creation",
            futurePrice: 6,
            firstListPrice: 8,
          },

          // UV Unwrapping
          uv_unwrapping: {
            future: "uv_unwrapping_future",
            first_list: "uv_unwrapping",
            futurePrice: 4,
            firstListPrice: 5,
          },
          uv_unwrapping_future: {
            future: "uv_unwrapping_future",
            first_list: "uv_unwrapping",
            futurePrice: 4,
            firstListPrice: 5,
          },

          // Retopology
          retopology: {
            future: "retopology_future",
            first_list: "retopology",
            futurePrice: 10,
            firstListPrice: 12,
          },
          retopology_future: {
            future: "retopology_future",
            first_list: "retopology",
            futurePrice: 10,
            firstListPrice: 12,
          },
        };

        const mapping = pricingMappings[item.pricingOptionId];

        if (mapping) {
          if (newPricingTier === "future") {
            newPricingOptionId = mapping.future;
            newPrice = mapping.futurePrice;
          } else if (newPricingTier === "first_list") {
            newPricingOptionId = mapping.first_list;
            newPrice = mapping.firstListPrice;
          }
        }

        return {
          ...item,
          pricingOptionId: newPricingOptionId,
          price: newPrice,
        };
      });

      setAllocationData(updatedData);

      // Reset the guard after a short delay to allow state to settle
      setTimeout(() => {
        isUpdatingPricing.current = false;
      }, 100);
    },
    [allocationData]
  );

  // Check if modeler has completed their first list and set pricing tier accordingly
  const checkModelerPricingTier = useCallback(async (modelerId: string) => {
    if (!modelerId) return;

    try {
      // First, get all allocation list IDs for this modeler
      const { data: modelerAssignments, error: assignmentError } =
        await supabase
          .from("asset_assignments")
          .select("allocation_list_id")
          .eq("user_id", modelerId)
          .eq("role", "modeler")
          .not("allocation_list_id", "is", null);

      if (assignmentError) {
        console.error("Error fetching modeler assignments:", assignmentError);
        return;
      }

      if (!modelerAssignments || modelerAssignments.length === 0) {
        setPricingTier("first_list");
        return;
      }

      // Extract allocation list IDs
      const allocationListIds = modelerAssignments
        .map((assignment) => assignment.allocation_list_id)
        .filter(Boolean);

      if (allocationListIds.length === 0) {
        setPricingTier("first_list");
        return;
      }

      // Check if any of these allocation lists are completed
      const { data: completedLists, error } = await supabase
        .from("allocation_lists")
        .select("id, status")
        .eq("status", "approved")
        .in("id", allocationListIds);

      if (error) {
        console.error("Error checking allocation list status:", error);
        return;
      }

      // If the modeler has completed at least one allocation list, set pricing to future
      if (completedLists && completedLists.length > 0) {
        setPricingTier("future");
      } else {
        setPricingTier("first_list");
      }
    } catch (error) {
      console.error("Error checking modeler pricing tier:", error);
    }
  }, []);

  // Fetch unallocated assets
  const fetchUnallocatedAssets = useCallback(async () => {
    try {
      setLoading(true);

      // Get pre-selected assets from URL parameters
      const selectedAssetsParam = searchParams.getAll("selectedAssets");

      // If we have pre-selected assets, fetch them regardless of assignment status
      if (selectedAssetsParam.length > 0) {
        console.log("Fetching pre-selected assets:", selectedAssetsParam);

        const { data: preSelectedAssets, error: preSelectedError } =
          await supabase
            .from("onboarding_assets")
            .select("*")
            .in("id", selectedAssetsParam);

        if (preSelectedError) throw preSelectedError;

        console.log("Pre-selected assets fetched:", preSelectedAssets);
        setAssets(preSelectedAssets || []);
        return;
      }

      // If no pre-selected assets, fetch unallocated assets only
      const { data: assignedAssets, error: assignmentError } = await supabase
        .from("asset_assignments")
        .select("asset_id")
        .eq("role", "modeler")
        .eq("status", "accepted");

      if (assignmentError) throw assignmentError;

      const assignedAssetIds = assignedAssets?.map((a) => a.asset_id) || [];

      // Fetch unallocated assets
      const { data, error } = await supabase
        .from("onboarding_assets")
        .select("*")
        .not("id", "in", `(${assignedAssetIds.join(",")})`);

      if (error) throw error;

      setAssets(data || []);
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

  // Initialize allocation data for selected assets
  const initializeAllocationData = () => {
    const modelers = users.filter((u) => u.role === "modeler");
    const qas = users.filter((u) => u.role === "qa");

    // Set global team assignment defaults
    if (modelers.length > 0 && !globalTeamAssignment.modelerId) {
      const defaultModelerId = modelers[0].id;
      setGlobalTeamAssignment((prev) => ({
        ...prev,
        modelerId: defaultModelerId,
      }));
      // Check pricing tier for the default modeler
      checkModelerPricingTier(defaultModelerId);
    }
    if (qas.length > 0 && !globalTeamAssignment.qaId) {
      setGlobalTeamAssignment((prev) => ({
        ...prev,
        qaId: qas[0].id,
      }));
    }

    // Get default pricing based on current pricing tier
    const getDefaultPricing = (pricingTier: "first_list" | "future") => {
      if (pricingTier === "future") {
        return {
          pbr_3d_model: "pbr_3d_model_future",
          hard_3d_model: "hard_3d_model_future",
          texture_creation: "texture_creation_future",
          uv_unwrapping: "uv_unwrapping_future",
          retopology: "retopology_future",
        };
      } else {
        return {
          pbr_3d_model: "pbr_3d_model",
          hard_3d_model: "hard_3d_model",
          texture_creation: "texture_creation",
          uv_unwrapping: "uv_unwrapping",
          retopology: "retopology",
        };
      }
    };

    const defaultPricingOptions = getDefaultPricing(pricingTier);
    const defaultPricingOption = defaultPricingOptions.pbr_3d_model; // This will now correctly use future pricing when tier is "future"
    const defaultPrice = pricingTier === "future" ? 15 : 18; // Future pricing is 15, first list is 18

    const data: AllocationData[] = Array.from(selectedAssets).map(
      (assetId) => ({
        assetId,
        modelerId:
          globalTeamAssignment.modelerId ||
          (modelers.length > 0 ? modelers[0].id : ""),
        qaId: globalTeamAssignment.qaId || (qas.length > 0 ? qas[0].id : ""),
        price: defaultPrice,
        pricingOptionId: defaultPricingOption,
      })
    );

    console.log("Initializing allocation data:", {
      selectedAssets: Array.from(selectedAssets),
      allocationData: data,
      pricingTier,
      defaultPricingOption,
      defaultPrice,
      availableAssets: assets.map((a) => ({ id: a.id, name: a.product_name })),
    });

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

  // Check pricing tier for currently selected modeler when users are loaded
  useEffect(() => {
    if (users.length > 0 && globalTeamAssignment.modelerId) {
      checkModelerPricingTier(globalTeamAssignment.modelerId);
    }
  }, [users, globalTeamAssignment.modelerId, checkModelerPricingTier]);

  // Re-initialize allocation data when pricing tier changes to ensure correct pricing
  useEffect(() => {
    if (selectedAssets.size > 0 && allocationData.length > 0) {
      // Re-initialize with correct pricing when tier changes
      initializeAllocationData();
    }
  }, [pricingTier]);

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

  // Handle next step
  const handleNextStep = () => {
    if (step < 2) {
      setStep(2);
      // Clear file history when moving to next step
      setAssetFileHistory([]);
      // Clear existing assignments when moving to next step
      setExistingAssignments([]);
    }
  };

  // Handle back to previous step
  const handleBackStep = () => {
    if (step > 1) {
      setStep(1);
      // Clear file history when going back
      setAssetFileHistory([]);
      // Clear existing assignments when going back
      setExistingAssignments([]);
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

  // Update global team assignment and check pricing tier
  const updateGlobalTeamAssignment = (
    field: "modelerId" | "qaId",
    value: string
  ) => {
    setGlobalTeamAssignment((prev) => ({
      ...prev,
      [field]: value,
    }));

    // If updating modeler, check their pricing tier and handle other modeler-specific logic
    if (field === "modelerId" && value) {
      // Check pricing tier for the new modeler
      checkModelerPricingTier(value);
      // Clear previous file history when modeler changes
      setAssetFileHistory([]);
      // Clear existing assignments when modeler changes
      setExistingAssignments([]);
      fetchDefaultQAForModeler(value);
      // Check if any assets were previously assigned to a different modeler
      checkForPreviousModelerFiles(value);
    } else if (field === "qaId") {
      // Apply QA change to all assets
      applyGlobalTeamAssignmentToAllAssets();
    }
  };

  // Show notification when file history is available
  useEffect(() => {
    if (assetFileHistory.length > 0) {
      toast.info(
        `${assetFileHistory.length} asset(s) have files from previous modelers available for download`,
        { duration: 5000 }
      );
    }
  }, [assetFileHistory]);

  // Check for previous modeler files when reassigning assets
  const checkForPreviousModelerFiles = async (newModelerId: string) => {
    try {
      const assetIds = allocationData.map((data) => data.assetId);

      // Get previous modeler assignments for these assets
      const { data: previousAssignments, error } = await supabase
        .from("asset_assignments")
        .select("asset_id, user_id")
        .in("asset_id", assetIds)
        .eq("role", "modeler")
        .neq("user_id", newModelerId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching previous assignments:", error);
        return;
      }

      if (!previousAssignments || previousAssignments.length === 0) {
        setAssetFileHistory([]);
        return;
      }

      // Get asset details including files
      const { data: assetDetails, error: assetError } = await supabase
        .from("onboarding_assets")
        .select("id, glb_link, reference, product_link")
        .in("id", assetIds);

      if (assetError) {
        console.error("Error fetching asset details:", assetError);
        return;
      }

      // Get GLB upload history for these assets
      const { data: glbHistory, error: glbError } = await supabase
        .from("glb_upload_history")
        .select("asset_id, glb_url, file_name, uploaded_at")
        .in("asset_id", assetIds)
        .order("uploaded_at", { ascending: false });

      if (glbError) {
        console.error("Error fetching GLB history:", glbError);
        // Don't fail, just continue without GLB history
      }

      // Get additional asset files if the table exists
      let assetFiles: any[] = [];
      try {
        const { data: filesData, error: filesError } = await supabase
          .from("asset_files")
          .select("asset_id, file_url, file_name, file_type")
          .in("asset_id", assetIds)
          .order("uploaded_at", { ascending: false });

        if (!filesError && filesData) {
          assetFiles = filesData;
        }
      } catch (error) {
        // asset_files table might not exist, ignore
        console.log("asset_files table not available");
      }

      // Get user details for previous modelers
      const userIds = [...new Set(previousAssignments.map((a) => a.user_id))];
      const { data: userProfiles, error: userError } = await supabase
        .from("profiles")
        .select("id, title, email")
        .in("id", userIds);

      if (userError) {
        console.error("Error fetching user profiles:", userError);
        // Continue without user profiles
      }

      // Create file history for assets with previous modelers
      const history: AssetFileHistory[] = [];

      for (const assignment of previousAssignments) {
        const asset = assetDetails?.find((a) => a.id === assignment.asset_id);
        if (
          asset &&
          (asset.glb_link || asset.reference?.length > 0 || asset.product_link)
        ) {
          const existingHistory = history.find(
            (h) => h.assetId === assignment.asset_id
          );
          if (!existingHistory) {
            // Get user profile for this assignment
            const userProfile = userProfiles?.find(
              (p) => p.id === assignment.user_id
            );

            // Get GLB history for this asset
            const assetGlbHistory =
              glbHistory?.filter((h) => h.asset_id === assignment.asset_id) ||
              [];

            // Get additional asset files for this asset
            const assetAdditionalFiles =
              assetFiles?.filter((f) => f.asset_id === assignment.asset_id) ||
              [];

            history.push({
              assetId: assignment.asset_id,
              previousModelerId: assignment.user_id,
              previousModelerName:
                userProfile?.title || userProfile?.email || "Unknown",
              files: {
                glb_link: asset.glb_link,
                reference: asset.reference,
                other_files: [
                  ...(asset.product_link ? [asset.product_link] : []),
                  ...assetGlbHistory.map((h) => h.glb_url),
                  ...assetAdditionalFiles.map((f) => f.file_url),
                ],
              },
            });
          }
        }
      }

      setAssetFileHistory(history);
    } catch (error) {
      console.error("Error checking for previous modeler files:", error);
    }
  };

  // Handle file download
  const handleFileDownload = (url: string, fileName: string) => {
    try {
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error downloading file:", error);
      // Fallback to opening in new tab
      window.open(url, "_blank");
    }
  };

  const applyGlobalTeamAssignmentToAllAssets = () => {
    setAllocationData((prev) =>
      prev.map((item) => ({
        ...item,
        modelerId: globalTeamAssignment.modelerId,
        qaId: globalTeamAssignment.qaId,
      }))
    );
  };

  const fetchDefaultQAForModeler = async (modelerId: string) => {
    try {
      setFetchingDefaultQA(true);
      // Clear current QA selection first
      setGlobalTeamAssignment((prev) => ({
        ...prev,
        qaId: "",
      }));
      setNoDefaultQA(false);

      // Fetch QA allocations for this modeler
      const { data: qaAllocations, error } = await supabase
        .from("qa_allocations")
        .select("qa_id")
        .eq("modeler_id", modelerId);

      if (error) {
        console.error("Error fetching QA allocations:", error);
        return;
      }

      // If the modeler has a QA assigned, set it as default
      if (qaAllocations && qaAllocations.length > 0) {
        const defaultQAId = qaAllocations[0].qa_id;
        setGlobalTeamAssignment((prev) => ({
          ...prev,
          qaId: defaultQAId,
        }));

        // Update all allocation data to use the default QA
        setAllocationData((prev) =>
          prev.map((data) => ({
            ...data,
            qaId: defaultQAId,
          }))
        );
      } else {
        setNoDefaultQA(true);
      }
    } catch (error) {
      console.error("Error fetching default QA for modeler:", error);
    } finally {
      setFetchingDefaultQA(false);
    }
  };

  // Bulk pricing functions
  const applyBulkPricing = (pricingOptionId: string) => {
    const option = getPricingOptionById(pricingOptionId);
    const price = option?.price || 0;

    setAllocationData((prev) =>
      prev.map((item) =>
        selectedForPricing.has(item.assetId)
          ? { ...item, pricingOptionId, price }
          : item
      )
    );
  };

  const applyBulkCustomPrice = (price: number) => {
    setAllocationData((prev) =>
      prev.map((item) =>
        selectedForPricing.has(item.assetId) ? { ...item, price } : item
      )
    );
  };

  // Toggle product selection for pricing
  const togglePricingSelection = (assetId: string) => {
    setSelectedForPricing((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
  };

  // Select all products for pricing
  const selectAllForPricing = () => {
    setSelectedForPricing(new Set(allocationData.map((data) => data.assetId)));
  };

  // Clear all pricing selections
  const clearPricingSelections = () => {
    setSelectedForPricing(new Set());
  };

  // Handle allocation
  const handleAllocate = async () => {
    try {
      setAllocating(true);

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

      // Check for existing assignments to allow re-allocation
      const assetIds = allocationData.map((data) => data.assetId);
      const { data: existingAssignmentsData, error: checkError } =
        await supabase
          .from("asset_assignments")
          .select("asset_id, user_id, role, status")
          .in("asset_id", assetIds)
          .eq("role", "modeler");

      if (checkError) {
        console.error("Error checking existing assignments:", checkError);
        toast.error("Failed to check existing assignments");
        return;
      }

      // Store existing assignments for UI display
      setExistingAssignments(existingAssignmentsData || []);

      // Allow re-allocation of all assets (existing assignments will be replaced)
      const assetsToAllocate = allocationData;

      if (assetsToAllocate.length === 0) {
        toast.error("No assets selected for allocation");
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

      // Note: Notifications are now handled by the API route to prevent duplicates
      // The API route (/api/assets/assign) will send notifications to assigned modelers and QA
      // This prevents the issue of receiving the same notification twice

      // Clear file history since allocation is successful
      setAssetFileHistory([]);
      // Clear existing assignments since allocation is successful
      setExistingAssignments([]);

      // Check if this was a re-allocation
      const wasReallocation =
        existingAssignmentsData && existingAssignmentsData.length > 0;
      const message = wasReallocation
        ? `Successfully re-allocated ${assetsToAllocate.length} asset(s) to new modeler`
        : `Successfully allocated ${assetsToAllocate.length} asset(s) to modeler`;

      toast.success(message);

      // Redirect to production page
      router.push("/production");
    } catch (error) {
      console.error("Error allocating assets:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to allocate assets"
      );
    } finally {
      setAllocating(false);
    }
  };

  // Helper function to get asset by ID
  const getAssetById = (id: string) => {
    const asset = assets.find((asset) => asset.id === id);
    if (!asset) {
      console.log(`Asset not found for ID: ${id}`, {
        availableAssetIds: assets.map((a) => a.id),
        totalAssets: assets.length,
      });
    }
    return asset;
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
            <CardTitle>Assign Modeler and QA</CardTitle>
            <p className="text-sm text-muted-foreground">
              Select a modeler to auto-populate their default QA, or choose a
              different QA if needed
            </p>
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
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    QA Reviewer
                  </label>
                  <Select
                    value={globalTeamAssignment.qaId}
                    onValueChange={(value) =>
                      updateGlobalTeamAssignment("qaId", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose QA reviewer" />
                    </SelectTrigger>
                    <SelectContent>
                      {users
                        .filter((u) => u.role === "qa")
                        .map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.title || user.email}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {globalTeamAssignment.modelerId &&
                    !globalTeamAssignment.qaId &&
                    !fetchingDefaultQA &&
                    !noDefaultQA && (
                      <div className="text-xs text-muted-foreground">
                        Fetching default QA for this modeler...
                      </div>
                    )}
                  {globalTeamAssignment.modelerId &&
                    !globalTeamAssignment.qaId &&
                    !fetchingDefaultQA &&
                    !noDefaultQA && (
                      <div className="text-xs text-muted-foreground">
                        Please wait while we find the default QA for this
                        modeler...
                      </div>
                    )}
                  {globalTeamAssignment.modelerId &&
                    !globalTeamAssignment.qaId && (
                      <div className="text-xs text-muted-foreground">
                        Select a QA reviewer to continue
                      </div>
                    )}
                  {globalTeamAssignment.modelerId &&
                    globalTeamAssignment.qaId && (
                      <div className="text-xs text-muted-foreground">
                        Default QA for this modeler. You can change this if
                        needed.
                      </div>
                    )}
                  {globalTeamAssignment.modelerId &&
                    globalTeamAssignment.qaId && (
                      <div className="text-xs text-success">
                        ✓ Default QA auto-populated for{" "}
                        {users.find((u) => u.id === globalTeamAssignment.qaId)
                          ?.title ||
                          users.find((u) => u.id === globalTeamAssignment.qaId)
                            ?.email}
                      </div>
                    )}
                  {globalTeamAssignment.modelerId &&
                    globalTeamAssignment.qaId && (
                      <div className="text-xs text-muted-foreground">
                        You can change the QA above if you want to assign a
                        different reviewer
                      </div>
                    )}
                  {fetchingDefaultQA && (
                    <div className="text-xs text-muted-foreground">
                      Fetching default QA for selected modeler...
                    </div>
                  )}
                  {fetchingDefaultQA && (
                    <div className="text-xs text-muted-foreground">
                      Please wait while we retrieve the default QA assignment...
                    </div>
                  )}
                  {noDefaultQA && (
                    <div className="text-xs text-muted-foreground">
                      No default QA found for this modeler. Please choose a
                      different QA or assign one manually.
                    </div>
                  )}
                  {noDefaultQA && (
                    <div className="text-xs text-muted-foreground">
                      You can select any QA from the dropdown above to assign to
                      this modeler.
                    </div>
                  )}
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

              {/* Previous Modeler Files (when reassigning) */}
              {assetFileHistory.length > 0 && (
                <div className="border-t pt-6">
                  <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                    <Package className="h-5 w-5 text-amber-600" />
                    Previous Modeler Files Available
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    The following assets have files from previous modelers that
                    can be downloaded:
                  </p>

                  {/* Summary */}
                  <div className="mb-4 p-3 bg-amber-100/50 rounded-lg border border-amber-200">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-amber-800">
                        Total Files Available:{" "}
                        {assetFileHistory.reduce((total, history) => {
                          let count = 0;
                          if (history.files.glb_link) count++;
                          if (history.files.reference)
                            count += history.files.reference.length;
                          if (history.files.other_files)
                            count += history.files.other_files.length;
                          return total + count;
                        }, 0)}
                      </span>
                      <span className="text-amber-700">
                        Across {assetFileHistory.length} asset(s)
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {assetFileHistory.map((history) => {
                      const asset = getAssetById(history.assetId);
                      if (!asset) return null;

                      return (
                        <Card
                          key={history.assetId}
                          className="p-4 border-amber-200 bg-amber-50/50"
                        >
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-medium text-sm">
                                  {asset.product_name} ({asset.article_id})
                                </h4>
                                <p className="text-xs text-muted-foreground">
                                  Previously worked on by:{" "}
                                  {history.previousModelerName}
                                </p>
                              </div>
                            </div>

                            <div className="space-y-2">
                              {history.files.glb_link && (
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    Current GLB File
                                  </Badge>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleFileDownload(
                                        history.files.glb_link!,
                                        `${asset.product_name}-${asset.article_id}.glb`
                                      )
                                    }
                                    className="text-xs h-6 px-2"
                                    title={`Download GLB: ${asset.product_name}-${asset.article_id}.glb`}
                                  >
                                    Download
                                  </Button>
                                </div>
                              )}

                              {history.files.reference &&
                                history.files.reference.length > 0 && (
                                  <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground">
                                      Reference Images (
                                      {history.files.reference.length})
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                      {history.files.reference.map(
                                        (ref, index) => (
                                          <Button
                                            key={index}
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                              handleFileDownload(
                                                ref,
                                                `ref-${index + 1}.png`
                                              )
                                            }
                                            className="text-xs h-6 px-2"
                                            title={`Download Reference Image ${index + 1}`}
                                          >
                                            Ref {index + 1}
                                          </Button>
                                        )
                                      )}
                                    </div>
                                  </div>
                                )}

                              {history.files.other_files &&
                                history.files.other_files.length > 0 && (
                                  <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground">
                                      Additional Files (
                                      {history.files.other_files.length})
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                      {history.files.other_files!.map(
                                        (file, index) => {
                                          const fileName =
                                            file.split("/").pop() ||
                                            `file-${index + 1}`;
                                          const fileExtension =
                                            fileName.split(".").pop() || "file";
                                          return (
                                            <Button
                                              key={index}
                                              variant="outline"
                                              size="sm"
                                              onClick={() =>
                                                handleFileDownload(
                                                  file,
                                                  fileName
                                                )
                                              }
                                              className="text-xs h-6 px-2"
                                              title={`Download: ${fileName}`}
                                            >
                                              {fileExtension.toUpperCase()}{" "}
                                              {index + 1}
                                            </Button>
                                          );
                                        }
                                      )}
                                    </div>
                                  </div>
                                )}
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

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
                  onValueChange={(value: "first_list" | "future") => {
                    setPricingTier(value);
                    updatePricingForTierChange(value);
                  }}
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
                <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                  💡 The system automatically detects if a modeler has completed
                  their first list and sets the appropriate pricing tier.
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
                    value={groupSettings.bonus === 0 ? "" : groupSettings.bonus}
                    onChange={(e) => {
                      const value = e.target.value;
                      setGroupSettings((prev) => ({
                        ...prev,
                        bonus: value === "" ? 0 : parseInt(value) || 0,
                      }));
                    }}
                  />
                </div>
              </div>

              {/* Individual Asset Pricing */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium mb-4">Asset Pricing</h3>

                {/* Bulk Pricing Options */}
                <div className="mb-6 p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">Bulk Pricing Options</h4>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={selectAllForPricing}
                      >
                        Select All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearPricingSelections}
                      >
                        Clear Selection
                      </Button>
                    </div>
                  </div>
                  <div className="mb-3 text-sm text-muted-foreground">
                    {selectedForPricing.size > 0
                      ? `${selectedForPricing.size} product${selectedForPricing.size > 1 ? "s" : ""} selected for pricing`
                      : "Select products above to apply bulk pricing"}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {getCurrentPricingOptions().map((option) => (
                      <Button
                        key={option.id}
                        variant="outline"
                        size="sm"
                        onClick={() => applyBulkPricing(option.id)}
                        disabled={selectedForPricing.size === 0}
                        className="justify-start"
                      >
                        <Euro className="h-4 w-4 mr-2" />
                        {option.label} - €{option.price}
                      </Button>
                    ))}
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Custom price"
                        className="flex-1"
                        disabled={selectedForPricing.size === 0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const price = parseFloat(e.currentTarget.value);
                            if (price > 0) {
                              applyBulkCustomPrice(price);
                            }
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={selectedForPricing.size === 0}
                        onClick={() => {
                          const input = document.querySelector(
                            'input[placeholder="Custom price"]'
                          ) as HTMLInputElement;
                          const price = parseFloat(input?.value || "0");
                          if (price > 0) {
                            applyBulkCustomPrice(price);
                            input.value = "";
                          }
                        }}
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {allocationData.map((data) => {
                    const asset = getAssetById(data.assetId);
                    if (!asset) return null;

                    const isSelectedForPricing = selectedForPricing.has(
                      data.assetId
                    );

                    return (
                      <Card
                        key={data.assetId}
                        className={`p-4 transition-all duration-200 cursor-pointer ${
                          isSelectedForPricing
                            ? "ring-2 ring-primary/20 bg-primary/5"
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() => togglePricingSelection(data.assetId)}
                      >
                        <div className="space-y-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
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
                            <div className="ml-2">
                              <input
                                type="checkbox"
                                checked={isSelectedForPricing}
                                onChange={() =>
                                  togglePricingSelection(data.assetId)
                                }
                                onClick={(e) => e.stopPropagation()}
                                className="h-4 w-4"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center">
                              <Euro className="h-4 w-4 mr-2" />
                              Pricing Option
                            </label>
                            <div onClick={(e) => e.stopPropagation()}>
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
                                    <SelectItem
                                      key={option.id}
                                      value={option.id}
                                    >
                                      {option.label} - €{option.price}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
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
                                  onClick={(e) => e.stopPropagation()}
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
                <div className="text-sm text-muted-foreground space-y-1">
                  {groupSettings.deadline &&
                  allocationData.every((data) => data.price > 0) ? (
                    <span className="flex items-center gap-2">
                      <Euro className="h-4 w-4" />
                      Ready to allocate
                    </span>
                  ) : (
                    "Complete pricing and deadline to continue"
                  )}
                  {/* Show re-allocation warning if assets are already assigned */}
                  {existingAssignments && existingAssignments.length > 0 && (
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertTriangle className="h-3 w-3" />
                      <span>
                        Note: {existingAssignments.length} asset(s) will be
                        re-allocated to the new modeler
                      </span>
                    </div>
                  )}
                </div>
                <Button
                  onClick={handleAllocate}
                  disabled={
                    loading ||
                    allocating ||
                    !globalTeamAssignment.modelerId ||
                    !globalTeamAssignment.qaId ||
                    !groupSettings.deadline ||
                    allocationData.some((data) => data.price <= 0) ||
                    allocationData.some((data) => !data.pricingOptionId)
                  }
                  className="flex items-center gap-2"
                >
                  {allocating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Allocating...
                    </>
                  ) : (
                    <>
                      <Package className="h-4 w-4" />
                      Allocate & Notify
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
