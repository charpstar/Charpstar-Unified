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

      try {
        // If role is 'authenticated', fetch the actual role from profiles
        let actualRole = role;
        if (role === "authenticated") {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) {
            setHasAccess(false);
            setLoading(false);
            return;
          }

          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

          if (profileError) {
            console.error("Error fetching profile:", profileError);
            setError(profileError.message);
            setLoading(false);
            return;
          }

          actualRole = profile?.role;
        }

        const { data, error } = await supabase
          .from("role_permissions")
          .select("can_access")
          .eq("role", actualRole)
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
      } catch (err) {
        console.error("Unexpected error in permission check:", err);
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred"
        );
      }

      setLoading(false);
    };

    checkPermission();
  }, [role, page]);

  return { hasAccess, loading, error };
}
