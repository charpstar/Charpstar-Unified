import { BigQuery } from "@google-cloud/bigquery";

// Parse credentials from environment variable
const credentials = JSON.parse(
  process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || "{}"
);

// Initialize BigQuery with credentials directly
export const bigquery = new BigQuery({
  credentials: {
    client_email: credentials.client_email,
    private_key: credentials.private_key,
    project_id: credentials.project_id,
  },
  projectId: credentials.project_id,
});
