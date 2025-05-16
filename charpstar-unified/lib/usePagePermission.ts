import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function usePagePermission(role: string | undefined, page: string) {
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkPermission() {
      if (!role || !page) {
        setHasAccess(false);
        setLoading(false);
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from("role_permissions")
        .select("can_access")
        .eq("role", role)
        .eq("page", page)
        .maybeSingle();

      if (!cancelled) {
        if (error || !data) {
          console.warn(
            `[Permission Check] ${role} → ${page}:`,
            error?.message || "No data"
          );
          setHasAccess(false);
        } else {
          setHasAccess(!!data.can_access);
        }
        setLoading(false);
      }
    }

    checkPermission();

    return () => {
      cancelled = true;
    };
  }, [role, page]);

  return { hasAccess, loading };
}
