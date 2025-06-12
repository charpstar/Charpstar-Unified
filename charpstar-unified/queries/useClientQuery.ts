import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { executeClientQuery } from "@/utils/BigQuery/CVR";
import { useUser } from "@/contexts/useUser";
import { type TDatasets } from "@/utils/BigQuery/clientQueries";
import { supabase } from "@/lib/supabaseClient";
import { getEventsBetween } from "@/utils/BigQuery/utils";

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
  effectiveProfile?: AnalyticsProfile;
}) {
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

  const shouldEnableFetching = Boolean(
    projectId && datasetId && startTableName && endTableName
  );

  const {
    data: _clientQueryResult,
    isLoading: isQueryLoading,
    error: queryError,
  } = useQuery({
    queryKey: [
      "client-query",
      datasetId,
      projectId,
      startTableName,
      endTableName,
    ],
    queryFn: async () => {
      if (!datasetId || !projectId) {
        throw new Error("Dataset ID or Project ID is missing");
      }
      const response = await fetch(
        `/api/bigquery-analytics?projectid=${projectId}&analytics_profile_id=${datasetId}&startDate=${startTableName}&endDate=${endTableName}&limit=${limit}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch CVR table data");
      }
      return response.json();
    },
    enabled: shouldEnableFetching,
    staleTime: 1000 * 60 * 10, // 10 min "fresh"
    refetchOnWindowFocus: false,
    refetchOnMount: false,
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
