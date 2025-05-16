import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function useFeaturePermission(
  role: string | undefined,
  feature: string
) {
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!role) {
      setHasAccess(false);
      setLoading(false);
      return;
    }
    async function checkPermission() {
      setLoading(true);
      const { data, error } = await supabase
        .from("role_feature_permissions")
        .select("can_access")
        .eq("role", role)
        .eq("feature", feature)
        .maybeSingle();

      if (error || !data) {
        console.warn("Permission missing or error:", error?.message);
        setHasAccess(false); // default to false
      } else {
        setHasAccess(!!data.can_access);
      }

      setLoading(false);
    }
    checkPermission();
  }, [role, feature]);

  return { hasAccess, loading };
}
