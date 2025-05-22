import type { SupabaseClient } from "@supabase/supabase-js";
import { type TDatasets } from "@/utils/BigQuery/clientQueries";

export async function getUser(supabase: SupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return user;
}

export async function getUserMetadata(
  supabase: SupabaseClient,
  user_id: string
) {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      `
    id,
    analytics_profile_id,
    analytics_profiles:analytics_profile_id (
      projectid,
      datasetid,
      tablename,
      monitoredsince,
      name
    )
  `
    )
    .eq("id", user_id)
    .single();

  return data as {
    id: string;
    analytics_profile_id: string;
    analytics_profiles: {
      projectid: string;
      datasetid: TDatasets;
      tablename: string;
      monitoredsince: string;
      name: string;
    }[];
  };
}

export async function getUserWithMetadata(supabase: SupabaseClient) {
  const user = await getUser(supabase);
  if (!user) return null;

  const metadata = await getUserMetadata(supabase, user.id);
  if (!metadata) return null;

  return {
    ...user,
    metadata,
  };
}
