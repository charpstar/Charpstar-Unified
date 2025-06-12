import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET() {
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
    console.log("Using analytics profile:", analytics);

    // Always use 6 months
    const months = 6;

    // Build and execute query
    const query = `
    WITH monthly_data AS (
      SELECT
        FORMAT_TIMESTAMP('%Y-%m', TIMESTAMP_MICROS(event_timestamp)) as month,
        COUNT(CASE WHEN event_name = 'charpstAR_AR_Button_Click' THEN 1 END) as ar_clicks,
        COUNT(CASE WHEN event_name = 'charpstAR_3D_Button_Click' THEN 1 END) as threed_clicks
      FROM \`${analytics.projectid}.${analytics.datasetid}.events_*\`
      WHERE
        _TABLE_SUFFIX >= FORMAT_DATE(
          '%Y%m%d',
          DATE_SUB(CURRENT_DATE(), INTERVAL ${months} MONTH)
        )
        AND event_name IN ('charpstAR_AR_Button_Click', 'charpstAR_3D_Button_Click')
      GROUP BY month
      ORDER BY month DESC
      LIMIT ${months}
    )
    SELECT * FROM monthly_data
    ORDER BY month ASC
    `;

    console.log("Executing BigQuery with project:", analytics.projectid);
    const [rows] = await bigquery.query({ query });
    console.log("Query executed successfully, rows:", rows.length);

    // Return the data
    return NextResponse.json({
      data: {
        monthly_data: rows,
        total_ar_clicks: rows.reduce(
          (sum: number, row: any) => sum + row.ar_clicks,
          0
        ),
        total_3d_clicks: rows.reduce(
          (sum: number, row: any) => sum + row.threed_clicks,
          0
        ),
        total_page_views: 0, // These will be added when we extend the query
        total_unique_users: 0,
      },
    });
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
