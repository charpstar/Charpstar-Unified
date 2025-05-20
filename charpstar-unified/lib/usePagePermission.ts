import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export function usePagePermission(role: string | undefined, page: string) {
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!role || !page) {
      setLoading(false);
      return;
    }

    const checkPermission = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("role_permissions")
        .select("can_access")
        .eq("role", role)
        .eq("page", page)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // No permission row found = treat as no access
          setHasAccess(false);
        } else {
          console.error("Permission check error:", error);
          setError(error.message);
        }
      } else {
        setHasAccess(data?.can_access === true);
      }

      setLoading(false);
    };

    checkPermission();
  }, [role, page]);

  return { hasAccess, loading, error };
}
