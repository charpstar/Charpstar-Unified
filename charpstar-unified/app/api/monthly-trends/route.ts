import { NextResponse } from "next/server";
import { BigQuery } from "@google-cloud/bigquery";
import path from "path";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

const bigquery = new BigQuery({
  keyFilename: path.join(
    process.cwd(),
    "fast-lattice-421210-e8ac9db9a38e.json"
  ),
});

export async function GET(request: Request) {
  try {
    // Get Supabase client and check authentication
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get user's analytics profile
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

    // Get analytics profile details
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const months = parseInt(searchParams.get("months") || "6");

    if (isNaN(months) || months < 1 || months > 12) {
      return NextResponse.json(
        { error: "Invalid months parameter. Must be between 1 and 12." },
        { status: 400 }
      );
    }

    const query = `
      WITH monthly_data AS (
        SELECT
          FORMAT_TIMESTAMP('%Y-%m', TIMESTAMP_MICROS(event_timestamp)) as month,
          COUNT(CASE WHEN event_name = 'charpstAR_AR_Button_Click' THEN 1 END) as ar_clicks,
          COUNT(CASE WHEN event_name = 'charpstAR_3D_Button_Click' THEN 1 END) as threed_clicks,
          COUNT(CASE WHEN event_name = 'page_view' THEN 1 END) as page_views,
          COUNT(DISTINCT user_pseudo_id) as unique_users
        FROM \`${analytics.projectid}.${analytics.datasetid}.events_*\`
        WHERE
          _TABLE_SUFFIX >= FORMAT_DATE(
            '%Y%m%d',
            DATE_SUB(CURRENT_DATE(), INTERVAL ${months} MONTH)
          )
        GROUP BY month
        ORDER BY month DESC
        LIMIT ${months}
      )
      SELECT * FROM monthly_data
      ORDER BY month ASC
    `;

    const [rows] = await bigquery.query({
      query,
      jobTimeoutMs: 60000,
      maximumBytesBilled: "1000000000",
    } as any);

    return NextResponse.json({
      data: rows,
      meta: {
        months,
      },
    });
  } catch (error: any) {
    console.error("Monthly Trends API Error:", error);

    if (error.message?.includes("Permission denied")) {
      return NextResponse.json(
        {
          error: "BigQuery authentication failed",
          details: "Please check your service account configuration.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to fetch monthly trends",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
