import { BigQuery } from "@google-cloud/bigquery";

// Function to safely load credentials from env variable
function getCredentialsFromEnv() {
  const rawCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!rawCredentials) return undefined; // Return undefined to let ADC be used locally

  try {
    // Try to parse the JSON credentials string
    return JSON.parse(rawCredentials);
  } catch (error) {
    console.error(
      "Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:",
      error
    );
    console.error(
      "Raw credentials string (first 100 chars):",
      rawCredentials?.substring(0, 100)
    );
    throw new Error("Invalid Google credentials JSON in env variable.");
  }
}

const credentials = getCredentialsFromEnv();

export const bigquery = credentials
  ? new BigQuery({
      credentials,
      projectId: credentials.project_id, // Make sure projectId is set (sometimes needed)
    })
  : new BigQuery(); // Use ADC (works locally with gcloud etc.)
