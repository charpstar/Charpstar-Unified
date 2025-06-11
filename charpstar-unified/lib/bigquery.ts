import { BigQuery } from "@google-cloud/bigquery";

// Parse credentials from environment variable
const credentials = JSON.parse(
  process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || "{}"
);

export const bigquery = new BigQuery({
  credentials,
  projectId: credentials.project_id,
});
