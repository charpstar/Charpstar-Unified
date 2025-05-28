import { useUser } from "@/contexts/useUser";
import { getMonthlyTrends } from "@/utils/BigQuery/getMonthlyTrends";
import { useQuery } from "@tanstack/react-query";

export function useMonthlyTrends(effectiveProfile?: any) {
  const user = useUser();

  // Prefer effectiveProfile if provided, else fallback to user
  const datasetId =
    effectiveProfile?.datasetid ||
    user?.metadata?.analytics_profiles?.datasetid;
  const projectId =
    effectiveProfile?.projectid ||
    user?.metadata?.analytics_profiles?.projectid;

  return useQuery({
    queryKey: ["monthly-trends", datasetId, projectId],
    queryFn: async () => {
      if (!datasetId || !projectId) {
        throw new Error("Dataset ID or Project ID is missing");
      }
      return getMonthlyTrends({ datasetId, projectId });
    },
    enabled: !!datasetId && !!projectId,
    staleTime: 1000 * 60 * 10, // 10 min "fresh"
    refetchOnWindowFocus: false, // Don't refetch just on window focus
    refetchOnMount: false, // Don't refetch just on remount
  });
}
