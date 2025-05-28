import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { executeClientQuery } from "@/utils/BigQuery/CVR";
import { useUser } from "@/contexts/useUser";
import { type TDatasets } from "@/utils/BigQuery/clientQueries";
import { supabase } from "@/lib/supabaseClient";
import { getEventsBetween } from "@/utils/BigQuery/utils";

type AnalyticsProfile = {
  name: string;
  datasetid: TDatasets;
  projectid: string;
  tablename: string;
  monitoredsince: string;
};

type RawMetric = {
  data_type: "overall" | "product";
  metric_name: string;
  metrics: string;
};

type TransformedMetric = {
  product_name: string;
  AR_Button_Clicks: number;
  _3D_Button_Clicks: number;
  total_button_clicks: number;
  total_purchases: number;
  total_views: number;
  purchases_with_service: number;
  product_conv_rate: number;
  default_conv_rate: number;
  avg_session_duration_seconds: number;
  avg_combined_session_duration: number;
};

function transformMetrics(rawData: RawMetric[]): TransformedMetric[] {
  // Filter only product metrics and transform them
  return rawData
    .filter((item) => item.data_type === "product")
    .map((item) => {
      const metrics = JSON.parse(item.metrics);
      return {
        product_name: item.metric_name,
        AR_Button_Clicks: parseInt(metrics.AR_Button_Clicks || "0"),
        _3D_Button_Clicks: parseInt(metrics._3D_Button_Clicks || "0"),
        total_button_clicks: parseInt(metrics.total_button_clicks || "0"),
        total_purchases: parseInt(metrics.total_purchases || "0"),
        total_views: parseInt(metrics.total_views || "0"),
        purchases_with_service: parseInt(metrics.purchases_with_service || "0"),
        product_conv_rate: parseFloat(metrics.product_conv_rate || "0"),
        default_conv_rate: parseFloat(metrics.default_conv_rate || "0"),
        avg_session_duration_seconds: parseFloat(
          metrics.avg_session_duration_seconds || "0"
        ),
        avg_combined_session_duration: parseFloat(
          metrics.avg_combined_session_duration || "0"
        ),
      };
    });
}

export function useClientQuery({
  startTableName,
  endTableName,
  limit,
  effectiveProfile,
}: {
  startTableName: string;
  endTableName: string;
  limit: number;
  effectiveProfile?: any;
}) {
  const user = useUser();
  const profile = user?.metadata?.analytics_profiles as
    | AnalyticsProfile
    | undefined;
  // Prefer effectiveProfile if provided, else fallback to user
  const projectId = effectiveProfile?.projectid || profile?.projectid;
  const datasetId = effectiveProfile?.datasetid || profile?.datasetid;

  const shouldEnableFetching = Boolean(
    projectId && datasetId && startTableName && endTableName
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

      try {
        const result = await executeClientQuery({
          projectId: queryKey[1],
          datasetId: queryKey[2],
          startTableName: queryKey[3],
          endTableName: queryKey[4],
        });

        // Transform the data
        const transformedData = transformMetrics(
          result as unknown as RawMetric[]
        );
        return transformedData;
      } catch (error) {
        console.error("Query execution error:", error);
        throw error;
      }
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
