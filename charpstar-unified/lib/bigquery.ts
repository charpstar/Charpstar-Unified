import { BigQuery } from "@google-cloud/bigquery";

// Parse credentials from base64 encoded environment variable
let credentials;
try {
  const base64Credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64;
  if (!base64Credentials) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS_BASE64 is not set");
  }
  const jsonString = Buffer.from(base64Credentials, "base64").toString();
  credentials = JSON.parse(jsonString);
} catch (error) {
  console.error("Error parsing credentials:", error);
  credentials = {};
}

// Initialize BigQuery with credentials directly
export const bigquery = new BigQuery({
  credentials: {
    client_email: credentials.client_email,
    private_key: credentials.private_key,
    project_id: credentials.project_id,
  },
  projectId: credentials.project_id,
});
