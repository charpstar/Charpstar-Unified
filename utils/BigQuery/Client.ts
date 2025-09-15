import { BigQuery } from "@google-cloud/bigquery";
import { getGCPCredentials } from "@/supabase/getGCPCredentials";

export function getBigQueryClient({ projectId }: { projectId: string }) {
  const { credentials, projectId: envProjectId } = getGCPCredentials();

  return new BigQuery({
    projectId: projectId || envProjectId,
    credentials,
  });
}
