import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  try {
    // 1. Get the user's session
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // 2. Check if user is authenticated
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 3. Get user metadata
    const { data: user } = await supabase
      .from("users")
      .select("metadata")
      .eq("id", session.user.id)
      .single();

    // 4. Check if user has analytics profile
    if (!user?.metadata?.analytics_profiles) {
      return NextResponse.json(
        { error: "No analytics profile found" },
        { status: 404 }
      );
    }

    const analytics = user.metadata.analytics_profiles;

    // 5. Get query parameters
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");

    if (!query) {
      return NextResponse.json(
        { error: "Query parameter is required" },
        { status: 400 }
      );
    }

    // 6. Execute query
    const [rows] = await bigquery.query({ query });

    // 7. Return the data
    return NextResponse.json({ data: rows });
  } catch (error: any) {
    console.error("BigQuery API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch data from BigQuery" },
      { status: 500 }
    );
  }
}
