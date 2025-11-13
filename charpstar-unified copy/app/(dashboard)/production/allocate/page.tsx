"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/display/tooltip";
import { Input } from "@/components/ui/inputs";
import { Checkbox } from "@/components/ui/inputs/checkbox";
import { Switch } from "@/components/ui/inputs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs";
import { Combobox } from "@/components/ui/inputs/combobox";

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
  X,
  StickyNote,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/inputs";
import UserProfileDialog from "@/components/users/UserProfileDialog";
import { useUser } from "@/contexts/useUser";

interface UnallocatedAsset {
  id: string;
  product_name: string;
  article_id: string;
  article_ids?: string[] | null;
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
  qa_team_handles_model?: boolean;
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
  displayName?: string; // Auth display name from user_metadata
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

  // Custom pricing option
  {
    id: "custom_pricing",
    label: "Custom Pricing",
    price: 0, // Will be set by user
    description: "Set a custom price for this asset",
  },

  // QA Team Handling
  {
    id: "qa_team_handles_model",
    label: "0€ - QA Team Will Handle Model",
    price: 0,
    description: "QA team will handle this model (too easy for modelers)",
  },
];

// Derive human-readable task type from pricing option id
const getTaskTypeFromPricingOptionId = (pricingOptionId: string): string => {
  if (!pricingOptionId) return "Unknown";
  if (pricingOptionId === "qa_team_handles_model") return "QA Handles Model";
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

const normalizeArticleIds = (
  articleId: unknown,
  articleIds: unknown
): string[] => {
  const unique = new Set<string>();

  const pushValue = (value: unknown) => {
    if (value === null || value === undefined) return;

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) unique.add(trimmed);
      return;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      const normalized = String(value).trim();
      if (normalized) unique.add(normalized);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(pushValue);
    }
  };

  pushValue(articleId);

  if (Array.isArray(articleIds)) {
    articleIds.forEach(pushValue);
  } else if (typeof articleIds === "string" && articleIds.trim() !== "") {
    try {
      const parsed = JSON.parse(articleIds);
      if (Array.isArray(parsed)) {
        parsed.forEach(pushValue);
      } else {
        pushValue(articleIds);
      }
    } catch {
      articleIds.split(/[\s,;|]+/).forEach(pushValue);
    }
  } else if (articleIds !== null && articleIds !== undefined) {
    pushValue(articleIds);
  }

  return Array.from(unique);
};

const getAdditionalArticleIds = (asset: {
  article_id?: string | null;
  article_ids?: string[] | null;
}): string[] => {
  if (!Array.isArray(asset?.article_ids)) return [];
  return asset.article_ids.filter(
    (id) => id && id !== (asset.article_id ?? undefined)
  );
};

const getArticleIdsTooltip = (articleIds: string[]): string | null => {
  if (!articleIds || articleIds.length <= 1) return null;
  return articleIds.join(", ");
};

export default function AllocateAssetsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useUser();

  // Initialize step from URL params or default to 1
  const [step, setStep] = useState<1 | 2>(() => {
    const stepParam = searchParams.get("step");
    if (stepParam === "2") return 2;
    if (stepParam === "1") return 1;
    return 1;
  });
  const [assets, setAssets] = useState<UnallocatedAsset[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  // Store the order of selected assets from URL params to preserve admin-review order
  const [selectedAssetsOrder, setSelectedAssetsOrder] = useState<string[]>([]);
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
    bonus: 30, // Default to premium tier bonus (30%)
  });
  const [pricingTier, setPricingTier] = useState<
    "after_first_deadline" | "after_second_deadline" | "first_list"
  >("after_second_deadline");
  const hasShownAutoDetectNotification = useRef(false);
  const [globalTeamAssignment, setGlobalTeamAssignment] = useState<{
    modelerId: string;
  }>({
    modelerId: "",
  });

  // Provisional QA state
  const [provisionalQA, setProvisionalQA] = useState<{
    enabled: boolean;
    qaId: string;
  }>({
    enabled: false,
    qaId: "",
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
  const [pricingComments, setPricingComments] = useState<
    Record<string, string>
  >({});

  // Profile dialog state
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  // Ref to prevent infinite loops when updating pricing
  const isUpdatingPricing = useRef(false);

  // Custom pricing state (same as admin-review)
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});
  const [settingPrices, setSettingPrices] = useState<Set<string>>(new Set());

  const totalBasePrice = useMemo(() => {
    return allocationData.reduce((sum, data) => {
      const price = Number(data.price);
      return sum + (Number.isFinite(price) ? price : 0);
    }, 0);
  }, [allocationData]);

  const totalBonusAmount = useMemo(() => {
    const bonusPercentage = Number(groupSettings.bonus) || 0;
    return totalBasePrice * (bonusPercentage / 100);
  }, [totalBasePrice, groupSettings.bonus]);

  const totalPriceWithBonus = useMemo(() => {
    return totalBasePrice + totalBonusAmount;
  }, [totalBasePrice, totalBonusAmount]);

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

        // Preserve price for QA-handled models or items without pricing option
        if (
          !item.pricingOptionId ||
          item.pricingOptionId === "qa_team_handles_model"
        ) {
          return {
            ...item,
            pricingOptionId: newPricingOptionId,
            price: newPrice, // Preserve existing price (should be 0 for QA-handled)
          };
        }

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

          // Hard Surface 3D Model (always custom pricing - preserve existing price)
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
            // For hard surface models, preserve existing custom price
            if (item.pricingOptionId.includes("hard_3d_model")) {
              newPrice = item.price > 0 ? item.price : 0;
            } else {
              newPrice = mapping.afterSecondDeadlinePrice;
            }
          } else if (newPricingTier === "after_first_deadline") {
            newPricingOptionId = mapping.after_first_deadline;
            // For hard surface models, preserve existing custom price
            if (item.pricingOptionId.includes("hard_3d_model")) {
              newPrice = item.price > 0 ? item.price : 0;
            } else {
              newPrice = mapping.afterFirstDeadlinePrice;
            }
          } else if (newPricingTier === "first_list") {
            newPricingOptionId = mapping.first_list;
            // For hard surface models, preserve existing custom price
            if (item.pricingOptionId.includes("hard_3d_model")) {
              newPrice = item.price > 0 ? item.price : 0;
            } else {
              newPrice = mapping.firstListPrice;
            }
          }
        } else {
          // No mapping found - preserve existing price and pricing option
          // This handles cases where pricing option might be invalid or custom
          newPrice = item.price;
        }

        return {
          ...item,
          pricingOptionId: newPricingOptionId,
          price: newPrice,
        };
      });

      // Ensure order is preserved based on selectedAssetsOrder
      if (selectedAssetsOrder.length > 0) {
        const orderMap = new Map(
          selectedAssetsOrder.map((id, index) => [id, index])
        );
        updatedData.sort((a, b) => {
          const orderA = orderMap.get(a.assetId) ?? Infinity;
          const orderB = orderMap.get(b.assetId) ?? Infinity;
          return orderA - orderB;
        });
      }

      setAllocationData(updatedData);

      // Persist auto-detected pricing changes to localStorage
      try {
        const storageKey = `allocation_edited_prices_${Array.from(selectedAssets).sort().join("_")}`;
        const existingEdits = JSON.parse(
          localStorage.getItem(storageKey) || "{}"
        );

        // Update localStorage with all pricing changes
        updatedData.forEach((item) => {
          existingEdits[item.assetId] = {
            price: item.price,
            pricingOptionId: item.pricingOptionId,
          };
        });

        localStorage.setItem(storageKey, JSON.stringify(existingEdits));
      } catch (error) {
        console.error(
          "Error saving auto-detected pricing to localStorage:",
          error
        );
      }

      // Reset the guard after a short delay to allow state to settle
      setTimeout(() => {
        isUpdatingPricing.current = false;
      }, 100);
    },
    [allocationData, selectedAssets]
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
      // Order by upload_order to match admin-review page order
      if (selectedAssetsParam.length > 0) {
        const { data: preSelectedAssets, error: preSelectedError } =
          await supabase
            .from("onboarding_assets")
            .select(
              "*, pricing_option_id, price, pricing_comment, qa_team_handles_model, article_ids"
            )
            .in("id", selectedAssetsParam)
            .order("upload_order", { ascending: true });

        if (preSelectedError) throw preSelectedError;

        const normalizedPreSelectedAssets = (preSelectedAssets || []).map(
          (asset) => {
            const articleIds = normalizeArticleIds(
              (asset as any).article_id,
              (asset as any).article_ids
            );

            return {
              ...asset,
              article_ids: articleIds,
              article_id: articleIds[0] || (asset as any).article_id,
            };
          }
        );

        setAssets(normalizedPreSelectedAssets);

        // Store the order from the fetched assets (admin-review order)
        if (
          normalizedPreSelectedAssets &&
          normalizedPreSelectedAssets.length > 0
        ) {
          const orderedIds = normalizedPreSelectedAssets.map(
            (asset) => asset.id
          );
          setSelectedAssetsOrder(orderedIds);
        }

        // Initialize pricing comments
        const initialPricingComments: Record<string, string> = {};
        normalizedPreSelectedAssets.forEach((asset) => {
          if (asset.pricing_comment) {
            initialPricingComments[asset.id] = asset.pricing_comment;
          }
        });
        setPricingComments(initialPricingComments);

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
        .select(
          "*, pricing_option_id, price, pricing_comment, qa_team_handles_model, article_ids"
        )
        .not("id", "in", `(${assignedAssetIds.join(",")})`);

      if (error) throw error;

      const normalizedAssets = (data || []).map((asset) => {
        const articleIds = normalizeArticleIds(
          (asset as any).article_id,
          (asset as any).article_ids
        );

        return {
          ...asset,
          article_ids: articleIds,
          article_id: articleIds[0] || (asset as any).article_id,
        };
      });

      setAssets(normalizedAssets);

      // Initialize pricing comments for unallocated assets
      const initialPricingComments: Record<string, string> = {};
      normalizedAssets.forEach((asset) => {
        if (asset.pricing_comment) {
          initialPricingComments[asset.id] = asset.pricing_comment;
        }
      });
      setPricingComments(initialPricingComments);
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
      // Fetch users with auth metadata from API
      const response = await fetch("/api/users?role=modeler");
      if (!response.ok) throw new Error("Failed to fetch users");

      const { users: usersWithAuth } = await response.json();

      // Then fetch additional profile data
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select(
          "id, email, title, role, exclusive_work, daily_hours, model_types, software_experience"
        )
        .in("role", ["modeler"]);

      if (error) throw error;

      // Combine auth data with profile data
      const combinedUsers =
        profiles?.map((profile) => {
          const authUser = usersWithAuth?.find((u: any) => u.id === profile.id);
          // Get display name from auth metadata (name, or first_name + last_name)
          // Check if name exists and is not empty string
          const authDisplayName =
            authUser?.name && authUser.name.trim() !== ""
              ? authUser.name
              : null;
          // Fallback chain: auth display name -> profile title -> email (as last resort) -> Unknown User
          const displayName =
            authDisplayName ||
            (profile.title && profile.title.trim() !== ""
              ? profile.title
              : null) ||
            profile.email ||
            "Unknown User";
          return {
            ...profile,
            displayName: displayName,
          };
        }) || [];

      setUsers(combinedUsers);
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
    } catch {}
  };

  // Allocate QA to modeler
  // Remove QA allocation
  const removeQA = async (qaId: string) => {
    try {
      setAllocatingQA(true);

      if (!globalTeamAssignment.modelerId) {
        toast.error("No modeler selected");
        return;
      }

      const response = await fetch("/api/qa-allocations/remove", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          modelerId: globalTeamAssignment.modelerId,
          qaId: qaId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to remove QA allocation");
      }

      toast.success("QA removed successfully");

      // Refresh the QA assignments
      await fetchModelerQAAssignments();
    } catch (error) {
      console.error("Error removing QA:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to remove QA"
      );
    } finally {
      setAllocatingQA(false);
    }
  };

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

  // Get current user ID
  useEffect(() => {
    const getCurrentUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    getCurrentUser();
  }, []);

  // Profile dialog functions
  const handleViewProfile = (userId: string) => {
    setSelectedUserId(userId);
    setIsProfileDialogOpen(true);
  };

  const handleCloseProfile = () => {
    setIsProfileDialogOpen(false);
    setSelectedUserId(null);
  };

  // Initialize allocation data for selected assets
  const initializeAllocationData = (overrideModelerId?: string) => {
    const modelerIdToUse = overrideModelerId || globalTeamAssignment.modelerId;

    // Load edited prices from localStorage if they exist
    let editedPrices: Record<
      string,
      { price: number; pricingOptionId: string }
    > = {};
    try {
      const storageKey = `allocation_edited_prices_${Array.from(selectedAssets).sort().join("_")}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        editedPrices = JSON.parse(stored);
      }
    } catch (error) {
      console.error("Error loading edited prices from localStorage:", error);
    }

    // Use the preserved order from admin-review (upload_order), or fallback to Set order
    // The order comes from assets fetched sorted by upload_order (matching admin-review)
    const orderedAssetIds =
      selectedAssetsOrder.length > 0
        ? selectedAssetsOrder.filter((id) => selectedAssets.has(id))
        : Array.from(selectedAssets);

    const data: AllocationData[] = orderedAssetIds.map((assetId) => {
      const asset = assets.find((a) => a.id === assetId);

      // Check if this asset has edited prices in localStorage
      const editedPrice = editedPrices[assetId];

      // Prioritize edited prices from localStorage, then existing pricing from admin-review
      if (editedPrice) {
        return {
          assetId,
          modelerId: modelerIdToUse || "",
          price: editedPrice.price,
          pricingOptionId: editedPrice.pricingOptionId,
        };
      }

      // Prioritize existing pricing from admin-review
      const existingPricingOptionId = asset?.pricing_option_id;
      const existingPrice = asset?.price;
      const isQAHandled = asset?.qa_team_handles_model;

      // Use existing pricing from admin-review if available (including QA-handled with price 0)
      if (
        existingPricingOptionId &&
        existingPrice !== undefined &&
        (existingPrice > 0 || isQAHandled)
      ) {
        return {
          assetId,
          modelerId: modelerIdToUse || "",
          price: existingPrice ?? 0,
          pricingOptionId: existingPricingOptionId,
        };
      }

      // Include all assets, even without pricing - they can be priced in step 2
      // Default to empty pricing option and 0 price if no existing pricing
      return {
        assetId,
        modelerId: modelerIdToUse || "",
        price: existingPrice ?? 0,
        pricingOptionId: existingPricingOptionId || "",
      };
    });

    setAllocationData(data);

    // Persist initial prices from database to localStorage so they persist on reload
    try {
      const storageKey = `allocation_edited_prices_${Array.from(selectedAssets).sort().join("_")}`;
      const existingEdits = JSON.parse(
        localStorage.getItem(storageKey) || "{}"
      );

      // Only save if not already in localStorage (to preserve manual edits)
      data.forEach((item) => {
        if (
          !existingEdits[item.assetId] &&
          item.price > 0 &&
          item.pricingOptionId
        ) {
          existingEdits[item.assetId] = {
            price: item.price,
            pricingOptionId: item.pricingOptionId,
          };
        }
      });

      localStorage.setItem(storageKey, JSON.stringify(existingEdits));
    } catch (error) {
      console.error("Error saving initial prices to localStorage:", error);
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

  // Reinitialize allocation data when selected assets change (e.g., user selects different assets)
  // Use a ref to track previous selected assets to avoid unnecessary re-renders
  const prevSelectedAssetsRef = useRef<string>("");

  useEffect(() => {
    if (users.length > 0 && selectedAssets.size > 0) {
      // Create a stable string representation of selected assets for comparison
      const selectedAssetsStr = Array.from(selectedAssets).sort().join(",");

      // Only reinitialize if selected assets actually changed
      if (prevSelectedAssetsRef.current !== selectedAssetsStr) {
        prevSelectedAssetsRef.current = selectedAssetsStr;

        // Clear all old localStorage entries for edited prices
        // Keep only the current allocation's edited prices
        try {
          const currentStorageKey = `allocation_edited_prices_${Array.from(selectedAssets).sort().join("_")}`;
          const allKeys: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith("allocation_edited_prices_")) {
              allKeys.push(key);
            }
          }
          // Remove all old entries except the current one
          allKeys.forEach((key) => {
            if (key !== currentStorageKey) {
              localStorage.removeItem(key);
            }
          });
        } catch (error) {
          console.error("Error clearing old localStorage entries:", error);
        }

        // Check if the current allocation data matches the selected assets
        if (allocationData.length > 0) {
          const currentAssetIds = new Set(
            allocationData.map((item) => item.assetId)
          );
          const selectedAssetIds = selectedAssets;

          // Check if sets are different (different size or different items)
          const setsAreDifferent =
            currentAssetIds.size !== selectedAssetIds.size ||
            Array.from(selectedAssetIds).some(
              (id) => !currentAssetIds.has(id)
            ) ||
            Array.from(currentAssetIds).some((id) => !selectedAssetIds.has(id));

          if (setsAreDifferent) {
            // Clear existing allocation data - the first useEffect will reinitialize it
            // This ensures prices are loaded from the database for the new assets
            setAllocationData([]);
          }
        }
      }
    }
  }, [selectedAssets, users, allocationData]);

  // Check pricing tier for currently selected modeler when users are loaded (only if no allocation data exists)
  useEffect(() => {
    if (
      users.length > 0 &&
      globalTeamAssignment.modelerId &&
      allocationData.length === 0
    ) {
      checkModelerPricingTier(globalTeamAssignment.modelerId);
    }
  }, [
    users,
    globalTeamAssignment.modelerId,
    checkModelerPricingTier,
    allocationData.length,
  ]);

  // Auto-detect pricing tier based on loaded assets pricing (HIGHEST PRIORITY)
  // This effect runs after allocation data is loaded and overrides any modeler-based pricing
  useEffect(() => {
    if (allocationData.length > 0 && !isUpdatingPricing.current) {
      const detectedTier = detectPricingTierFromAssets(allocationData);

      // Always update to the detected tier if we have one and it's different from current
      if (detectedTier && detectedTier !== pricingTier) {
        setPricingTier(detectedTier);
        const bonusPercentage = detectedTier === "first_list" ? 15 : 30;
        setGroupSettings((prev) => ({ ...prev, bonus: bonusPercentage }));

        // Update prices to match the detected tier (this will also persist to localStorage)
        updatePricingForTierChange(detectedTier);

        // Only show notification once per session and only if tier changed
        if (!hasShownAutoDetectNotification.current) {
          toast.info(
            `Pricing tier auto-detected as "${detectedTier.replace(/_/g, " ")}" based on asset pricing.`,
            { duration: 4000 }
          );
          hasShownAutoDetectNotification.current = true;
        }
      }
    }
  }, [allocationData, pricingTier, updatePricingForTierChange]); // Added updatePricingForTierChange to dependencies

  // Auto-detect pricing tier when moving to step 2
  useEffect(() => {
    if (step === 2 && allocationData.length > 0 && !isUpdatingPricing.current) {
      const detectedTier = detectPricingTierFromAssets(allocationData);

      // Always update to the detected tier if we have one and it's different from current
      if (detectedTier && detectedTier !== pricingTier) {
        setPricingTier(detectedTier);
        const bonusPercentage = detectedTier === "first_list" ? 15 : 30;
        setGroupSettings((prev) => ({ ...prev, bonus: bonusPercentage }));

        // Update prices to match the detected tier (this will also persist to localStorage)
        updatePricingForTierChange(detectedTier);

        // Show notification when entering step 2 if not shown before
        if (!hasShownAutoDetectNotification.current) {
          toast.info(
            `Pricing tier auto-detected as "${detectedTier.replace(/_/g, " ")}" based on asset pricing.`,
            { duration: 4000 }
          );
          hasShownAutoDetectNotification.current = true;
        }
      }
    }
  }, [step, allocationData, pricingTier, updatePricingForTierChange]);

  // Helper function to detect pricing tier from asset pricing
  const detectPricingTierFromAssets = (data: AllocationData[]) => {
    if (data.length === 0) return null;

    // Count each pricing tier type
    const tierCounts = {
      after_second: 0,
      after_first: 0,
      first_list: 0,
      other: 0,
    };

    data.forEach((item) => {
      if (item.pricingOptionId.includes("after_second")) {
        tierCounts.after_second++;
      } else if (item.pricingOptionId.includes("after_first")) {
        tierCounts.after_first++;
      } else if (
        item.pricingOptionId.includes("_first") ||
        item.pricingOptionId.includes("first_list")
      ) {
        tierCounts.first_list++;
      } else {
        tierCounts.other++;
      }
    });

    // Return the tier with the highest count (prioritizing premium tiers in case of ties)
    if (tierCounts.after_second > 0) {
      return "after_second_deadline";
    }

    if (tierCounts.after_first > 0) {
      return "after_first_deadline";
    }

    if (tierCounts.first_list > 0) {
      return "first_list";
    }

    // If we can't clearly determine, return the premium tier as default
    return "after_second_deadline";
  };

  // Clear old localStorage entries on component mount
  useEffect(() => {
    try {
      const allKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("allocation_edited_prices_")) {
          allKeys.push(key);
        }
      }
      // If we have selected assets, keep only the current one, otherwise clear all
      if (selectedAssets.size > 0) {
        const currentStorageKey = `allocation_edited_prices_${Array.from(selectedAssets).sort().join("_")}`;
        allKeys.forEach((key) => {
          if (key !== currentStorageKey) {
            localStorage.removeItem(key);
          }
        });
      } else {
        // Clear all if no assets are selected
        allKeys.forEach((key) => {
          localStorage.removeItem(key);
        });
      }
    } catch (error) {
      console.error("Error clearing old localStorage entries on mount:", error);
    }
  }, []); // Run only on mount

  // Check for pre-selected assets from admin-review page
  useEffect(() => {
    const selectedAssetsParam = searchParams.getAll("selectedAssets");
    if (selectedAssetsParam.length > 0) {
      // Set the selected assets from URL parameters
      // Note: Order will be set from database query (upload_order) in fetchUnallocatedAssets
      setSelectedAssets(new Set(selectedAssetsParam));
      // Only set step=1 if no step parameter exists in URL
      // This allows navigation to step 2 to work properly
      const stepParam = searchParams.get("step");
      if (!stepParam) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("step", "1");
        router.replace(`${window.location.pathname}?${params.toString()}`, {
          scroll: false,
        });
        setStep(1);
      }
    }
  }, [searchParams, router]);

  // Sync step state with URL params and ensure step is always in URL
  useEffect(() => {
    const stepParam = searchParams.get("step");
    if (stepParam === "2" && step !== 2) {
      setStep(2);
    } else if (stepParam === "1" && step !== 1) {
      setStep(1);
    } else if (!stepParam) {
      // Ensure step is always in URL - default to step 1 if not present
      const params = new URLSearchParams(searchParams.toString());
      params.set("step", step === 2 ? "2" : "1");
      router.replace(`${window.location.pathname}?${params.toString()}`, {
        scroll: false,
      });
    }
  }, [searchParams, step, router]);

  // Handle next step
  const handleNextStep = () => {
    if (step < 2) {
      setStep(2);
      // Update URL to persist step state - use push to create history entry
      const params = new URLSearchParams(searchParams.toString());
      params.set("step", "2");
      router.push(`${window.location.pathname}?${params.toString()}`, {
        scroll: false,
      });
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
      // Update URL to persist step state - use push to create history entry
      const params = new URLSearchParams(searchParams.toString());
      params.set("step", "1");
      router.push(`${window.location.pathname}?${params.toString()}`, {
        scroll: false,
      });
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
    setAllocationData((prev) => {
      // Maintain the order when updating
      const updated = prev.map((item) =>
        item.assetId === assetId ? { ...item, [field]: value } : item
      );

      // Ensure order is preserved based on selectedAssetsOrder
      if (selectedAssetsOrder.length > 0) {
        const orderMap = new Map(
          selectedAssetsOrder.map((id, index) => [id, index])
        );
        updated.sort((a, b) => {
          const orderA = orderMap.get(a.assetId) ?? Infinity;
          const orderB = orderMap.get(b.assetId) ?? Infinity;
          return orderA - orderB;
        });
      }

      // Persist pricing changes to localStorage
      if (field === "price" || field === "pricingOptionId") {
        try {
          const storageKey = `allocation_edited_prices_${Array.from(selectedAssets).sort().join("_")}`;
          const existingEdits = JSON.parse(
            localStorage.getItem(storageKey) || "{}"
          );
          const updatedItem = updated.find((item) => item.assetId === assetId);
          if (updatedItem) {
            existingEdits[assetId] = {
              price: updatedItem.price,
              pricingOptionId: updatedItem.pricingOptionId,
            };
            localStorage.setItem(storageKey, JSON.stringify(existingEdits));
          }
        } catch (error) {
          console.error("Error saving edited prices to localStorage:", error);
        }
      }

      return updated;
    });
  };

  // Update global team assignment and check pricing tier
  const updateGlobalTeamAssignment = (field: "modelerId", value: string) => {
    const previousModelerId = globalTeamAssignment.modelerId;

    setGlobalTeamAssignment((prev) => ({
      ...prev,
      [field]: value,
    }));

    // If updating modeler, check their pricing tier and handle other modeler-specific logic
    if (field === "modelerId" && value) {
      // Preserve all current prices when changing modelers
      // Save all current allocation data prices to localStorage before reinitializing
      if (
        selectedAssets.size > 0 &&
        previousModelerId !== value &&
        allocationData.length > 0
      ) {
        try {
          const storageKey = `allocation_edited_prices_${Array.from(selectedAssets).sort().join("_")}`;

          // Preserve ALL current prices from allocationData
          // This ensures manually edited prices persist when changing modelers
          const preservedEdits: Record<
            string,
            { price: number; pricingOptionId: string }
          > = {};

          allocationData.forEach((item) => {
            preservedEdits[item.assetId] = {
              price: item.price,
              pricingOptionId: item.pricingOptionId,
            };
          });

          // Save all current prices to localStorage
          localStorage.setItem(storageKey, JSON.stringify(preservedEdits));
        } catch (error) {
          console.error("Error preserving prices on modeler change:", error);
        }
      }

      // If we have allocation data and modeler changed, update modelerId without reinitializing
      // This preserves all current prices
      if (
        allocationData.length > 0 &&
        selectedAssets.size > 0 &&
        previousModelerId !== value
      ) {
        // Just update the modelerId in existing allocation data, don't reinitialize
        setAllocationData((prev) => {
          const updated = prev.map((item) => ({
            ...item,
            modelerId: value,
          }));

          // Ensure order is preserved based on selectedAssetsOrder
          if (selectedAssetsOrder.length > 0) {
            const orderMap = new Map(
              selectedAssetsOrder.map((id, index) => [id, index])
            );
            updated.sort((a, b) => {
              const orderA = orderMap.get(a.assetId) ?? Infinity;
              const orderB = orderMap.get(b.assetId) ?? Infinity;
              return orderA - orderB;
            });
          }

          return updated;
        });
      } else if (allocationData.length === 0) {
        // Only check pricing tier for the new modeler if we don't have allocation data
        // (allocation data-based pricing takes priority)
        checkModelerPricingTier(value);
      }
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
        .order("accepted_at", { ascending: false });

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
                reference: Array.isArray(asset.reference)
                  ? asset.reference
                  : asset.reference
                    ? [asset.reference]
                    : undefined,
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

      // Check QA assignment - either provisional or assigned
      let finalQAId = null;

      if (provisionalQA.enabled && provisionalQA.qaId) {
        // Use provisional QA
        finalQAId = provisionalQA.qaId;
      } else {
        // Check if the selected modeler has a QA assigned
        const { data: qaAllocations, error: qaError } = await supabase
          .from("qa_allocations")
          .select("qa_id")
          .eq("modeler_id", globalTeamAssignment.modelerId);

        if (qaError) {
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

        // Use the first assigned QA (main QA)
        finalQAId = qaAllocations[0].qa_id;
      }

      // Log info about final QA assignment
      if (provisionalQA.enabled && provisionalQA.qaId) {
      }

      // Validate group settings and individual prices
      if (!groupSettings.deadline) {
        toast.error("Please set deadline for the asset group");
        return;
      }

      // Allow price 0 only for QA-handled models
      const hasInvalidPrices = allocationData.some(
        (data) =>
          data.price <= 0 && data.pricingOptionId !== "qa_team_handles_model"
      );
      if (hasInvalidPrices) {
        toast.error(
          "Please set a valid price for all assets (0€ is only allowed for QA-handled models)"
        );
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
          pricingOptions: assetsToAllocate.reduce(
            (acc, data) => {
              acc[data.assetId] = data.pricingOptionId;
              return acc;
            },
            {} as Record<string, string>
          ),
          // Provisional QA override
          provisionalQA:
            provisionalQA.enabled && provisionalQA.qaId
              ? {
                  qaId: finalQAId,
                  override: true,
                }
              : null,
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

      // Clear edited prices from localStorage after successful allocation
      try {
        const storageKey = `allocation_edited_prices_${Array.from(selectedAssets).sort().join("_")}`;
        localStorage.removeItem(storageKey);
      } catch (error) {
        console.error("Error clearing edited prices from localStorage:", error);
      }

      // Check if this was a re-allocation
      const wasReallocation =
        existingAssignmentsData && existingAssignmentsData.length > 0;

      let message = wasReallocation
        ? `Successfully re-allocated ${assetsToAllocate.length} asset(s) to new modeler`
        : `Successfully allocated ${assetsToAllocate.length} asset(s) to modeler`;

      // Add provisional QA info to message
      if (provisionalQA.enabled && provisionalQA.qaId) {
        const provisionalQAUser = availableQAs.find(
          (qa) => qa.id === provisionalQA.qaId
        );
        const qaName = provisionalQAUser
          ? provisionalQAUser.title || provisionalQAUser.email
          : "Unknown QA";
        message += ` with provisional QA override (${qaName})`;
      }

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
      // Always include QA team handling option and custom pricing
      if (
        option.id === "qa_team_handles_model" ||
        option.id === "custom_pricing"
      ) {
        return true;
      }

      // Filter based on pricing tier
      if (pricingTier === "first_list") {
        // First list: options ending with "_first" but not containing "after_"
        return option.id.endsWith("_first") && !option.id.includes("after_");
      } else if (pricingTier === "after_first_deadline") {
        // After first deadline: options containing "after_first"
        return option.id.includes("after_first");
      } else if (pricingTier === "after_second_deadline") {
        // After second deadline (Premium Tier): options containing "after_second"
        return option.id.includes("after_second");
      }

      return false;
    });
  };

  // Get pricing option by ID
  const getPricingOptionById = (id: string) => {
    const options = getCurrentPricingOptions();
    const found = options.find((option) => option.id === id);
    // If not found in filtered options, search all PRICING_OPTIONS (useful for QA option or pre-set pricing)
    if (!found) {
      return PRICING_OPTIONS.find((option) => option.id === id);
    }
    return found;
  };

  // Function to find matching pricing option based on price
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const findPricingOptionByPrice = (
    price: number,
    currentPricingOptionId: string
  ): string => {
    const currentOptions = getCurrentPricingOptions();

    // If price is 0, check if it should be QA-handled
    if (price === 0) {
      return "qa_team_handles_model";
    }

    // Find the pricing option with matching price
    const matchingOption = currentOptions.find(
      (option) => option.price === price
    );

    if (matchingOption) {
      return matchingOption.id;
    }

    // If no exact match, check if current option is hard surface (custom pricing)
    if (currentPricingOptionId.includes("hard_3d_model")) {
      // Keep the same hard surface option but with updated tier
      if (pricingTier === "after_second_deadline") {
        return "hard_3d_model_after_second";
      } else if (pricingTier === "after_first_deadline") {
        return "hard_3d_model_after_first";
      } else {
        return "hard_3d_model_first";
      }
    }

    // Default to current option if no match found
    return currentPricingOptionId || currentOptions[0]?.id || "";
  };

  // Handle price edit with automatic pricing option update
  // Handle price update (same as admin-review)
  const handlePriceUpdate = async (
    assetId: string,
    pricingOptionId: string,
    price: number
  ) => {
    try {
      // Auto-set price to 0 for QA team handles model option
      const priceToUse =
        pricingOptionId === "qa_team_handles_model" ? 0 : price;

      const response = await fetch("/api/assets/update-price", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assetId,
          pricingOptionId,
          price: priceToUse,
          qaTeamHandlesModel: pricingOptionId === "qa_team_handles_model",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update price");
      }

      // Update local allocation data
      updateAllocationData(assetId, "price", priceToUse);
      updateAllocationData(assetId, "pricingOptionId", pricingOptionId);

      // If it's custom pricing, also update the custom price
      if (pricingOptionId === "custom_pricing") {
        setCustomPrices((prev) => ({
          ...prev,
          [assetId]: price,
        }));
      }

      if (pricingOptionId === "qa_team_handles_model") {
        toast.success("Price set to 0€ - QA team will handle this model");
      } else {
        toast.success("Price updated successfully");
      }
    } catch (error) {
      console.error("Error updating price:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update price"
      );
    }
  };

  const handleCustomPriceChange = (assetId: string, price: number) => {
    setCustomPrices((prev) => ({
      ...prev,
      [assetId]: price,
    }));
  };

  const handleCustomPriceSubmit = async (assetId: string) => {
    const customPrice = customPrices[assetId];
    if (customPrice !== undefined && customPrice > 0) {
      // Add to loading state
      setSettingPrices((prev) => new Set(prev).add(assetId));

      try {
        await handlePriceUpdate(assetId, "custom_pricing", customPrice);
        toast.success("Custom price set successfully");
      } catch (error) {
        console.error("Error setting custom price:", error);
        toast.error("Failed to set custom price");
      } finally {
        // Remove from loading state
        setSettingPrices((prev) => {
          const next = new Set(prev);
          next.delete(assetId);
          return next;
        });
      }
    }
  };

  // Handle pricing comment updates
  const handlePricingCommentUpdate = async (
    assetId: string,
    comment: string
  ) => {
    try {
      const response = await fetch("/api/assets/update-pricing-comment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assetId,
          comment: comment.trim() || "",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update pricing comment");
      }

      // Update local state
      setPricingComments((prev) => ({
        ...prev,
        [assetId]: comment.trim() || "",
      }));

      toast.success("Pricing comment updated successfully");
    } catch (error) {
      console.error("Error updating pricing comment:", error);
      toast.error("Failed to update pricing comment");
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}

      {/* Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div
          className={`p-5 rounded-xl transition-all duration-300 ${
            step >= 1 ? "ring-2 ring-primary/20" : ""
          }`}
          style={{
            background:
              step >= 1 ? "var(--surface-elevated)" : "var(--surface-raised)",
            boxShadow: step >= 1 ? "var(--shadow-lg)" : "var(--shadow-sm)",
            border:
              step >= 1
                ? "1px solid var(--border-highlight)"
                : "1px solid var(--border-light)",
          }}
        >
          <div className="flex items-center gap-4">
            <div
              className={`p-3 rounded-lg transition-all duration-300 ${
                step >= 1 ? "" : "opacity-60"
              }`}
              style={{
                background:
                  step >= 1 ? "var(--gradient-shine)" : "var(--muted)",
                boxShadow: step >= 1 ? "var(--shadow-sm)" : "none",
                color: step >= 1 ? "var(--primary)" : "var(--muted-foreground)",
              }}
            >
              <User className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p
                className="text-sm font-semibold mb-1"
                style={{ color: "var(--foreground)" }}
              >
                Step 1: Assign Modeler
              </p>
              <p
                className="text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                {globalTeamAssignment.modelerId
                  ? "Modeler assigned"
                  : "No modeler assigned"}
              </p>
            </div>
            {step >= 1 && (
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  background: "var(--primary)",
                  boxShadow: "var(--glow-sm)",
                }}
              />
            )}
          </div>
        </div>

        <div
          className={`p-5 rounded-xl transition-all duration-300 ${
            step >= 2 ? "ring-2 ring-primary/20" : ""
          }`}
          style={{
            background:
              step >= 2 ? "var(--surface-elevated)" : "var(--surface-raised)",
            boxShadow: step >= 2 ? "var(--shadow-lg)" : "var(--shadow-sm)",
            border:
              step >= 2
                ? "1px solid var(--border-highlight)"
                : "1px solid var(--border-light)",
          }}
        >
          <div className="flex items-center gap-4">
            <div
              className={`p-3 rounded-lg transition-all duration-300 ${
                step >= 2 ? "" : "opacity-60"
              }`}
              style={{
                background:
                  step >= 2 ? "var(--gradient-shine)" : "var(--muted)",
                boxShadow: step >= 2 ? "var(--shadow-sm)" : "none",
                color: step >= 2 ? "var(--primary)" : "var(--muted-foreground)",
              }}
            >
              <Euro className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p
                className="text-sm font-semibold mb-1"
                style={{ color: "var(--foreground)" }}
              >
                Step 2: Bonus & Deadline
              </p>
              <p
                className="text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                {groupSettings.deadline ? "Deadline set" : "No deadline set"}
              </p>
            </div>
            {step >= 2 && (
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  background: "var(--primary)",
                  boxShadow: "var(--glow-sm)",
                }}
              />
            )}
          </div>
        </div>
      </div>

      {step === 1 ? (
        /* Step 1: Team Assignment */
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: "var(--surface-raised)",
            boxShadow: "var(--shadow-lg)",
            border: "1px solid var(--border-light)",
          }}
        >
          <div
            className="p-4 border-b"
            style={{
              background: "var(--gradient-shine)",
              borderColor: "var(--border-light)",
            }}
          >
            <h2
              className="text-xl font-semibold mb-2"
              style={{ color: "var(--foreground)" }}
            >
              Assign Modeler
            </h2>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              Select a modeler to assign the selected assets to
            </p>
          </div>
          <div className="p-6">
            <div className="space-y-6">
              {/* Global Team Assignment */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: Modeler Assignment */}
                <div className="space-y-3">
                  <label
                    className="text-sm font-semibold flex items-center"
                    style={{ color: "var(--foreground)" }}
                  >
                    <div
                      className="p-1.5 rounded mr-2"
                      style={{
                        background: "var(--gradient-shine)",
                        boxShadow: "var(--shadow-sm)",
                      }}
                    >
                      <User
                        className="h-4 w-4"
                        style={{ color: "var(--primary)" }}
                      />
                    </div>
                    Modeler
                  </label>
                  <div
                    style={{
                      boxShadow: "var(--shadow-sm)",
                    }}
                    className="max-w-xs"
                  >
                    <Combobox
                      value={globalTeamAssignment.modelerId}
                      onChange={(value) =>
                        updateGlobalTeamAssignment("modelerId", value)
                      }
                      placeholder="Choose modeler"
                      options={[
                        { value: "", label: "Choose modeler" },
                        ...users
                          .filter((u) => u.role === "modeler")
                          .map((user) => ({
                            value: user.id,
                            label: user.displayName || "Unknown User",
                          })),
                      ]}
                    />
                  </div>
                </div>

                {/* Right Column: Selected Modeler Profile Information */}
                <div className="space-y-3">
                  <label
                    className="text-sm font-semibold flex items-center"
                    style={{ color: "var(--foreground)" }}
                  >
                    <div
                      className="p-1.5 rounded mr-2"
                      style={{
                        background: "var(--gradient-shine)",
                        boxShadow: "var(--shadow-sm)",
                      }}
                    >
                      <User
                        className="h-4 w-4"
                        style={{ color: "var(--primary)" }}
                      />
                    </div>
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

                      return (
                        <div
                          className="p-5 rounded-xl space-y-4"
                          style={{
                            background: "var(--surface-elevated)",
                            boxShadow: "var(--shadow-md)",
                            border: "1px solid var(--border-light)",
                          }}
                        >
                          {/* Basic Info */}
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {selectedModeler.displayName ||
                                selectedModeler.title ||
                                selectedModeler.email}
                            </span>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleViewProfile(selectedModeler.id)
                                }
                                className="h-7 px-2 text-xs"
                              >
                                View Profile
                              </Button>
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
                            <div className="space-y-2">
                              <div className="text-xs font-medium text-muted-foreground">
                                Assigned QA{qaAssignments.length > 1 ? "s" : ""}
                                :
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {qaAssignments.map((qa) => (
                                  <Badge
                                    key={qa.qaId}
                                    variant="secondary"
                                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                                  >
                                    <span>{qa.qaTitle || qa.qaEmail}</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeQA(qa.qaId)}
                                      disabled={allocatingQA}
                                      className="h-4 w-4 p-0 hover:bg-destructive/20 hover:text-destructive rounded-full -mr-1"
                                      title="Remove QA"
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* QA Assignment Section - Always Visible */}
                          <div
                            className="p-4 rounded-lg space-y-3"
                            style={{
                              background: "var(--surface-raised)",
                              boxShadow: "var(--shadow-sm)",
                              border: "1px solid var(--border-light)",
                            }}
                          >
                            <div
                              className="text-xs font-semibold"
                              style={{ color: "var(--foreground)" }}
                            >
                              {qaAssignments.length > 0
                                ? "Add Additional QA:"
                                : " No QA Assigned - Add QA:"}
                            </div>
                            {qaAssignments.length === 0 && (
                              <div
                                className="text-xs"
                                style={{ color: "var(--muted-foreground)" }}
                              >
                                Assets cannot be allocated until a QA is
                                assigned.
                              </div>
                            )}
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <div
                                  style={{
                                    boxShadow: "var(--shadow-sm)",
                                    flex: 1,
                                  }}
                                >
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
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={allocateQA}
                                  disabled={!selectedQA || allocatingQA}
                                  className="text-xs h-8 px-3 transition-all duration-200"
                                  style={{
                                    boxShadow:
                                      !selectedQA || allocatingQA
                                        ? "none"
                                        : "var(--shadow-sm)",
                                  }}
                                >
                                  {allocatingQA ? "Assigning..." : "Assign QA"}
                                </Button>
                              </div>
                            </div>
                          </div>

                          {/* Provisional QA Section */}
                          <div
                            className="p-4 rounded-lg space-y-3"
                            style={{
                              background: "var(--surface-raised)",
                              boxShadow: "var(--shadow-sm)",
                              border: "1px solid var(--border-light)",
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-foreground">
                                  Provisional QA
                                </label>
                                <Badge variant="outline" className="text-xs">
                                  List-Specific
                                </Badge>
                              </div>
                              <Switch
                                checked={provisionalQA.enabled}
                                onCheckedChange={(checked) =>
                                  setProvisionalQA((prev) => ({
                                    ...prev,
                                    enabled: checked,
                                    qaId: checked ? prev.qaId : "",
                                  }))
                                }
                              />
                            </div>

                            <div className="text-xs text-muted-foreground mb-2">
                              Override the assigned QA for this specific list.
                              The provisional QA will receive this list instead
                              of the main QA.
                            </div>

                            {provisionalQA.enabled && (
                              <div className="space-y-2">
                                <Select
                                  value={provisionalQA.qaId}
                                  onValueChange={(value) =>
                                    setProvisionalQA((prev) => ({
                                      ...prev,
                                      qaId: value,
                                    }))
                                  }
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Select Provisional QA" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableQAs.map((qa) => (
                                      <SelectItem key={qa.id} value={qa.id}>
                                        {qa.title || qa.email}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                {provisionalQA.qaId && (
                                  <div className="p-2 bg-background rounded">
                                    <div className="text-xs font-medium text-foreground mb-1">
                                      QA Assignment:
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      • <strong>Main QA:</strong>{" "}
                                      {qaAssignments.length > 0
                                        ? qaAssignments
                                            .map(
                                              (qa) => qa.qaTitle || qa.qaEmail
                                            )
                                            .join(", ")
                                        : "None"}{" "}
                                      (will NOT receive this list)
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      • <strong>Provisional QA:</strong>{" "}
                                      {(() => {
                                        const selectedQA = availableQAs.find(
                                          (qa) => qa.id === provisionalQA.qaId
                                        );
                                        return selectedQA
                                          ? selectedQA.title || selectedQA.email
                                          : "None selected";
                                      })()}{" "}
                                      (will receive this list)
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
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

              <div
                className="pt-6 mt-6"
                style={{
                  borderTop: "1px solid var(--border-light)",
                }}
              >
                <h3
                  className="text-lg font-semibold mb-4"
                  style={{ color: "var(--foreground)" }}
                >
                  Assets to be assigned ({allocationData.length} of{" "}
                  {selectedAssets.size})
                </h3>

                <div
                  className="overflow-y-auto max-h-[400px] rounded-lg"
                  style={{
                    boxShadow: "var(--shadow-md)",
                    border: "1px solid var(--border-light)",
                  }}
                >
                  <table className="w-full text-sm">
                    <thead
                      style={{
                        background: "var(--surface-raised)",
                        borderBottom: "1px solid var(--border-light)",
                      }}
                    >
                      <tr>
                        <th
                          className="px-4 py-3 text-left font-semibold"
                          style={{ color: "var(--foreground)" }}
                        >
                          Product Name
                        </th>
                        <th
                          className="px-4 py-3 text-left font-semibold"
                          style={{ color: "var(--foreground)" }}
                        >
                          Article ID
                        </th>
                        <th
                          className="px-4 py-3 font-semibold text-center"
                          style={{ color: "var(--foreground)" }}
                        >
                          Category
                        </th>
                        <th
                          className="px-4 py-3 font-semibold text-center"
                          style={{ color: "var(--foreground)" }}
                        >
                          Client
                        </th>
                        <th
                          className="px-4 py-3 font-semibold text-center"
                          style={{ color: "var(--foreground)" }}
                        >
                          Task Type
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {allocationData.map((data) => {
                        const asset = getAssetById(data.assetId);
                        if (!asset) return null;

                        const articleIds = normalizeArticleIds(
                          asset.article_id,
                          asset.article_ids
                        );
                        const additionalArticleIds = getAdditionalArticleIds({
                          article_id: asset.article_id,
                          article_ids: articleIds,
                        });
                        const articleIdsTooltip =
                          getArticleIdsTooltip(articleIds);

                        return (
                          <tr
                            key={data.assetId}
                            className="transition-all duration-200"
                            style={{
                              borderTop: "1px solid var(--border-light)",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background =
                                "var(--surface-raised)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "transparent";
                            }}
                          >
                            <td className="px-3 py-2">
                              <div
                                className="truncate max-w-[200px] cursor-help"
                                title={asset.product_name}
                              >
                                {asset.product_name.length > 35
                                  ? asset.product_name.substring(0, 35) + "..."
                                  : asset.product_name}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground font-mono align-top">
                              <div className="flex flex-col gap-1">
                                <span
                                  className="truncate"
                                  title={articleIdsTooltip || undefined}
                                >
                                  {asset.article_id}
                                </span>
                                {additionalArticleIds.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {additionalArticleIds.map((id) => (
                                      <Badge
                                        key={`${asset.id}-${id}`}
                                        variant="outline"
                                        className="px-1.5 py-0 text-[10px] uppercase tracking-wide text-muted-foreground border-border/60"
                                        title={id}
                                      >
                                        {id}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
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
                                  data.pricingOptionId ||
                                    asset?.pricing_option_id ||
                                    ""
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

              {/* Step Navigation */}
              <div
                className="flex items-center justify-between pt-6 mt-6"
                style={{
                  borderTop: "1px solid var(--border-light)",
                }}
              >
                <div
                  className="text-sm"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {globalTeamAssignment.modelerId ? (
                    <span className="flex items-center gap-2">
                      <div
                        className="p-1 rounded"
                        style={{
                          background: "var(--gradient-shine)",
                        }}
                      >
                        <User
                          className="h-4 w-4"
                          style={{ color: "var(--primary)" }}
                        />
                      </div>
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-block">
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
                        className="flex items-center gap-2 transition-all duration-200"
                        style={{
                          boxShadow:
                            !globalTeamAssignment.modelerId ||
                            (
                              modelerQAAssignments.get(
                                globalTeamAssignment.modelerId
                              ) || []
                            ).length === 0
                              ? "none"
                              : "var(--shadow-md)",
                        }}
                      >
                        <ArrowRight className="h-4 w-4" />
                        Continue to Pricing
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {(!globalTeamAssignment.modelerId ||
                    (
                      modelerQAAssignments.get(
                        globalTeamAssignment.modelerId
                      ) || []
                    ).length === 0) && (
                    <TooltipContent>
                      {!globalTeamAssignment.modelerId
                        ? "Please select a modeler to continue"
                        : "No QA assigned - Please add a QA to the selected modeler"}
                    </TooltipContent>
                  )}
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Step 2: Group Pricing */
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: "var(--surface-raised)",
            boxShadow: "var(--shadow-lg)",
            border: "1px solid var(--border-light)",
          }}
        >
          <div
            className="p-4 border-b"
            style={{
              background: "var(--gradient-shine)",
              borderColor: "var(--border-light)",
            }}
          >
            <h2
              className="text-xl font-semibold mb-2"
              style={{ color: "var(--foreground)" }}
            >
              Set Pricing & Deadline for Asset Group
            </h2>
          </div>
          <div className="p-6">
            {/* Group Settings */}
            <div className="space-y-6">
              {/* Pricing Tier Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label
                    className="text-sm font-semibold flex items-center"
                    style={{ color: "var(--foreground)" }}
                  >
                    <div
                      className="p-1.5 rounded mr-2"
                      style={{
                        background: "var(--gradient-shine)",
                        boxShadow: "var(--shadow-sm)",
                      }}
                    >
                      <Euro
                        className="h-4 w-4"
                        style={{ color: "var(--primary)" }}
                      />
                    </div>
                    Pricing Tier
                  </label>
                </div>
                <div style={{ boxShadow: "var(--shadow-sm)" }}>
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
                    <SelectContent className="max-h-[200px]" position="popper">
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
                {(() => {
                  const detectedTier =
                    detectPricingTierFromAssets(allocationData);
                  if (detectedTier && detectedTier === pricingTier) {
                    return (
                      <p className="text-xs text-green-600">
                        ✓ Pricing tier automatically detected based on asset
                        pricing from admin review
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Deadline */}
                <div className="space-y-2">
                  <label
                    className="text-sm font-semibold flex items-center"
                    style={{ color: "var(--foreground)" }}
                  >
                    <div
                      className="p-1.5 rounded mr-2"
                      style={{
                        background: "var(--gradient-shine)",
                        boxShadow: "var(--shadow-sm)",
                      }}
                    >
                      <CalendarIcon
                        className="h-4 w-4"
                        style={{ color: "var(--primary)" }}
                      />
                    </div>
                    Deadline
                  </label>
                  <div style={{ boxShadow: "var(--shadow-sm)" }}>
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
                              deadline: format(
                                date || new Date(),
                                "yyyy-MM-dd"
                              ),
                            }));
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Bonus */}
                <div className="space-y-2">
                  <label
                    className="text-sm font-semibold flex items-center"
                    style={{ color: "var(--foreground)" }}
                  >
                    <div
                      className="p-1.5 rounded mr-2"
                      style={{
                        background: "var(--gradient-shine)",
                        boxShadow: "var(--shadow-sm)",
                      }}
                    >
                      <Euro
                        className="h-4 w-4"
                        style={{ color: "var(--primary)" }}
                      />
                    </div>
                    Bonus (%)
                  </label>
                  <div style={{ boxShadow: "var(--shadow-sm)" }}>
                    <Input
                      type="number"
                      placeholder="0"
                      value={
                        groupSettings.bonus === 0 ? "" : groupSettings.bonus
                      }
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
              </div>

              {/* Project Specifications & Financial Details */}

              {/* Individual Asset Pricing */}
              <div
                className="pt-6 mt-6"
                style={{
                  borderTop: "1px solid var(--border-light)",
                }}
              >
                <h3
                  className="text-lg font-semibold mb-4"
                  style={{ color: "var(--foreground)" }}
                >
                  Asset Pricing
                </h3>

                {/* Pricing Info & Controls */}

                {/* Assets Table */}
                <div
                  className="overflow-y-auto rounded-lg max-h-[500px]"
                  style={{
                    boxShadow: "var(--shadow-md)",
                    border: "1px solid var(--border-light)",
                  }}
                >
                  <table className="w-full text-sm">
                    <thead
                      style={{
                        background: "var(--surface-raised)",
                        borderBottom: "1px solid var(--border-light)",
                      }}
                    >
                      <tr>
                        <th className="p-3 w-8">
                          {(() => {
                            const manualAssets = allocationData.filter(
                              (data) => {
                                const asset = getAssetById(data.assetId);
                                return !(
                                  asset?.pricing_option_id &&
                                  asset?.price &&
                                  asset.price > 0
                                );
                              }
                            );

                            if (manualAssets.length === 0) {
                              return (
                                <Checkbox
                                  checked={false}
                                  disabled={true}
                                  className="opacity-30"
                                />
                              );
                            }

                            const selectedManualAssets = manualAssets.filter(
                              (data) => selectedForPricing.has(data.assetId)
                            );

                            return (
                              <Checkbox
                                checked={
                                  selectedManualAssets.length ===
                                    manualAssets.length &&
                                  manualAssets.length > 0
                                }
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    const manualAssetIds = manualAssets.map(
                                      (data) => data.assetId
                                    );
                                    setSelectedForPricing(
                                      new Set(manualAssetIds)
                                    );
                                  } else {
                                    clearPricingSelections();
                                  }
                                }}
                              />
                            );
                          })()}
                        </th>
                        <th
                          className="p-3 text-left font-semibold"
                          style={{ color: "var(--foreground)" }}
                        >
                          Product Name
                        </th>
                        <th
                          className="p-3 text-left font-semibold"
                          style={{ color: "var(--foreground)" }}
                        >
                          Article ID
                        </th>
                        <th
                          className="p-3 font-semibold text-center"
                          style={{ color: "var(--foreground)" }}
                        >
                          Category
                        </th>
                        <th
                          className="p-3 font-semibold text-center"
                          style={{ color: "var(--foreground)" }}
                        >
                          Product Link
                        </th>
                        <th
                          className="p-3 font-semibold text-center"
                          style={{ color: "var(--foreground)" }}
                        >
                          Task Type
                        </th>
                        <th
                          className="p-3 font-semibold text-center"
                          style={{ color: "var(--foreground)" }}
                        >
                          Pricing Option
                        </th>
                        <th
                          className="p-3 font-semibold text-center"
                          style={{ color: "var(--foreground)" }}
                        >
                          Price (€)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {allocationData.map((data) => {
                        const asset = getAssetById(data.assetId);
                        if (!asset) return null;

                        const isSelectedForPricing = selectedForPricing.has(
                          data.assetId
                        );

                        const articleIds = normalizeArticleIds(
                          asset.article_id,
                          asset.article_ids
                        );
                        const additionalArticleIds = getAdditionalArticleIds({
                          article_id: asset.article_id,
                          article_ids: articleIds,
                        });
                        const articleIdsTooltip =
                          getArticleIdsTooltip(articleIds);

                        return (
                          <tr
                            key={data.assetId}
                            className="transition-all duration-200"
                            style={{
                              borderTop: "1px solid var(--border-light)",
                              background: isSelectedForPricing
                                ? "var(--surface-elevated)"
                                : "transparent",
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelectedForPricing) {
                                e.currentTarget.style.background =
                                  "var(--surface-raised)";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelectedForPricing) {
                                e.currentTarget.style.background =
                                  "transparent";
                              }
                            }}
                          >
                            <td className="p-2 text-center">
                              {(() => {
                                const asset = getAssetById(data.assetId);
                                const hasExistingPricing =
                                  asset?.pricing_option_id &&
                                  asset?.price !== undefined &&
                                  (asset.price > 0 ||
                                    asset.qa_team_handles_model === true);

                                if (hasExistingPricing) {
                                  // Show disabled checkbox for admin-set pricing
                                  return (
                                    <div className="flex items-center justify-center">
                                      <Checkbox
                                        checked={false}
                                        disabled={true}
                                        className="opacity-30"
                                      />
                                    </div>
                                  );
                                } else {
                                  // Show active checkbox for manual pricing
                                  return (
                                    <Checkbox
                                      checked={isSelectedForPricing}
                                      onCheckedChange={() =>
                                        togglePricingSelection(data.assetId)
                                      }
                                    />
                                  );
                                }
                              })()}
                            </td>
                            <td className="p-2">
                              <div
                                className="truncate max-w-[200px] cursor-help"
                                title={asset.product_name}
                              >
                                {asset.product_name.length > 35
                                  ? asset.product_name.substring(0, 35) + "..."
                                  : asset.product_name}
                              </div>
                            </td>
                            <td className="p-2 text-muted-foreground font-mono text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span title={articleIdsTooltip || undefined}>
                                  {asset.article_id}
                                </span>
                                {additionalArticleIds.length > 0 && (
                                  <div className="flex flex-wrap justify-center gap-1">
                                    {additionalArticleIds.map((id) => (
                                      <Badge
                                        key={`${asset.id}-${id}`}
                                        variant="outline"
                                        className="px-1.5 py-0 text-[10px] uppercase tracking-wide text-muted-foreground border-border/60"
                                        title={id}
                                      >
                                        {id}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
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
                            <td className="p-2 text-center">
                              <div className="flex flex-col gap-1">
                                <Select
                                  value={data.pricingOptionId || ""}
                                  onValueChange={(value) => {
                                    const option = getPricingOptionById(value);
                                    if (option) {
                                      handlePriceUpdate(
                                        data.assetId,
                                        value,
                                        option.price
                                      );
                                    }
                                  }}
                                >
                                  <SelectTrigger className="w-32 h-8 text-xs">
                                    <SelectValue placeholder="Set price" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {getCurrentPricingOptions().map(
                                      (option) => (
                                        <SelectItem
                                          key={option.id}
                                          value={option.id}
                                        >
                                          <div className="flex items-center justify-between w-full">
                                            <div className="flex items-center gap-2 text-left">
                                              <Euro className="h-3 w-3" />
                                              {option.id === "custom_pricing"
                                                ? option.label
                                                : `${option.label} - €${option.price}`}
                                            </div>
                                            {option.id ===
                                              "qa_team_handles_model" && (
                                              <Badge
                                                variant="outline"
                                                className="ml-2 text-xs bg-amber-50 text-amber-700 border-amber-200"
                                              >
                                                QA Handles
                                              </Badge>
                                            )}
                                            {option.id === "custom_pricing" && (
                                              <Badge
                                                variant="outline"
                                                className="ml-2 text-xs bg-blue-50 text-blue-700 border-blue-200"
                                              >
                                                Custom
                                              </Badge>
                                            )}
                                          </div>
                                        </SelectItem>
                                      )
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                            </td>
                            <td className="p-2 text-center">
                              <div className="flex flex-col items-center gap-1">
                                {data.pricingOptionId === "custom_pricing" &&
                                !data.price ? (
                                  <div className="flex items-center gap-1">
                                    <Input
                                      type="number"
                                      value={customPrices[data.assetId] || ""}
                                      onChange={(e) =>
                                        handleCustomPriceChange(
                                          data.assetId,
                                          parseFloat(e.target.value) || 0
                                        )
                                      }
                                      onKeyDown={(e) => {
                                        if (
                                          e.key === "Enter" &&
                                          !settingPrices.has(data.assetId)
                                        ) {
                                          handleCustomPriceSubmit(data.assetId);
                                        }
                                      }}
                                      disabled={settingPrices.has(data.assetId)}
                                      className="w-16 h-8 text-xs px-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                      placeholder="€0"
                                      min="0"
                                      step="0.01"
                                    />
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 px-2 text-xs"
                                      onClick={() =>
                                        handleCustomPriceSubmit(data.assetId)
                                      }
                                      disabled={settingPrices.has(data.assetId)}
                                    >
                                      {settingPrices.has(data.assetId) ? (
                                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
                                      ) : (
                                        "Set"
                                      )}
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    {data.pricingOptionId ===
                                    "qa_team_handles_model" ? (
                                      <Badge
                                        variant="outline"
                                        className="text-xs bg-amber-50 text-amber-700 border-amber-200"
                                        title="QA team will handle this model"
                                      >
                                        0€ - QA Handling
                                      </Badge>
                                    ) : (
                                      <span className="text-xs font-medium">
                                        €{data.price || 0}
                                      </span>
                                    )}
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-4 w-4 p-0 hover:bg-muted"
                                        >
                                          <StickyNote
                                            className={`h-3 w-3 ${
                                              pricingComments[data.assetId]
                                                ? "text-blue-600 hover:text-blue-700"
                                                : "text-muted-foreground hover:text-foreground"
                                            }`}
                                          />
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-80 p-3">
                                        <div className="space-y-3">
                                          <h4 className="font-medium text-sm">
                                            Pricing Note
                                          </h4>
                                          <Textarea
                                            placeholder="Add pricing note..."
                                            value={
                                              pricingComments[data.assetId] ||
                                              ""
                                            }
                                            onChange={(e) => {
                                              setPricingComments((prev) => ({
                                                ...prev,
                                                [data.assetId]: e.target.value,
                                              }));
                                            }}
                                            onBlur={() => {
                                              if (
                                                pricingComments[
                                                  data.assetId
                                                ] !== undefined
                                              ) {
                                                handlePricingCommentUpdate(
                                                  data.assetId,
                                                  pricingComments[data.assetId]
                                                );
                                              }
                                            }}
                                            className="min-h-[60px] max-h-[120px] resize-none text-xs"
                                            rows={3}
                                          />
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                )}
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
              <div
                className="p-5 rounded-xl"
                style={{
                  background: "var(--surface-elevated)",
                  boxShadow: "var(--shadow-md)",
                  border: "1px solid var(--border-light)",
                }}
              >
                <h4
                  className="font-semibold mb-3"
                  style={{ color: "var(--foreground)" }}
                >
                  Summary
                </h4>
                <div className="space-y-2 text-sm">
                  <p style={{ color: "var(--foreground)" }}>
                    Assets with Pricing: {allocationData.length} of{" "}
                    {selectedAssets.size}
                  </p>
                  {allocationData.length > 0 && (
                    <>
                      <p style={{ color: "var(--foreground)" }}>
                        Base Total Price: €{totalBasePrice.toFixed(2)}
                      </p>
                      <p style={{ color: "var(--foreground)" }}>
                        Bonus Amount ({groupSettings.bonus}%): €
                        {totalBonusAmount.toFixed(2)}
                      </p>
                      <p style={{ color: "var(--foreground)" }}>
                        Total with Bonus: €{totalPriceWithBonus.toFixed(2)}
                      </p>
                      <p style={{ color: "var(--foreground)" }}>
                        Average Price: €
                        {(allocationData.length > 0
                          ? totalBasePrice / allocationData.length
                          : 0
                        ).toFixed(2)}
                      </p>
                    </>
                  )}
                  <p style={{ color: "var(--foreground)" }}>
                    Bonus: {groupSettings.bonus}%
                  </p>
                  <p style={{ color: "var(--foreground)" }}>
                    Deadline: {format(new Date(groupSettings.deadline), "PPP")}
                  </p>

                  {/* Project Specifications Note */}
                  <div
                    className="mt-4 p-3 rounded-lg"
                    style={{
                      background: "var(--info-muted)",
                      border: "1px solid var(--info)",
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    <p className="text-xs" style={{ color: "var(--info)" }}>
                      <strong>Note:</strong> Client specifications and project
                      requirements are now managed in the
                      <button
                        onClick={() => window.open("/users", "_blank")}
                        className="underline font-medium hover:opacity-80 cursor-pointer bg-transparent border-none p-0 ml-1"
                      >
                        Clients Management page
                      </button>
                      .
                    </p>
                  </div>
                </div>
              </div>

              {/* Step Navigation */}
              <div
                className="flex items-center justify-between pt-6 mt-6"
                style={{
                  borderTop: "1px solid var(--border-light)",
                }}
              >
                <Button
                  variant="outline"
                  onClick={handleBackStep}
                  className="flex items-center gap-2 transition-all duration-200"
                  style={{
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Team Assignment
                </Button>
                <div className="text-sm text-muted-foreground space-y-1">
                  {groupSettings.deadline &&
                  allocationData.length > 0 &&
                  allocationData.every(
                    (data) =>
                      data.pricingOptionId &&
                      (data.price > 0 ||
                        data.pricingOptionId === "qa_team_handles_model")
                  ) ? (
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
                    allocationData.some(
                      (data) =>
                        !data.pricingOptionId ||
                        (data.price <= 0 &&
                          data.pricingOptionId !== "qa_team_handles_model")
                    )
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
          </div>
        </div>
      )}

      {/* User Profile Dialog */}
      <UserProfileDialog
        isOpen={isProfileDialogOpen}
        onClose={handleCloseProfile}
        userId={selectedUserId}
        currentUserRole={user?.metadata?.role || "user"}
        currentUserId={currentUserId}
      />
    </div>
  );
}
