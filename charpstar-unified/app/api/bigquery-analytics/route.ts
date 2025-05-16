import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { BigQuery } from "@google-cloud/bigquery";
import path from "path";
import { AuthOptions, getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";

// Path to your service account key (DO NOT commit this file)
const keyPath = path.join(
  process.cwd(),
  "fast-lattice-421210-e8ac9db9a38e.json"
);

const bigquery = new BigQuery({
  keyFilename: keyPath,
  projectId: process.env.GCP_PROJECT_ID,
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(req: NextRequest) {
  try {
    if (!process.env.GCP_PROJECT_ID) {
      return NextResponse.json(
        { error: "GCP Project ID not configured" },
        { status: 500 }
      );
    }

    // 1. Get user from session
    const session = await getServerSession(authOptions as AuthOptions);
    const userEmail = session?.user?.email;
    if (!userEmail) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // 2. Get user id
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("email", userEmail)
      .single();
    if (userError || !user?.id) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 3. Get analytics_profile_id for this user
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("analytics_profile_id")
      .eq("user_id", user.id)
      .single();
    if (profileError || !profile?.analytics_profile_id) {
      return NextResponse.json(
        { error: "No analytics profile assigned" },
        { status: 403 }
      );
    }

    // 4. Get analytics profile details
    const { data: analytic, error: analyticError } = await supabase
      .from("analytics_profiles")
      .select("projectid, datasetid, tablename")
      .eq("id", profile.analytics_profile_id)
      .single();
    if (analyticError || !analytic) {
      return NextResponse.json(
        { error: "Analytics profile not found" },
        { status: 404 }
      );
    }

    // 5. Use these values in your BigQuery query
    const { projectid, datasetid, tablename } = analytic;
    const tableRef = `\`${projectid}.${datasetid}.${tablename}\``;

    // Check for meta query param
    const { searchParams } = new URL(req.url);
    const meta = searchParams.get("meta");
    const startDate = searchParams.get("startDate"); // format: YYYYMMDD
    const endDate = searchParams.get("endDate"); // format: YYYYMMDD

    // If meta=1, return min/max available _TABLE_SUFFIX
    if (meta === "1" && tablename.endsWith("*")) {
      const tableSuffixQuery = `
        SELECT
          MIN(_TABLE_SUFFIX) as minDate,
          MAX(_TABLE_SUFFIX) as maxDate
        FROM ${tableRef}
      `;
      const [metaRows] = await bigquery.query(tableSuffixQuery);
      return NextResponse.json({ meta: metaRows[0] });
    }

    // If using wildcard table, add _TABLE_SUFFIX filter if dates provided
    let whereClause = "";
    if (tablename.endsWith("*")) {
      if (startDate && endDate) {
        whereClause = `WHERE _TABLE_SUFFIX BETWEEN '${startDate}' AND '${endDate}'`;
      } else if (startDate) {
        whereClause = `WHERE _TABLE_SUFFIX >= '${startDate}'`;
      } else if (endDate) {
        whereClause = `WHERE _TABLE_SUFFIX <= '${endDate}'`;
      }
    }

    // Enhanced analytics: summarize each event, avoid correlated subqueries
    const query = `
      WITH event_rows AS (
        SELECT
          event_name,
          event_date,
          user_id,
          user_pseudo_id,
          MAX(IF(param.key = 'campaign', param.value.string_value, NULL)) AS campaign,
          MAX(IF(param.key = 'term', param.value.string_value, NULL)) AS term,
          MAX(IF(param.key = 'batch_page_id', param.value.string_value, NULL)) AS batch_page_id,
          MAX(IF(param.key = 'ga_session_number', param.value.string_value, NULL)) AS ga_session_number,
          MAX(IF(param.key = 'engaged_session_event', param.value.string_value, NULL)) AS engaged_session_event
        FROM ${tableRef},
        UNNEST(event_params) AS param
        ${whereClause}
        GROUP BY event_name, event_date, user_id, user_pseudo_id
      ),
      top_campaigns AS (
        SELECT
          event_name,
          campaign,
          COUNT(*) as cnt,
          ROW_NUMBER() OVER (PARTITION BY event_name ORDER BY COUNT(*) DESC) as rn
        FROM event_rows
        WHERE campaign IS NOT NULL
        GROUP BY event_name, campaign
      ),
      top_terms AS (
        SELECT
          event_name,
          term,
          COUNT(*) as cnt,
          ROW_NUMBER() OVER (PARTITION BY event_name ORDER BY COUNT(*) DESC) as rn
        FROM event_rows
        WHERE term IS NOT NULL
        GROUP BY event_name, term
      )
      SELECT
        er.event_name,
        COUNT(*) as event_count,
        COUNT(DISTINCT er.user_pseudo_id) as unique_users,
        MIN(er.event_date) as first_seen,
        MAX(er.event_date) as last_seen,
        ARRAY_AGG(STRUCT(
          er.event_date,
          er.user_id,
          er.user_pseudo_id,
          er.campaign,
          er.term,
          er.batch_page_id,
          er.ga_session_number,
          er.engaged_session_event
        ) ORDER BY er.event_date DESC LIMIT 5) as sample_events,
        tc.campaign as top_campaign,
        tc.cnt as top_campaign_count,
        tt.term as top_term,
        tt.cnt as top_term_count
      FROM event_rows er
      LEFT JOIN top_campaigns tc
        ON er.event_name = tc.event_name AND tc.rn = 1
      LEFT JOIN top_terms tt
        ON er.event_name = tt.event_name AND tt.rn = 1
      GROUP BY er.event_name, tc.campaign, tc.cnt, tt.term, tt.cnt
      ORDER BY event_count DESC
      LIMIT 20
    `;

    const [rows] = await bigquery.query(query);
    return NextResponse.json({ data: rows });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message,
        help: "Ensure your GCP credentials and permissions are properly configured",
      },
      { status: 500 }
    );
  }
}
