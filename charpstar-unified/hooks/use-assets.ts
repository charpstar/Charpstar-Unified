import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import _ from "lodash";
import { useUser } from "@/contexts/useUser";
import { useQuery } from "@tanstack/react-query";

export type SortOption =
  | "name-asc"
  | "name-desc"
  | "date-asc"
  | "date-desc"
  | "updated-desc";

export type FilterState = {
  search: string[];
  category: string | null;
  subcategory: string | null;
  client: string[];
  material: string[];
  color: string[];
  sort: SortOption;
};

export type FilterOptions = {
  categories: Array<{
    id: string;
    name: string;
    subcategories: Array<{
      id: string;
      name: string;
    }>;
  }>;
  clients: Array<{ value: string; label: string }>;
  materials: Array<{ value: string; label: string }>;
  colors: Array<{ value: string; label: string }>;
};

interface Asset {
  id: string;
  product_name: string;
  product_link: string;
  glb_link: string;
  category: string;
  subcategory: string;
  client: string;
  materials: string[];
  colors: string[];
  tags: string[];
  preview_image: string | string[];
  created_at: string;
  updated_at?: string;
  active?: boolean;
}

interface AssetsResponse {
  assets: Asset[];
  totalCount: number;
}

const fetchAssets = async (
  user: any,
  userProfile: any
): Promise<AssetsResponse> => {
  if (!user || !userProfile) return { assets: [], totalCount: 0 };

  const supabase = createClient();

  // First get the total count
  let countQuery = supabase
    .from("assets")
    .select("*", { count: "exact", head: true });

  // Only apply client filter if user is not admin
  if (
    userProfile.role !== "admin" &&
    userProfile.client &&
    userProfile.client.length > 0
  ) {
    // Fetch assets where client is IN the user's array of companies
    countQuery = countQuery.in("client", userProfile.client);
  }

  const { count } = await countQuery;

  // Then fetch all assets with pagination
  let allAssets: Asset[] = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    let dataQuery = supabase
      .from("assets")
      .select("*")
      .range(page * pageSize, (page + 1) * pageSize - 1);

    // Only apply client filter if user is not admin
    if (
      userProfile.role !== "admin" &&
      userProfile.client &&
      userProfile.client.length > 0
    ) {
      // Fetch assets where client is IN the user's array of companies
      dataQuery = dataQuery.in("client", userProfile.client);
    }

    const { data, error } = await dataQuery;

    if (error) throw error;
    if (!data || data.length === 0) break;

    allAssets = [...allAssets, ...data];
    page++;

    // If we got less than pageSize items, we've reached the end
    if (data.length < pageSize) break;
  }

  // Parse materials, colors, and tags from jsonb fields
  const parsedAssets = allAssets.map((item) => ({
    ...item,
    materials: Array.isArray(item.materials) ? item.materials : [],
    colors: Array.isArray(item.colors) ? item.colors : [],
    tags: Array.isArray(item.tags) ? item.tags : [],
  }));

  return { assets: parsedAssets, totalCount: count || 0 };
};

export function useAssets() {
  const [filters, setFilters] = useState<FilterState>({
    search: [],
    category: null,
    subcategory: null,
    client: [],
    material: [],
    color: [],
    sort: "name-asc",
  });
  const user = useUser();
  const [userProfile, setUserProfile] = useState<{
    client: string[] | null;
    role: string;
  } | null>(null);

  // Fetch user profile when user changes
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) {
        setUserProfile(null);
        return;
      }
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("client, role")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error fetching user profile:", error);
        setUserProfile(null);
        return;
      }

      // Only update if the data is actually different
      setUserProfile((prev) => {
        if (
          !prev ||
          JSON.stringify(prev.client) !== JSON.stringify(data.client) ||
          prev.role !== data.role
        ) {
          return data;
        }
        return prev;
      });
    };

    fetchUserProfile();
  }, [user?.id]); // Only depend on user.id, not the entire user object

  // Create a stable query key
  const queryKey = useMemo(() => {
    if (!user?.id || !userProfile) return null;
    return [
      "assets",
      user.id,
      JSON.stringify(userProfile.client),
      userProfile.role,
    ];
  }, [user?.id, userProfile?.client, userProfile?.role]);

  // Use React Query to fetch and cache assets
  const { data, isLoading, error, refetch } = useQuery<AssetsResponse>({
    queryKey: queryKey || ["assets"],
    queryFn: () => fetchAssets(user, userProfile),
    enabled: !!user && !!userProfile && !!queryKey,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep data in cache for 30 minutes
    refetchOnWindowFocus: false, // Prevent refetch on window focus
    refetchOnMount: false, // Prevent refetch on mount if data exists
  });

  // Filter assets based on current filters
  const filteredAssets = useMemo(() => {
    if (!data?.assets) return [];

    return data.assets.filter((asset: Asset) => {
      // Category filter
      if (filters.category && asset.category !== filters.category) {
        return false;
      }

      // Subcategory filter
      if (filters.subcategory && asset.subcategory !== filters.subcategory) {
        return false;
      }

      // Client filter
      if (filters.client.length > 0 && !filters.client.includes(asset.client)) {
        return false;
      }

      // Material filter
      if (
        filters.material.length > 0 &&
        !filters.material.every((material) =>
          asset.materials.includes(material)
        )
      ) {
        return false;
      }

      // Color filter
      if (
        filters.color.length > 0 &&
        !filters.color.every((color) => asset.colors.includes(color))
      ) {
        return false;
      }

      return true;
    });
  }, [data?.assets, filters]);

  // Generate filter options based on filtered assets
  const filterOptions = useMemo(() => {
    if (!data?.assets)
      return {
        categories: [],
        clients: [],
        materials: [],
        colors: [],
      };

    // First filter assets based on current filters
    let filteredAssets = data.assets;

    // Apply category filter
    if (filters.category) {
      filteredAssets = filteredAssets.filter(
        (asset) => asset.category === filters.category
      );
    }

    // Apply subcategory filter
    if (filters.subcategory) {
      filteredAssets = filteredAssets.filter(
        (asset) => asset.subcategory === filters.subcategory
      );
    }

    // Apply client filter
    if (filters.client.length > 0) {
      filteredAssets = filteredAssets.filter((asset) =>
        filters.client.includes(asset.client)
      );
    }

    // Apply material filter
    if (filters.material.length > 0) {
      filteredAssets = filteredAssets.filter((asset) =>
        filters.material.every((material) => asset.materials.includes(material))
      );
    }

    // Apply color filter
    if (filters.color.length > 0) {
      filteredAssets = filteredAssets.filter((asset) =>
        filters.color.every((color) => asset.colors.includes(color))
      );
    }

    // Get unique categories and subcategories from filtered assets
    const categories = Array.from(
      new Set(filteredAssets.map((asset) => asset.category))
    ).map((category) => ({
      id: category,
      name: category,
      subcategories: Array.from(
        new Set(
          filteredAssets
            .filter((asset) => asset.category === category)
            .map((asset) => asset.subcategory)
        )
      )
        .filter(Boolean)
        .map((subcategory) => ({
          id: subcategory,
          name: subcategory,
        })),
    }));

    // Get unique clients from filtered assets
    const clients = Array.from(
      new Set(filteredAssets.map((asset) => asset.client))
    ).map((client) => ({
      value: client,
      label: client,
    }));

    // Get unique materials from filtered assets
    const materials = Array.from(
      new Set(filteredAssets.flatMap((asset) => asset.materials))
    ).map((material) => ({
      value: material,
      label: material,
    }));

    // Get unique colors from filtered assets
    const colors = Array.from(
      new Set(filteredAssets.flatMap((asset) => asset.colors))
    ).map((color) => ({
      value: color,
      label: color,
    }));

    return {
      categories,
      clients,
      materials,
      colors,
    };
  }, [data?.assets, filters]);

  return {
    assets: data?.assets || [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refetch,
    filters,
    setFilters,
    filterOptions,
    totalCount: data?.totalCount || 0,
    filteredAssets,
  };
}
