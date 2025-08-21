import { useUser } from "@/contexts/useUser";
import { useQuery } from "@tanstack/react-query";

interface AnalyticsProfile {
  datasetid:
    | "analytics_287358793"
    | "analytics_317975816"
    | "analytics_371791627"
    | "analytics_320210445"
    | "analytics_274422295"
    | "ewheelsGA4"
    | "analytics_351120479"
    | "analytics_389903836"
    | "analytics_311675532"
    | "analytics_296845812";
  projectid: string;
  tablename: string;
  monitoredsince: string;
  name: string;
}

interface UserMetadata {
  id: string;
  client: string | null;
  analytics_profile_id: string;
  analytics_profiles: AnalyticsProfile[];
}

export function useMonthlyTrends(effectiveProfile?: AnalyticsProfile) {
  const user = useUser();

  // Prefer effectiveProfile if provided, else fallback to user
  const datasetId =
    effectiveProfile?.datasetid ||
    (user?.metadata as unknown as UserMetadata)?.analytics_profiles?.[0]
      ?.datasetid;
  const projectId =
    effectiveProfile?.projectid ||
    (user?.metadata as unknown as UserMetadata)?.analytics_profiles?.[0]
      ?.projectid;

  return useQuery({
    queryKey: ["monthly-trends", datasetId, projectId],
    queryFn: async () => {
      if (!datasetId || !projectId) {
        throw new Error("Dataset ID or Project ID is missing");
      }
      const response = await fetch(
        `/api/monthly-trends?projectid=${projectId}&analytics_profile_id=${datasetId}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch monthly trends");
      }
      return response.json();
    },
    enabled: !!datasetId && !!projectId,
    staleTime: 1000 * 60 * 10, // 10 min "fresh"
    refetchOnWindowFocus: false, // Don't refetch just on window focus
    refetchOnMount: false, // Don't refetch just on remount
  });
}
