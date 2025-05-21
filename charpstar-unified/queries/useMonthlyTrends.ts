import { useUser } from "@/contexts/useUser";
import { getMonthlyTrends } from "@/utils/BigQuery/getMonthlyTrends";
import { useQuery } from "@tanstack/react-query";

export function useMonthlyTrends() {
  const user = useUser();

  // Get analytics profile details as object
  const datasetId = user?.metadata?.analytics_profiles?.datasetid;
  const projectId = user?.metadata?.analytics_profiles?.projectid;

  // Optionally log for dev/debugging
  // console.log("datasetId:", datasetId, "projectId:", projectId);

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
