import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { executeClientQuery } from "@/utils/BigQuery/CVR";
import { useUser } from "@/contexts/useUser";
import { type TDatasets } from "@/utils/BigQuery/clientQueries";
import { supabase } from "@/lib/supabaseClient";

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

  useEffect(() => {
    if (user) {
      console.log("Analytics profile:", profile);
      console.log("Project ID:", projectId);
      console.log("Dataset ID:", datasetId);
    }
  }, [user, profile, projectId, datasetId]);

  const shouldEnableFetching = Boolean(
    user && projectId && datasetId && startTableName && endTableName
  );

  const {
    data: _clientQueryResult,
    isLoading: isQueryLoading,
    error: queryError,
  } = useQuery({
    queryKey: [
      "clientQuery",
      projectId!,
      datasetId!,
      startTableName,
      endTableName,
    ] as const,
    queryFn: async ({ queryKey }) => {
      // Ensure we have a valid session before making the query
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        // Try to refresh the session
        const {
          data: { session: refreshedSession },
          error: refreshError,
        } = await supabase.auth.refreshSession();

        if (refreshError || !refreshedSession) {
          throw new Error("Authentication failed. Please sign in again.");
        }
      }

      console.log("Executing client query with:", {
        projectId: queryKey[1],
        datasetId: queryKey[2],
        startTableName: queryKey[3],
        endTableName: queryKey[4],
      });

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
    retry: 1, // Only retry once on failure
    retryDelay: 1000, // Wait 1 second before retrying
  });

  useEffect(() => {
    if (queryError) {
      console.error("Client query error:", queryError);
      // If it's an authentication error, try to refresh the session
      if (queryError.message?.includes("Authentication failed")) {
        supabase.auth.refreshSession();
      }
    }
  }, [queryError]);

  return {
    clientQueryResult: _clientQueryResult ?? [],
    isQueryLoading,
    error: queryError,
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
