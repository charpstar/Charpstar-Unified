import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import _ from "lodash";
import { useUser } from "@/contexts/useUser";

export type SortOption = "name-asc" | "name-desc" | "date-asc" | "date-desc";

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
  preview_image: string;
  created_at: string;
}

export function useAssets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  const fetchAssets = async () => {
    try {
      setLoading(true);
      setError(null);

      // Don't fetch if user is not loaded yet
      if (!user) return;

      const supabase = createClient();

      let query = supabase.from("assets").select("*");

      // Apply client filter if user has a client
      if (user.metadata?.client) {
        query = query.eq("client", user.metadata.client);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Parse materials, colors, and tags from string arrays
      const parsedAssets = data.map((item) => ({
        ...item,
        materials: Array.isArray(item.materials)
          ? item.materials
          : JSON.parse(item.materials || "[]"),
        colors: Array.isArray(item.colors)
          ? item.colors
          : JSON.parse(item.colors || "[]"),
        tags: Array.isArray(item.tags)
          ? item.tags
          : JSON.parse(item.tags || "[]"),
      }));

      setAssets(parsedAssets);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [user]);

  // Filter assets based on current filters
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
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

      // Color filter - show only products that have ALL selected colors
      if (
        filters.color.length > 0 &&
        !filters.color.every((color) => asset.colors.includes(color))
      ) {
        return false;
      }

      return true;
    });
  }, [assets, filters]);

  // Generate filter options based on filtered assets
  const filterOptions = useMemo(() => {
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
  }, [filteredAssets]);

  return {
    assets: filteredAssets,
    loading,
    error,
    refetch: fetchAssets,
    filters,
    setFilters,
    filterOptions,
  };
}
