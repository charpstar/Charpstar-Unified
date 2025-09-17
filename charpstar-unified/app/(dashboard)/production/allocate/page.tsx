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
import { Checkbox } from "@/components/ui/inputs/checkbox";
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
  AlertTriangle,
  Clock,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
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
  pricing_option_id?: string;
  price?: number;
}

interface User {
  id: string;
  email: string;
  title?: string;
  role: string;
  exclusive_work?: boolean;
  daily_hours?: number;
  model_types?: string[];
  software_experience?: string[];
}

interface AllocationData {
  assetId: string;
  modelerId: string;
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

// Predefined pricing options based on the new pricing structure
const PRICING_OPTIONS: PricingOption[] = [
  // First List Pricing
  {
    id: "pbr_3d_model_first",
    label: "PBR 3D Model Creation (First List)",
    price: 18,
    description: "Standard PBR 3D model creation for first list",
  },
  {
    id: "hard_3d_model_first",
    label: "Hard 3D Model (First List)",
    price: 0, // Custom price - decided before commencing
    description: "Hard surface 3D model for first list - custom pricing",
  },
  {
    id: "additional_colors_first",
    label: "Additional Colors (First List)",
    price: 1,
    description: "Additional colors for already made 3D models",
  },
  {
    id: "additional_textures_first",
    label: "Additional Textures/Materials (First List)",
    price: 5,
    description: "Additional textures/materials for already made 3D models",
  },
  {
    id: "additional_sizes_first",
    label: "Additional Sizes (First List)",
    price: 4,
    description: "Additional sizes for already made 3D models",
  },

  // After First Deadline Pricing
  {
    id: "pbr_3d_model_after_first",
    label: "PBR 3D Model Creation (After First Deadline)",
    price: 18,
    description: "Standard PBR 3D model creation after first deadline",
  },
  {
    id: "hard_3d_model_after_first",
    label: "Hard 3D Model (After First Deadline)",
    price: 0, // Custom price - decided before commencing
    description: "Hard surface 3D model after first deadline - custom pricing",
  },
  {
    id: "additional_colors_after_first",
    label: "Additional Colors (After First Deadline)",
    price: 1,
    description: "Additional colors for already made 3D models",
  },
  {
    id: "additional_textures_after_first",
    label: "Additional Textures/Materials (After First Deadline)",
    price: 5,
    description: "Additional textures/materials for already made 3D models",
  },
  {
    id: "additional_sizes_after_first",
    label: "Additional Sizes (After First Deadline)",
    price: 4,
    description: "Additional sizes for already made 3D models",
  },

  // After Second Deadline Pricing (Premium Tier)
  {
    id: "pbr_3d_model_after_second",
    label: "PBR 3D Model Creation (Premium Tier)",
    price: 30,
    description: "Premium PBR 3D model creation after second deadline",
  },
  {
    id: "hard_3d_model_after_second",
    label: "Hard 3D Model (Premium Tier)",
    price: 0, // Custom price - decided before commencing
    description: "Hard surface 3D model premium tier - custom pricing",
  },
  {
    id: "additional_colors_after_second",
    label: "Additional Colors (Premium Tier)",
    price: 1.5,
    description: "Additional colors for already made 3D models",
  },
  {
    id: "additional_textures_after_second",
    label: "Additional Textures/Materials (Premium Tier)",
    price: 7,
    description: "Additional textures/materials for already made 3D models",
  },
  {
    id: "additional_sizes_after_second",
    label: "Additional Sizes (Premium Tier)",
    price: 5,
    description: "Additional sizes for already made 3D models",
  },
];

// Derive human-readable task type from pricing option id
const getTaskTypeFromPricingOptionId = (pricingOptionId: string): string => {
  if (!pricingOptionId) return "Unknown";
  if (pricingOptionId.startsWith("pbr_3d_model_"))
    return "PBR 3D Model Creation";
  if (pricingOptionId.startsWith("hard_3d_model_")) return "Hard 3D Model";
  if (pricingOptionId.startsWith("additional_colors_"))
    return "Additional Colors";
  if (pricingOptionId.startsWith("additional_textures_"))
    return "Additional Textures/Materials";
  if (pricingOptionId.startsWith("additional_sizes_"))
    return "Additional Sizes";
  return "Unknown";
};

export default function AllocateAssetsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<1 | 2>(1);
  const [assets, setAssets] = useState<UnallocatedAsset[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [allocating, setAllocating] = useState(false);

  const [allocationData, setAllocationData] = useState<AllocationData[]>([]);
  const [selectedForPricing, setSelectedForPricing] = useState<Set<string>>(
    new Set()
  );
  const [groupSettings, setGroupSettings] = useState<GroupSettings>({
    deadline: format(
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      "yyyy-MM-dd"
    ),
    bonus: 15, // Default to first list bonus (15%)
  });
  const [pricingTier, setPricingTier] = useState<
    "first_list" | "after_first_deadline" | "after_second_deadline"
  >("first_list");
  const [globalTeamAssignment, setGlobalTeamAssignment] = useState<{
    modelerId: string;
  }>({
    modelerId: "",
  });
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [assetFileHistory, setAssetFileHistory] = useState<AssetFileHistory[]>(
    []
  );
  const [existingAssignments, setExistingAssignments] = useState<any[]>([]);
  const [modelerQAAssignments, setModelerQAAssignments] = useState<
    Map<string, { qaId: string; qaEmail: string; qaTitle?: string }[]>
  >(new Map());
  const [availableQAs, setAvailableQAs] = useState<User[]>([]);
  const [selectedQA, setSelectedQA] = useState<string>("");
  const [allocatingQA, setAllocatingQA] = useState(false);

  // Ref to prevent infinite loops when updating pricing
  const isUpdatingPricing = useRef(false);

  // Add new assets to allocation data with correct pricing

  // Update pricing when pricing tier changes
  const updatePricingForTierChange = useCallback(
    (
      newPricingTier:
        | "first_list"
        | "after_first_deadline"
        | "after_second_deadline"
    ) => {
      if (allocationData.length === 0 || isUpdatingPricing.current) return;

      isUpdatingPricing.current = true;

      // Update bonus percentage based on pricing tier
      const newBonusPercentage = newPricingTier === "first_list" ? 15 : 30;
      setGroupSettings((prev) => ({
        ...prev,
        bonus: newBonusPercentage,
      }));

      const updatedData = allocationData.map((item) => {
        let newPricingOptionId = item.pricingOptionId;
        let newPrice = item.price;

        // Define pricing mappings for all product types
        const pricingMappings: Record<
          string,
          {
            first_list: string;
            after_first_deadline: string;
            after_second_deadline: string;
            firstListPrice: number;
            afterFirstDeadlinePrice: number;
            afterSecondDeadlinePrice: number;
          }
        > = {
          // PBR 3D Model
          pbr_3d_model_first: {
            first_list: "pbr_3d_model_first",
            after_first_deadline: "pbr_3d_model_after_first",
            after_second_deadline: "pbr_3d_model_after_second",
            firstListPrice: 18,
            afterFirstDeadlinePrice: 18,
            afterSecondDeadlinePrice: 30,
          },
          pbr_3d_model_after_first: {
            first_list: "pbr_3d_model_first",
            after_first_deadline: "pbr_3d_model_after_first",
            after_second_deadline: "pbr_3d_model_after_second",
            firstListPrice: 18,
            afterFirstDeadlinePrice: 18,
            afterSecondDeadlinePrice: 30,
          },
          pbr_3d_model_after_second: {
            first_list: "pbr_3d_model_first",
            after_first_deadline: "pbr_3d_model_after_first",
            after_second_deadline: "pbr_3d_model_after_second",
            firstListPrice: 18,
            afterFirstDeadlinePrice: 18,
            afterSecondDeadlinePrice: 30,
          },

          // Hard Surface 3D Model (always custom pricing)
          hard_3d_model_first: {
            first_list: "hard_3d_model_first",
            after_first_deadline: "hard_3d_model_after_first",
            after_second_deadline: "hard_3d_model_after_second",
            firstListPrice: 0,
            afterFirstDeadlinePrice: 0,
            afterSecondDeadlinePrice: 0,
          },
          hard_3d_model_after_first: {
            first_list: "hard_3d_model_first",
            after_first_deadline: "hard_3d_model_after_first",
            after_second_deadline: "hard_3d_model_after_second",
            firstListPrice: 0,
            afterFirstDeadlinePrice: 0,
            afterSecondDeadlinePrice: 0,
          },
          hard_3d_model_after_second: {
            first_list: "hard_3d_model_first",
            after_first_deadline: "hard_3d_model_after_first",
            after_second_deadline: "hard_3d_model_after_second",
            firstListPrice: 0,
            afterFirstDeadlinePrice: 0,
            afterSecondDeadlinePrice: 0,
          },

          // Additional Colors
          additional_colors_first: {
            first_list: "additional_colors_first",
            after_first_deadline: "additional_colors_after_first",
            after_second_deadline: "additional_colors_after_second",
            firstListPrice: 1,
            afterFirstDeadlinePrice: 1,
            afterSecondDeadlinePrice: 1.5,
          },
          additional_colors_after_first: {
            first_list: "additional_colors_first",
            after_first_deadline: "additional_colors_after_first",
            after_second_deadline: "additional_colors_after_second",
            firstListPrice: 1,
            afterFirstDeadlinePrice: 1,
            afterSecondDeadlinePrice: 1.5,
          },
          additional_colors_after_second: {
            first_list: "additional_colors_first",
            after_first_deadline: "additional_colors_after_first",
            after_second_deadline: "additional_colors_after_second",
            firstListPrice: 1,
            afterFirstDeadlinePrice: 1,
            afterSecondDeadlinePrice: 1.5,
          },

          // Additional Textures/Materials
          additional_textures_first: {
            first_list: "additional_textures_first",
            after_first_deadline: "additional_textures_after_first",
            after_second_deadline: "additional_textures_after_second",
            firstListPrice: 5,
            afterFirstDeadlinePrice: 5,
            afterSecondDeadlinePrice: 7,
          },
          additional_textures_after_first: {
            first_list: "additional_textures_first",
            after_first_deadline: "additional_textures_after_first",
            after_second_deadline: "additional_textures_after_second",
            firstListPrice: 5,
            afterFirstDeadlinePrice: 5,
            afterSecondDeadlinePrice: 7,
          },
          additional_textures_after_second: {
            first_list: "additional_textures_first",
            after_first_deadline: "additional_textures_after_first",
            after_second_deadline: "additional_textures_after_second",
            firstListPrice: 5,
            afterFirstDeadlinePrice: 5,
            afterSecondDeadlinePrice: 7,
          },

          // Additional Sizes
          additional_sizes_first: {
            first_list: "additional_sizes_first",
            after_first_deadline: "additional_sizes_after_first",
            after_second_deadline: "additional_sizes_after_second",
            firstListPrice: 4,
            afterFirstDeadlinePrice: 4,
            afterSecondDeadlinePrice: 5,
          },
          additional_sizes_after_first: {
            first_list: "additional_sizes_first",
            after_first_deadline: "additional_sizes_after_first",
            after_second_deadline: "additional_sizes_after_second",
            firstListPrice: 4,
            afterFirstDeadlinePrice: 4,
            afterSecondDeadlinePrice: 5,
          },
          additional_sizes_after_second: {
            first_list: "additional_sizes_first",
            after_first_deadline: "additional_sizes_after_first",
            after_second_deadline: "additional_sizes_after_second",
            firstListPrice: 4,
            afterFirstDeadlinePrice: 4,
            afterSecondDeadlinePrice: 5,
          },
        };

        const mapping = pricingMappings[item.pricingOptionId];

        if (mapping) {
          if (newPricingTier === "after_second_deadline") {
            newPricingOptionId = mapping.after_second_deadline;
            newPrice = mapping.afterSecondDeadlinePrice;
          } else if (newPricingTier === "after_first_deadline") {
            newPricingOptionId = mapping.after_first_deadline;
            newPrice = mapping.afterFirstDeadlinePrice;
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

  // Check if modeler has completed their deadlines and set pricing tier accordingly
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

      // Count completed lists to determine pricing tier
      if (completedLists && completedLists.length > 0) {
        if (completedLists.length >= 2) {
          // After second deadline - premium tier
          setPricingTier("after_second_deadline");
          setGroupSettings((prev) => ({ ...prev, bonus: 30 }));
        } else {
          // After first deadline
          setPricingTier("after_first_deadline");
          setGroupSettings((prev) => ({ ...prev, bonus: 30 }));
        }
      } else {
        // First list
        setPricingTier("first_list");
        setGroupSettings((prev) => ({ ...prev, bonus: 15 }));
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
        const { data: preSelectedAssets, error: preSelectedError } =
          await supabase
            .from("onboarding_assets")
            .select("*, pricing_option_id, price")
            .in("id", selectedAssetsParam);

        if (preSelectedError) throw preSelectedError;

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

      // Fetch unallocated assets with pricing data
      const { data, error } = await supabase
        .from("onboarding_assets")
        .select("*, pricing_option_id, price")
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
        .select(
          "id, email, title, role, exclusive_work, daily_hours, model_types, software_experience"
        )
        .in("role", ["modeler"]);

      if (error) throw error;

      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to fetch users");
    }
  };

  // Fetch available QAs
  const fetchAvailableQAs = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, title, role")
        .eq("role", "qa");

      if (error) throw error;

      setAvailableQAs(data || []);
    } catch (error) {
      console.error("Error fetching QAs:", error);
      toast.error("Failed to fetch QAs");
    }
  };

  // Fetch QA assignments for modelers
  const fetchModelerQAAssignments = async () => {
    try {
      // First fetch QA allocations
      const { data: allocationData, error: allocationError } = await supabase
        .from("qa_allocations")
        .select("modeler_id, qa_id");

      if (allocationError) throw allocationError;

      if (!allocationData || allocationData.length === 0) {
        setModelerQAAssignments(new Map());
        return;
      }

      // Get unique QA IDs
      const qaIds = [...new Set(allocationData.map((a) => a.qa_id))];

      // Fetch QA user details
      const { data: qaDetails, error: qaError } = await supabase
        .from("profiles")
        .select("id, email, title")
        .in("id", qaIds);

      if (qaError) throw qaError;

      // Create a map of QA details (multiple QAs per modeler)
      const qaDetailsMap = new Map<
        string,
        { qaId: string; qaEmail: string; qaTitle?: string }[]
      >();

      allocationData.forEach((allocation) => {
        const qaDetail = qaDetails?.find((qa) => qa.id === allocation.qa_id);
        if (qaDetail) {
          const existingQAs = qaDetailsMap.get(allocation.modeler_id) || [];
          qaDetailsMap.set(allocation.modeler_id, [
            ...existingQAs,
            {
              qaId: allocation.qa_id,
              qaEmail: qaDetail.email,
              qaTitle: qaDetail.title,
            },
          ]);
        }
      });

      setModelerQAAssignments(qaDetailsMap);
      console.log("QA Assignments loaded:", qaDetailsMap);
    } catch (error) {
      console.error("Error fetching QA assignments:", error);
    }
  };

  // Allocate QA to modeler
  const allocateQA = async () => {
    if (!selectedQA || !globalTeamAssignment.modelerId) {
      toast.error("Please select a QA and modeler");
      return;
    }

    try {
      setAllocatingQA(true);

      const { error } = await supabase.from("qa_allocations").insert({
        modeler_id: globalTeamAssignment.modelerId,
        qa_id: selectedQA,
      });

      if (error) throw error;

      // Refresh QA assignments
      await fetchModelerQAAssignments();

      // Clear selection
      setSelectedQA("");

      toast.success("QA allocated successfully");
    } catch (error) {
      console.error("Error allocating QA:", error);
      toast.error("Failed to allocate QA");
    } finally {
      setAllocatingQA(false);
    }
  };

  useEffect(() => {
    fetchUnallocatedAssets();
    fetchUsers();
    fetchAvailableQAs();
    fetchModelerQAAssignments();
  }, [fetchUnallocatedAssets]);

  // Initialize allocation data for selected assets
  const initializeAllocationData = () => {
    const modelers = users.filter((u) => u.role === "modeler");

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

    // Get default pricing based on current pricing tier
    const getDefaultPricing = (
      pricingTier:
        | "first_list"
        | "after_first_deadline"
        | "after_second_deadline"
    ) => {
      if (pricingTier === "after_second_deadline") {
        return {
          pbr_3d_model: "pbr_3d_model_after_second",
          hard_3d_model: "hard_3d_model_after_second",
          additional_colors: "additional_colors_after_second",
          additional_textures: "additional_textures_after_second",
          additional_sizes: "additional_sizes_after_second",
        };
      } else if (pricingTier === "after_first_deadline") {
        return {
          pbr_3d_model: "pbr_3d_model_after_first",
          hard_3d_model: "hard_3d_model_after_first",
          additional_colors: "additional_colors_after_first",
          additional_textures: "additional_textures_after_first",
          additional_sizes: "additional_sizes_after_first",
        };
      } else {
        return {
          pbr_3d_model: "pbr_3d_model_first",
          hard_3d_model: "hard_3d_model_first",
          additional_colors: "additional_colors_first",
          additional_textures: "additional_textures_first",
          additional_sizes: "additional_sizes_first",
        };
      }
    };

    const defaultPricingOptions = getDefaultPricing(pricingTier);
    //eslint-disable-next-line
    const defaultPricingOption = defaultPricingOptions.pbr_3d_model;
    //eslint-disable-next-line
    const defaultPrice = pricingTier === "after_second_deadline" ? 30 : 18; // Premium tier is 30, others are 18

    const data: AllocationData[] = Array.from(selectedAssets)
      .map((assetId) => {
        const asset = assets.find((a) => a.id === assetId);

        // Only use existing pricing from onboarding assets
        const existingPricingOptionId = asset?.pricing_option_id;
        const existingPrice = asset?.price;

        // Use existing pricing if available, otherwise skip this asset
        if (
          existingPricingOptionId &&
          existingPrice !== undefined &&
          existingPrice > 0
        ) {
          return {
            assetId,
            modelerId:
              globalTeamAssignment.modelerId ||
              (modelers.length > 0 ? modelers[0].id : ""),
            price: existingPrice,
            pricingOptionId: existingPricingOptionId,
          };
        }

        // If no existing pricing, return null to filter out later
        return null;
      })
      .filter((item): item is AllocationData => item !== null);

    setAllocationData(data);

    // Show warning if some assets don't have existing pricing
    const totalAssets = selectedAssets.size;
    const assetsWithPricing = data.length;
    if (totalAssets > assetsWithPricing) {
      const missingPricingCount = totalAssets - assetsWithPricing;
      toast.warning(
        `${missingPricingCount} asset(s) excluded - no pricing set in admin review. Only assets with existing pricing can be allocated.`,
        { duration: 8000 }
      );
    }
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

  // Check pricing tier for currently selected modeler when users are loaded
  useEffect(() => {
    if (users.length > 0 && globalTeamAssignment.modelerId) {
      checkModelerPricingTier(globalTeamAssignment.modelerId);
    }
  }, [users, globalTeamAssignment.modelerId, checkModelerPricingTier]);

  // Re-initialize allocation data when pricing tier changes
  // Note: This will only affect assets that don't have existing pricing
  useEffect(() => {
    if (selectedAssets.size > 0 && allocationData.length > 0) {
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
  const updateGlobalTeamAssignment = (field: "modelerId", value: string) => {
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
      // Check if any assets were previously assigned to a different modeler
      checkForPreviousModelerFiles(value);
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
      } catch {
        // asset_files table might not exist, ignore
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
      if (!globalTeamAssignment.modelerId) {
        toast.error("Please select a modeler for the asset group");
        return;
      }

      // Check if the selected modeler has a QA assigned
      const { data: qaAllocations, error: qaError } = await supabase
        .from("qa_allocations")
        .select("qa_id")
        .eq("modeler_id", globalTeamAssignment.modelerId);

      if (qaError) {
        console.error("Error checking QA allocation:", qaError);
        toast.error("Failed to verify QA assignment");
        return;
      }

      if (!qaAllocations || qaAllocations.length === 0) {
        toast.error(
          "Cannot allocate assets: The selected modeler does not have a QA assigned. Please assign a QA to this modeler first.",
          { duration: 8000 }
        );
        return;
      }

      // Log info about QA allocations
      console.log(
        `Modeler ${globalTeamAssignment.modelerId} has ${qaAllocations.length} QA allocation${qaAllocations.length > 1 ? "s" : ""}.`
      );

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
        toast.error(
          "No assets with pricing available for allocation. Please set pricing in admin review first."
        );
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

      // Note: Notifications are now handled by the API route to prevent duplicates
      // The API route (/api/assets/assign) will send notifications to assigned modelers
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

    return asset;
  };

  // Get current pricing options based on tier
  const getCurrentPricingOptions = () => {
    return PRICING_OPTIONS.filter((option) => {
      if (pricingTier === "first_list") {
        return option.id.includes("_first") && !option.id.includes("after_");
      } else if (pricingTier === "after_first_deadline") {
        return option.id.includes("after_first");
      } else if (pricingTier === "after_second_deadline") {
        return option.id.includes("after_second");
      }
      return false;
    });
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
              <p className="text-sm font-medium">Step 1: Assign Modeler</p>
              <p className="text-xs text-muted-foreground">
                {globalTeamAssignment.modelerId
                  ? "Modeler assigned"
                  : "No modeler assigned"}
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
            <CardTitle>Assign Modeler</CardTitle>
            <p className="text-sm text-muted-foreground">
              Select a modeler to assign the selected assets to
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Global Team Assignment */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: Modeler Assignment */}
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

                {/* Right Column: Selected Modeler Profile Information */}
                <div className="space-y-3">
                  <label className="text-sm font-medium flex items-center">
                    <User className="h-4 w-4 mr-2" />
                    Modeler Profile
                  </label>
                  {globalTeamAssignment.modelerId ? (
                    (() => {
                      const selectedModeler = users.find(
                        (u) => u.id === globalTeamAssignment.modelerId
                      );
                      if (!selectedModeler) return null;

                      const qaAssignments =
                        modelerQAAssignments.get(
                          globalTeamAssignment.modelerId
                        ) || [];
                      console.log(
                        "Selected modeler ID:",
                        globalTeamAssignment.modelerId
                      );
                      console.log(
                        "QA Assignments for this modeler:",
                        qaAssignments
                      );
                      console.log("All QA assignments:", modelerQAAssignments);

                      return (
                        <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
                          {/* Basic Info */}
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {selectedModeler.email}
                            </span>
                            <div className="flex gap-2">
                              {selectedModeler.exclusive_work && (
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-green-50 text-green-700 border-green-200"
                                >
                                  Exclusive Work
                                </Badge>
                              )}
                              {qaAssignments.length > 0 ? (
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                                >
                                  {qaAssignments.length} QA
                                  {qaAssignments.length > 1 ? "s" : ""} Assigned
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-red-50 text-red-700 border-red-200"
                                >
                                  No QA Assigned
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* QA Assignment Info */}
                          {qaAssignments.length > 0 && (
                            <div className="p-2 bg-blue-50 rounded border border-blue-200">
                              <div className="text-xs font-medium text-blue-800 mb-1">
                                Assigned QA{qaAssignments.length > 1 ? "s" : ""}
                                :
                              </div>
                              <div className="space-y-1">
                                {qaAssignments.map((qa) => (
                                  <div
                                    key={qa.qaId}
                                    className="text-sm text-blue-700"
                                  >
                                    {qa.qaTitle || qa.qaEmail}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* QA Assignment Section - Always Visible */}
                          <div
                            className={`p-2 rounded border ${qaAssignments.length > 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
                          >
                            <div
                              className={`text-xs font-medium mb-1 ${qaAssignments.length > 0 ? "text-green-800" : "text-red-800"}`}
                            >
                              {qaAssignments.length > 0
                                ? "Add Additional QA:"
                                : "⚠️ No QA Assigned - Add QA:"}
                            </div>
                            {qaAssignments.length === 0 && (
                              <div className="text-sm text-red-700 mb-2">
                                Assets cannot be allocated until a QA is
                                assigned.
                              </div>
                            )}
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <Select
                                  value={selectedQA}
                                  onValueChange={setSelectedQA}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Select QA" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableQAs.map((qa) => (
                                      <SelectItem key={qa.id} value={qa.id}>
                                        {qa.title || qa.email}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={allocateQA}
                                  disabled={!selectedQA || allocatingQA}
                                  className={`text-xs h-8 px-3 ${
                                    qaAssignments.length > 0
                                      ? "bg-green-100 hover:bg-green-200 text-green-800 border-green-300"
                                      : "bg-blue-100 hover:bg-blue-200 text-blue-800 border-blue-300"
                                  }`}
                                >
                                  {allocatingQA ? "Assigning..." : "Assign QA"}
                                </Button>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  router.push("/production/qa-allocation")
                                }
                                className={`text-xs h-6 px-2 w-full ${
                                  qaAssignments.length > 0
                                    ? "bg-green-100 hover:bg-green-200 text-green-800 border-green-300"
                                    : "bg-red-100 hover:bg-red-200 text-red-800 border-red-300"
                                }`}
                              >
                                Manage QA Allocations
                              </Button>
                            </div>
                          </div>

                          {/* Daily Hours */}
                          {selectedModeler.daily_hours && (
                            <div className="flex items-center gap-2 text-sm">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {selectedModeler.daily_hours}h/day
                              </span>
                            </div>
                          )}

                          {/* Software Experience */}
                          {selectedModeler.software_experience &&
                            selectedModeler.software_experience.length > 0 && (
                              <div>
                                <div className="text-xs font-medium text-muted-foreground mb-2">
                                  Software Experience:
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {selectedModeler.software_experience
                                    .slice(0, 4)
                                    .map((software, index) => (
                                      <Badge
                                        key={index}
                                        variant="secondary"
                                        className="text-xs"
                                      >
                                        {software}
                                      </Badge>
                                    ))}
                                  {selectedModeler.software_experience.length >
                                    4 && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      +
                                      {selectedModeler.software_experience
                                        .length - 4}{" "}
                                      more
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}

                          {/* Model Types */}
                          {selectedModeler.model_types &&
                            selectedModeler.model_types.length > 0 && (
                              <div>
                                <div className="text-xs font-medium text-muted-foreground mb-2">
                                  Model Types:
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {selectedModeler.model_types.map(
                                    (type, index) => (
                                      <Badge
                                        key={index}
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        {type}
                                      </Badge>
                                    )
                                  )}
                                </div>
                              </div>
                            )}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="p-4 border rounded-lg bg-muted/30 text-sm text-muted-foreground">
                      Select a modeler to view their profile information
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-medium mb-4">
                  Assets to be assigned ({allocationData.length} of{" "}
                  {selectedAssets.size})
                </h3>
                {allocationData.length < selectedAssets.size && (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">
                      <strong>Note:</strong>{" "}
                      {selectedAssets.size - allocationData.length} asset(s)
                      excluded because they don&apos;t have pricing set in admin
                      review. Only assets with existing pricing can be
                      allocated.
                    </p>
                  </div>
                )}

                <div className="overflow-y-auto max-h-[400px] border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">
                          Product Name
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Article ID
                        </th>
                        <th className="px-3 py-2 font-medium">Category</th>
                        <th className="px-3 py-2 font-medium">Client</th>
                        <th className="px-3 py-2 font-medium text-center">
                          Task Type
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {allocationData.map((data) => {
                        const asset = getAssetById(data.assetId);
                        if (!asset) return null;

                        return (
                          <tr
                            key={data.assetId}
                            className="border-t hover:bg-muted/50 transition-colors"
                          >
                            <td className="px-3 py-2">
                              <div
                                className="truncate max-w-[200px] cursor-help"
                                title={asset.product_name}
                              >
                                {asset.product_name.length > 25
                                  ? asset.product_name.substring(0, 25) + "..."
                                  : asset.product_name}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground font-mono">
                              {asset.article_id}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <Badge variant="outline" className="text-xs">
                                {asset.category}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <Badge variant="secondary" className="text-xs">
                                {asset.client}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <Badge variant="outline" className="text-xs">
                                {getTaskTypeFromPricingOptionId(
                                  data.pricingOptionId
                                )}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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
                                        `${asset.article_id}.glb`
                                      )
                                    }
                                    className="text-xs h-6 px-2"
                                    title={`Download GLB: ${asset.article_id}.glb`}
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
                  {globalTeamAssignment.modelerId ? (
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {(() => {
                        const qaAssignments =
                          modelerQAAssignments.get(
                            globalTeamAssignment.modelerId
                          ) || [];
                        if (qaAssignments.length > 0) {
                          return `Modeler assigned with ${qaAssignments.length} QA${qaAssignments.length > 1 ? "s" : ""}`;
                        }
                        return "Modeler assigned - No QA assigned";
                      })()}
                    </span>
                  ) : (
                    "Select a modeler to continue"
                  )}
                </div>
                <Button
                  onClick={handleNextStep}
                  disabled={
                    !globalTeamAssignment.modelerId ||
                    (
                      modelerQAAssignments.get(
                        globalTeamAssignment.modelerId
                      ) || []
                    ).length === 0
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
                  onValueChange={(
                    value:
                      | "first_list"
                      | "after_first_deadline"
                      | "after_second_deadline"
                  ) => {
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
                    <SelectItem value="after_first_deadline">
                      After First Deadline
                    </SelectItem>
                    <SelectItem value="after_second_deadline">
                      Premium Tier (After Second Deadline)
                    </SelectItem>
                  </SelectContent>
                </Select>
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

              {/* Project Specifications & Financial Details */}

              {/* Individual Asset Pricing */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium mb-4">Asset Pricing</h3>

                {/* Bulk Pricing Controls */}
                <div className="mb-4 p-4 bg-muted/50 rounded-lg">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
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

                  <div className="text-sm text-muted-foreground mb-3">
                    {selectedForPricing.size > 0
                      ? `${selectedForPricing.size} product${
                          selectedForPricing.size > 1 ? "s" : ""
                        } selected for pricing`
                      : "Select products below to apply bulk pricing"}
                  </div>

                  <div className="flex flex-wrap gap-2">
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
                  </div>

                  <div className="flex gap-2 mt-3">
                    <Input
                      type="number"
                      placeholder="Custom price"
                      className="w-28"
                      disabled={selectedForPricing.size === 0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const price = parseFloat(e.currentTarget.value);
                          if (price > 0) {
                            applyBulkCustomPrice(price);
                            e.currentTarget.value = "";
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

                {/* Assets Table */}
                <div className="overflow-y-auto border rounded-lg max-h-[500px]">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/70">
                      <tr>
                        <th className="p-2 w-8">
                          <Checkbox
                            checked={
                              selectedForPricing.size ===
                                allocationData.length &&
                              allocationData.length > 0
                            }
                            onCheckedChange={(checked) => {
                              if (checked) {
                                selectAllForPricing();
                              } else {
                                clearPricingSelections();
                              }
                            }}
                          />
                        </th>
                        <th className="p-2 text-left">Product Name</th>
                        <th className="p-2 text-left">Article ID</th>
                        <th className="p-2">Category</th>
                        <th className="p-2">Product Link</th>
                        <th className="p-2">Task Type</th>
                        <th className="p-2">Pricing Option</th>
                        <th className="p-2">Price (€)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allocationData.map((data) => {
                        const asset = getAssetById(data.assetId);
                        if (!asset) return null;

                        const isSelectedForPricing = selectedForPricing.has(
                          data.assetId
                        );

                        return (
                          <tr
                            key={data.assetId}
                            className={`border-t hover:bg-muted/50 transition-colors ${
                              isSelectedForPricing ? "bg-primary/5" : ""
                            }`}
                          >
                            <td className="p-2 text-center">
                              <Checkbox
                                checked={isSelectedForPricing}
                                onCheckedChange={() =>
                                  togglePricingSelection(data.assetId)
                                }
                              />
                            </td>
                            <td className="p-2">
                              <div
                                className="truncate max-w-[200px] cursor-help"
                                title={asset.product_name}
                              >
                                {asset.product_name.length > 25
                                  ? asset.product_name.substring(0, 25) + "..."
                                  : asset.product_name}
                              </div>
                            </td>
                            <td className="p-2 text-muted-foreground font-mono text-center items-center justify-center ">
                              {asset.article_id}
                            </td>
                            <td className="p-2 text-center">
                              <Badge variant="outline" className="text-xs">
                                {asset.category}
                              </Badge>
                            </td>
                            <td className="p-2 text-center">
                              {asset.product_link ? (
                                <a
                                  href={asset.product_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 underline text-xs truncate block max-w-[150px]"
                                  title={asset.product_link}
                                >
                                  View Product
                                </a>
                              ) : (
                                <span className="text-muted-foreground text-xs">
                                  No link
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-center">
                              <Badge variant="secondary" className="text-xs">
                                {getTaskTypeFromPricingOptionId(
                                  data.pricingOptionId
                                )}
                              </Badge>
                            </td>
                            <td className="p-2 text-center items-center justify-center flex">
                              <div className="flex items-center gap-2 w-full">
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
                                    {getCurrentPricingOptions().map(
                                      (option) => (
                                        <SelectItem
                                          key={option.id}
                                          value={option.id}
                                        >
                                          {option.label} - €{option.price}
                                        </SelectItem>
                                      )
                                    )}
                                  </SelectContent>
                                </Select>
                                {(() => {
                                  const asset = getAssetById(data.assetId);
                                  const hasExistingPricing =
                                    asset?.pricing_option_id &&
                                    asset?.price &&
                                    asset.price > 0;
                                  return hasExistingPricing ? (
                                    <Badge
                                      variant="outline"
                                      className="text-xs bg-blue-50 text-blue-700 border-blue-200 whitespace-nowrap"
                                    >
                                      From Admin
                                    </Badge>
                                  ) : null;
                                })()}
                              </div>
                            </td>
                            <td className="p-2 text-center items-center justify-center ">
                              <div className="flex items-center gap-2">
                                {data.pricingOptionId.includes(
                                  "hard_3d_model"
                                ) ? (
                                  <Input
                                    type="number"
                                    value={data.price}
                                    onChange={(e) =>
                                      updateAllocationData(
                                        data.assetId,
                                        "price",
                                        parseFloat(e.target.value) || 0
                                      )
                                    }
                                  />
                                ) : (
                                  <span>€{data.price}</span>
                                )}
                                {(() => {
                                  const asset = getAssetById(data.assetId);
                                  const hasExistingPricing =
                                    asset?.pricing_option_id &&
                                    asset?.price &&
                                    asset.price > 0;
                                  return hasExistingPricing ? (
                                    <Badge
                                      variant="outline"
                                      className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                                    >
                                      From Admin
                                    </Badge>
                                  ) : null;
                                })()}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary */}
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Summary</h4>
                <div className="space-y-1 text-sm">
                  <p>
                    Assets with Pricing: {allocationData.length} of{" "}
                    {selectedAssets.size}
                  </p>
                  {allocationData.length > 0 && (
                    <>
                      <p>
                        Total Price: €
                        {allocationData.reduce(
                          (sum, data) => sum + data.price,
                          0
                        )}
                      </p>
                      <p>
                        Average Price: €
                        {(
                          allocationData.reduce(
                            (sum, data) => sum + data.price,
                            0
                          ) / allocationData.length
                        ).toFixed(2)}
                      </p>
                    </>
                  )}
                  <p>Bonus: {groupSettings.bonus}%</p>
                  <p>
                    Deadline: {format(new Date(groupSettings.deadline), "PPP")}
                  </p>

                  {/* Project Specifications Note */}
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-blue-800 text-xs">
                      <strong>Note:</strong> Client specifications and project
                      requirements are now managed in the
                      <button
                        onClick={() => window.open("/admin/clients", "_blank")}
                        className="underline font-medium hover:text-blue-600 cursor-pointer bg-transparent border-none p-0"
                      >
                        {" "}
                        Clients Management page
                      </button>
                      .
                    </p>
                  </div>
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
                  allocationData.length > 0 &&
                  allocationData.every((data) => data.price > 0) ? (
                    <span className="flex items-center gap-2">
                      <Euro className="h-4 w-4" />
                      Ready to allocate {allocationData.length} asset(s)
                    </span>
                  ) : allocationData.length === 0 ? (
                    <span className="flex items-center gap-2 text-amber-600">
                      <AlertTriangle className="h-3 w-3" />
                      No assets with pricing available
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
                  {/* Show QA assignment status */}
                  {globalTeamAssignment.modelerId &&
                    (
                      modelerQAAssignments.get(
                        globalTeamAssignment.modelerId
                      ) || []
                    ).length === 0 && (
                      <div className="flex items-center gap-2 text-red-600">
                        <AlertTriangle className="h-3 w-3" />
                        <span>
                          Cannot allocate: Selected modeler has no QA assigned
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
                    (
                      modelerQAAssignments.get(
                        globalTeamAssignment.modelerId
                      ) || []
                    ).length === 0 ||
                    !groupSettings.deadline ||
                    allocationData.length === 0 ||
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
