import { useQuery } from "@tanstack/react-query";

import { executeClientQuery } from "@/utils/BigQuery/CVR";
import { useUser } from "@/contexts/useUser";
import { type TDatasets } from "@/utils/BigQuery/clientQueries";

type AnalyticsProfile = {
  name: string;
  datasetid: TDatasets;
  projectid: string;
  tablename: string;
  monitoredsince: string;
};

export function useClientQuery({
  startTableName,
  endTableName,
  limit,
}: {
  startTableName: string;
  endTableName: string;
  limit: number;
}) {
  const user = useUser();
  const profile = user?.metadata?.analytics_profiles as
    | AnalyticsProfile
    | undefined;
  const projectId = profile?.projectid;
  const datasetId = profile?.datasetid;

  const shouldEnableFetching = Boolean(
    user && projectId && datasetId && startTableName && endTableName
  );

  const { data: _clientQueryResult, isLoading: isQueryLoading } = useQuery({
    queryKey: [
      "clientQuery",
      projectId!,
      datasetId!,
      startTableName,
      endTableName,
    ] as const,
    queryFn: ({ queryKey }) => {
      return executeClientQuery({
        projectId: queryKey[1],
        datasetId: queryKey[2],
        startTableName: queryKey[3],
        endTableName: queryKey[4],
      });
    },
    enabled: shouldEnableFetching,
    // Caching configuration
    gcTime: 30 * 60 * 1000, // Keep unused data in cache for 30 minutes
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return {
    clientQueryResult: _clientQueryResult ?? [],
    isQueryLoading,
  };
}

export function executeClientQueryFn({
  queryKey,
}: {
  queryKey: [string, string, TDatasets, string, string];
}) {
  const [, projectId, datasetId, startTableName, endTableName] = queryKey;

  return executeClientQuery({
    projectId,
    datasetId,

    startTableName,
    endTableName,
  });
}
