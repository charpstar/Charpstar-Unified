import { BigQuery } from "@google-cloud/bigquery";

// Parse credentials from environment variable with better error handling
let credentials;
try {
  const rawCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  console.log("Raw credentials length:", rawCredentials?.length);
  console.log("First 50 chars:", rawCredentials?.substring(0, 50));

  if (!rawCredentials) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS_JSON is not set");
  }

  credentials = JSON.parse(rawCredentials);
} catch (error) {
  console.error("Error parsing credentials:", error);
  console.error(
    "Raw credentials:",
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  );
  credentials = {};
}

export const bigquery = new BigQuery({
  credentials,
  projectId: credentials.project_id,
});
