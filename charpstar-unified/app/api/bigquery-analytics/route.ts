import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getUserWithMetadata } from "@/supabase/getUser";

export async function GET(request: Request) {
  try {
    // 1. Get the user's session and metadata
    const supabase = createRouteHandlerClient({ cookies });
    const user = await getUserWithMetadata(supabase);

    // 2. Check if user is authenticated and has analytics profile
    if (!user?.metadata?.analytics_profiles) {
      return NextResponse.json(
        { error: "No analytics profile found" },
        { status: 404 }
      );
    }

    // Type assertion for analytics profile
    const analytics = user.metadata.analytics_profiles as unknown as {
      projectid: string;
      datasetid: string;
    };

    // Get query parameter
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");

    if (!query) {
      return NextResponse.json(
        { error: "Query parameter is required" },
        { status: 400 }
      );
    }

    // Execute query
    console.log("Executing BigQuery with project:", analytics.projectid);
    const [rows] = await bigquery.query({ query });
    console.log("Query executed successfully, rows:", rows.length);

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
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      status: error.status,
      details: error.details,
    });
    return NextResponse.json(
      { error: error.message || "Failed to fetch data from BigQuery" },
      { status: 500 }
    );
  }
}
