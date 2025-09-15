// Define shared types for BigQuery operations
export interface BigQueryResponse {
  data_type: "product" | "overall";
  metric_name: string;
  metrics: string; // JSON string
}

export interface ProductMetrics {
  product_name: string;
  _3d_sessions: number;
  ar_sessions: number;
  total_button_clicks: number;
  total_purchases: number;
  total_views: number;
  purchases_with_service: number;
  product_conv_rate: number;
  default_conv_rate: number;
  avg_session_duration_seconds: number;
  avg_combined_session_duration: number;
}

export interface QueryConfig {
  projectId: string;
  datasetId: string;
  startTableName: string;
  endTableName: string;
}
