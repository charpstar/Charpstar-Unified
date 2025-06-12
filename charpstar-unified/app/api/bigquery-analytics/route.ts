import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

export async function GET(request: Request) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");
    const projectId = searchParams.get("projectid");
    const datasetId = searchParams.get("analytics_profile_id");

    if (!query) {
      return NextResponse.json(
        { error: "Query parameter is required" },
        { status: 400 }
      );
    }

    if (!projectId || !datasetId) {
      return NextResponse.json(
        { error: "Missing required query parameters" },
        { status: 400 }
      );
    }

    // Execute query
    const [rows] = await bigquery.query({ query });

    // Transform the data to flatten nested objects
    const transformedRows = rows.map((row: any) => {
      const transformed: Record<string, any> = {};
      Object.entries(row).forEach(([key, value]) => {
        if (value && typeof value === "object" && "value" in value) {
          transformed[key] = value.value;
        } else {
          transformed[key] = value;
        }
      });
      return transformed;
    });

    // Return the data
    return NextResponse.json({ data: transformedRows });
  } catch (error: any) {
    console.error("BigQuery API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch data from BigQuery" },
      { status: 500 }
    );
  }
}
