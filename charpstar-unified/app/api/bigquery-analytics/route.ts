import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { BigQuery } from "@google-cloud/bigquery";
import path from "path";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// Path to your service account key (DO NOT commit this file)
const keyPath = path.join(
  process.cwd(),
  "fast-lattice-421210-e8ac9db9a38e.json"
);

const bigquery = new BigQuery({
  keyFilename: keyPath,
  projectId: process.env.GCP_PROJECT_ID,
});

export async function GET(req: NextRequest) {
  try {
    // 1. Check GCP configuration
    if (!process.env.GCP_PROJECT_ID) {
      return NextResponse.json(
        { error: "GCP Project ID not configured" },
        { status: 500 }
      );
    }

    // 2. Get Supabase client and check authentication
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // 3. Get user's analytics profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("analytics_profile_id")
      .eq("user_id", session.user.id)
      .single();

    if (profileError || !profile?.analytics_profile_id) {
      return NextResponse.json(
        {
          error: "Analytics profile not configured",
          details:
            "Please contact your administrator to set up your analytics profile.",
        },
        { status: 403 }
      );
    }

    // 4. Get analytics profile details
    const { data: analytics, error: analyticsError } = await supabase
      .from("analytics_profiles")
      .select("projectid, datasetid")
      .eq("id", profile.analytics_profile_id)
      .single();

    if (analyticsError || !analytics) {
      return NextResponse.json(
        { error: "Analytics profile not found" },
        { status: 404 }
      );
    }

    // 5. Get query parameters
    const { searchParams } = new URL(req.url);
    const months = parseInt(searchParams.get("months") || "12");

    if (isNaN(months) || months < 1 || months > 12) {
      return NextResponse.json(
        { error: "Invalid months parameter. Must be between 1 and 12." },
        { status: 400 }
      );
    }

    // 6. Build and execute query
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

    const [rows] = await bigquery.query(query);

    // 7. Return the data
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

    // Handle specific error types
    if (error.message?.includes("Permission denied")) {
      return NextResponse.json(
        {
          error: "BigQuery authentication failed",
          details: "Please check your service account configuration.",
        },
        { status: 403 }
      );
    }

    if (error.message?.includes("Not found")) {
      return NextResponse.json(
        {
          error: "BigQuery resource not found",
          details: "The requested analytics data could not be found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to fetch analytics data",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
