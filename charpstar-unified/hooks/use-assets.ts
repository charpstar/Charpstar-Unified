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
  article_id?: string;
  product_link?: string;
  glb_link?: string;
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

interface PaginatedAssetsResponse extends AssetsResponse {
  page: number;
  pageSize: number;
}

// Fetch ONLY unique filter values (not full assets) - Much more efficient!
const fetchFilterOptions = async (
  user: any,
  userProfile: any
): Promise<{
  categories: Set<string>;
  subcategories: Map<string, Set<string>>;
  clients: Set<string>;
  materials: Set<string>;
  colors: Set<string>;
}> => {
  if (!user || !userProfile)
    return {
      categories: new Set(),
      subcategories: new Map(),
      clients: new Set(),
      materials: new Set(),
      colors: new Set(),
    };

  const supabase = createClient();

  // Fetch only the fields needed for filters - MUCH smaller payload
  const filterFields = `category, subcategory, client, materials, colors`;

  let query = supabase.from("assets").select(filterFields);

  // Only apply client filter if user is not admin
  if (
    userProfile.role !== "admin" &&
    userProfile.client &&
    userProfile.client.length > 0
  ) {
    query = query.in("client", userProfile.client);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Extract unique values
  const categories = new Set<string>();
  const subcategories = new Map<string, Set<string>>();
  const clients = new Set<string>();
  const materials = new Set<string>();
  const colors = new Set<string>();

  (data || []).forEach((item: any) => {
    if (item.category) {
      categories.add(item.category);

      if (item.subcategory) {
        if (!subcategories.has(item.category)) {
          subcategories.set(item.category, new Set());
        }
        subcategories.get(item.category)?.add(item.subcategory);
      }
    }

    if (item.client) clients.add(item.client);

    if (Array.isArray(item.materials)) {
      item.materials.forEach((m: string) => materials.add(m));
    }

    if (Array.isArray(item.colors)) {
      item.colors.forEach((c: string) => colors.add(c));
    }
  });

  return { categories, subcategories, clients, materials, colors };
};

// Fetch paginated assets with server-side filtering
const fetchPaginatedAssets = async (
  user: any,
  userProfile: any,
  page: number,
  pageSize: number,
  filters: FilterState,
  searchTerm: string,
  selectedMaterials: string[],
  selectedColors: string[],
  selectedCompanies: string[],
  showInactiveOnly: boolean
): Promise<PaginatedAssetsResponse> => {
  if (!user || !userProfile)
    return { assets: [], totalCount: 0, page, pageSize };

  const supabase = createClient();

  // Optimized query: Select only essential fields for list view
  const selectFields = `
    id,
    product_name,
    article_id,
    preview_image,
    category,
    subcategory,
    client,
    materials,
    colors,
    tags,
    active,
    created_at,
    updated_at
  `.trim();

  // Build the query with filters
  let query = supabase.from("assets").select(selectFields, { count: "exact" });

  // Apply client filter if user is not admin
  if (
    userProfile.role !== "admin" &&
    userProfile.client &&
    userProfile.client.length > 0
  ) {
    query = query.in("client", userProfile.client);
  }

  // Apply category filter
  if (filters.category) {
    query = query.eq("category", filters.category);
  }

  // Apply subcategory filter
  if (filters.subcategory) {
    query = query.eq("subcategory", filters.subcategory);
  }

  // Apply client/company filter (if selected in UI)
  if (selectedCompanies && selectedCompanies.length > 0) {
    query = query.in("client", selectedCompanies);
  }

  // Apply material filter (contains any of the selected materials)
  if (selectedMaterials && selectedMaterials.length > 0) {
    query = query.overlaps("materials", selectedMaterials);
  }

  // Apply color filter (contains any of the selected colors)
  if (selectedColors && selectedColors.length > 0) {
    query = query.overlaps("colors", selectedColors);
  }

  // Apply active/inactive filter
  if (showInactiveOnly) {
    query = query.eq("active", false);
  }

  // Apply sorting
  switch (filters.sort) {
    case "name-asc":
      query = query.order("product_name", { ascending: true });
      break;
    case "name-desc":
      query = query.order("product_name", { ascending: false });
      break;
    case "date-asc":
      query = query.order("created_at", { ascending: true });
      break;
    case "date-desc":
      query = query.order("created_at", { ascending: false });
      break;
    case "updated-desc":
      query = query.order("updated_at", {
        ascending: false,
        nullsFirst: false,
      });
      break;
    default:
      query = query.order("product_name", { ascending: true });
  }

  // Apply pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) throw error;

  // Parse materials, colors, and tags from jsonb fields
  const parsedAssets = (data || []).map((item: any) => ({
    ...item,
    materials: Array.isArray(item.materials) ? item.materials : [],
    colors: Array.isArray(item.colors) ? item.colors : [],
    tags: Array.isArray(item.tags) ? item.tags : [],
  }));

  return {
    assets: parsedAssets,
    totalCount: count || 0,
    page,
    pageSize,
  };
};

export function useAssets(
  currentPage: number = 1,
  pageSize: number = 60,
  selectedMaterials: string[] = [],
  selectedColors: string[] = [],
  selectedCompanies: string[] = [],
  showInactiveOnly: boolean = false
) {
  const [filters, setFilters] = useState<FilterState>({
    search: [],
    category: null,
    subcategory: null,
    client: [],
    material: [],
    color: [],
    sort: "name-asc",
  });
  const [searchTerm, setSearchTerm] = useState("");
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
  }, [user?.id]);

  // Create a stable query key for filter options
  const filterQueryKey = useMemo(() => {
    if (!user?.id || !userProfile) return null;
    return [
      "assets-filter-options",
      user.id,
      JSON.stringify(userProfile.client),
      userProfile.role,
    ];
  }, [user?.id, userProfile?.client, userProfile?.role]);

  // Fetch ONLY unique filter values (not full assets) - Much more efficient!
  const { data: filterData } = useQuery<{
    categories: Set<string>;
    subcategories: Map<string, Set<string>>;
    clients: Set<string>;
    materials: Set<string>;
    colors: Set<string>;
  }>({
    queryKey: filterQueryKey || ["assets-filter-options"],
    queryFn: () => fetchFilterOptions(user, userProfile),
    enabled: !!user && !!userProfile && !!filterQueryKey,
    staleTime: 15 * 60 * 1000, // 15 minutes (filter options change less frequently)
    gcTime: 60 * 60 * 1000, // 60 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Create a stable query key for paginated data
  const paginatedQueryKey = useMemo(() => {
    if (!user?.id || !userProfile) return null;
    return [
      "assets-paginated",
      user.id,
      JSON.stringify(userProfile.client),
      userProfile.role,
      currentPage,
      pageSize,
      JSON.stringify(filters),
      searchTerm,
      JSON.stringify(selectedMaterials),
      JSON.stringify(selectedColors),
      JSON.stringify(selectedCompanies),
      showInactiveOnly,
    ];
  }, [
    user?.id,
    userProfile?.client,
    userProfile?.role,
    currentPage,
    pageSize,
    filters,
    searchTerm,
    selectedMaterials,
    selectedColors,
    selectedCompanies,
    showInactiveOnly,
  ]);

  // Use React Query to fetch paginated assets
  const {
    data: paginatedData,
    isLoading,
    error,
    refetch,
  } = useQuery<PaginatedAssetsResponse>({
    queryKey: paginatedQueryKey || ["assets-paginated"],
    queryFn: () =>
      fetchPaginatedAssets(
        user,
        userProfile,
        currentPage,
        pageSize,
        filters,
        searchTerm,
        selectedMaterials,
        selectedColors,
        selectedCompanies,
        showInactiveOnly
      ),
    enabled: !!user && !!userProfile && !!paginatedQueryKey,
    staleTime: 5 * 60 * 1000, // 5 minutes for paginated data
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Generate filter options from the unique values
  const filterOptions = useMemo(() => {
    if (!filterData)
      return {
        categories: [],
        clients: [],
        materials: [],
        colors: [],
      };

    // Convert categories Set to array with subcategories
    const categories = Array.from(filterData.categories).map((category) => ({
      id: category,
      name: category,
      subcategories: Array.from(
        filterData.subcategories.get(category) || []
      ).map((subcategory) => ({
        id: subcategory,
        name: subcategory,
      })),
    }));

    // Convert clients Set to array
    const clients = Array.from(filterData.clients).map((client) => ({
      id: client,
      name: client,
    }));

    // Convert materials Set to array
    const materials = Array.from(filterData.materials).map((material) => ({
      id: material,
      name: material,
    }));

    // Convert colors Set to array
    const colors = Array.from(filterData.colors).map((color) => ({
      id: color,
      name: color,
    }));

    return {
      categories,
      clients,
      materials,
      colors,
    };
  }, [filterData]);

  return {
    assets: paginatedData?.assets || [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refetch,
    filters,
    setFilters,
    setSearchTerm,
    filterOptions,
    totalCount: paginatedData?.totalCount || 0,
    filteredAssets: paginatedData?.assets || [], // For compatibility
    currentPage: paginatedData?.page || currentPage,
    pageSize: paginatedData?.pageSize || pageSize,
  };
}
