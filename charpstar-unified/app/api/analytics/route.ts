import { NextResponse } from "next/server";
import { BigQuery } from "@google-cloud/bigquery";
import path from "path";

const bigquery = new BigQuery({
  keyFilename: path.join(
    process.cwd(),
    "fast-lattice-421210-e8ac9db9a38e.json"
  ),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const analyticsProfileId = searchParams.get("analytics_profile_id");
    const projectId = searchParams.get("projectid");

    // Validate date parameters
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Missing required date parameters" },
        { status: 400 }
      );
    }

    // Validate date format (expecting YYYYMMDD)
    const dateRegex = /^\d{8}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return NextResponse.json(
        { error: "Invalid date format. Expected YYYYMMDD" },
        { status: 400 }
      );
    }

    // Validate date range (prevent querying too much data)
    const startNum = parseInt(startDate);
    const endNum = parseInt(endDate);
    if (startNum > endNum) {
      return NextResponse.json(
        { error: "Start date must be before end date" },
        { status: 400 }
      );
    }

    // Prevent querying more than 90 days of data
    const daysDiff = Math.floor((endNum - startNum) / 100); // Rough approximation
    if (daysDiff > 90) {
      return NextResponse.json(
        { error: "Date range cannot exceed 90 days" },
        { status: 400 }
      );
    }

    const eventsBetween = `_TABLE_SUFFIX BETWEEN '${startDate}' AND '${endDate}'`;

    try {
      const [rows] = await bigquery.query({
        query: `
        WITH
          base_events AS (
            SELECT
              user_pseudo_id,
              event_timestamp,
              event_name,
              event_params,
              items
            FROM \`${projectId}.${analyticsProfileId}.events_*\`
            WHERE ${eventsBetween}
              AND user_pseudo_id IS NOT NULL
          ),

          -- Basic user counts and events
          ar_load_user_count AS (
            SELECT COUNT(DISTINCT user_pseudo_id) AS total_ar_load_users
            FROM base_events
            WHERE event_name = 'charpstAR_Load'
          ),

          ar_user_count AS (
            SELECT COUNT(DISTINCT user_pseudo_id) AS total_ar_users
            FROM base_events
            WHERE event_name IN ('charpstAR_AR_Button_Click', 'charpstAR_3D_Button_Click')
          ),

          event_counts AS (
            SELECT event_name, COUNT(*) AS total_events
            FROM base_events
            WHERE event_name IN ('charpstAR_Load', 'charpstAR_AR_Button_Click', 'charpstAR_3D_Button_Click')
            GROUP BY event_name
          ),

          total_views_overall AS (
            SELECT COUNT(DISTINCT e.user_pseudo_id) AS total_views
            FROM base_events e,
            UNNEST(e.event_params) AS ep
            WHERE e.event_name = 'page_view'
              AND ep.key = 'page_title'
          ),

          total_views_with_ar AS (
            SELECT COUNT(DISTINCT user_pseudo_id) AS total_views_with_ar
            FROM base_events
            WHERE event_name IN ('charpstAR_AR_Button_Click', 'charpstAR_3D_Button_Click')
          ),

          total_purchases_overall AS (
            SELECT COUNT(DISTINCT (
              SELECT value.string_value 
              FROM UNNEST(event_params) 
              WHERE key = 'transaction_id'
            )) AS total_purchases
            FROM base_events
            WHERE event_name = 'purchase'
          ),

          total_purchases_with_ar AS (
            SELECT COUNT(DISTINCT (
              SELECT value.string_value 
              FROM UNNEST(event_params) 
              WHERE key = 'transaction_id'
            )) AS total_purchases_with_ar
            FROM base_events
            WHERE event_name = 'purchase'
            AND user_pseudo_id IN (
              SELECT DISTINCT user_pseudo_id
              FROM base_events
              WHERE event_name IN ('charpstAR_AR_Button_Click', 'charpstAR_3D_Button_Click')
            )
          ),

          ar_percentage AS (
            SELECT ROUND(
              SAFE_DIVIDE(
                (SELECT total_ar_users FROM ar_user_count),
                (SELECT total_ar_load_users FROM ar_load_user_count)
              ) * 100,
              2
            ) AS percentage_ar_users
          ),

          conversion_rates AS (
            WITH total_users AS (
              SELECT COUNT(DISTINCT user_pseudo_id) as count
              FROM base_events
            ),
            ar_users AS (
              SELECT COUNT(DISTINCT user_pseudo_id) as count
              FROM base_events 
              WHERE event_name IN ('charpstAR_AR_Button_Click', 'charpstAR_3D_Button_Click')
            )
            SELECT
              ROUND(SAFE_DIVIDE(
                CAST((SELECT total_purchases.total_purchases FROM total_purchases_overall total_purchases) AS FLOAT64),
                CAST((SELECT count FROM total_users) AS FLOAT64)
              ) * 100, 2) AS overall_avg_conversion_rate,
              
              ROUND(SAFE_DIVIDE(
                CAST((SELECT total_purchases.total_purchases_with_ar FROM total_purchases_with_ar total_purchases) AS FLOAT64),
                CAST((SELECT count FROM ar_users) AS FLOAT64)
              ) * 100, 2) AS overall_avg_conversion_rate_with_ar
          ),

          cart_metrics AS (
            SELECT
              ROUND(
                SAFE_DIVIDE(
                  COUNT(DISTINCT CASE WHEN event_name = 'add_to_cart' AND user_pseudo_id NOT IN (
                    SELECT DISTINCT user_pseudo_id
                    FROM base_events
                    WHERE event_name IN ('charpstAR_AR_Button_Click', 'charpstAR_3D_Button_Click')
                  ) THEN user_pseudo_id END),
                  COUNT(DISTINCT CASE WHEN user_pseudo_id NOT IN (
                    SELECT DISTINCT user_pseudo_id
                    FROM base_events
                    WHERE event_name IN ('charpstAR_AR_Button_Click', 'charpstAR_3D_Button_Click')
                  ) THEN user_pseudo_id END)
                ) * 100,
                2
              ) AS cart_percentage_default,
              
              ROUND(
                SAFE_DIVIDE(
                  COUNT(DISTINCT CASE WHEN event_name = 'add_to_cart' AND user_pseudo_id IN (
                    SELECT DISTINCT user_pseudo_id
                    FROM base_events
                    WHERE event_name IN ('charpstAR_AR_Button_Click', 'charpstAR_3D_Button_Click')
                  ) THEN user_pseudo_id END),
                  COUNT(DISTINCT CASE WHEN user_pseudo_id IN (
                    SELECT DISTINCT user_pseudo_id
                    FROM base_events
                    WHERE event_name IN ('charpstAR_AR_Button_Click', 'charpstAR_3D_Button_Click')
                  ) THEN user_pseudo_id END)
                ) * 100,
                2
              ) AS cart_percentage_ar
            FROM base_events
          ),

          order_values AS (
            SELECT
              ROUND(AVG(CASE 
                WHEN user_pseudo_id NOT IN (
                  SELECT DISTINCT user_pseudo_id
                  FROM base_events
                  WHERE event_name IN ('charpstAR_AR_Button_Click', 'charpstAR_3D_Button_Click')
                )
                THEN (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'value')
              END), 2) AS avg_order_value_default,
              
              ROUND(AVG(CASE 
                WHEN user_pseudo_id IN (
                  SELECT DISTINCT user_pseudo_id
                  FROM base_events
                  WHERE event_name IN ('charpstAR_AR_Button_Click', 'charpstAR_3D_Button_Click')
                )
                THEN (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'value')
              END), 2) AS avg_order_value_ar
            FROM base_events
            WHERE event_name = 'purchase'
          ),

          session_durations AS (
            SELECT
              ROUND(AVG(CASE 
                WHEN user_pseudo_id NOT IN (
                  SELECT DISTINCT user_pseudo_id
                  FROM base_events
                  WHERE event_name IN ('charpstAR_AR_Button_Click', 'charpstAR_3D_Button_Click')
                )
                THEN (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'engagement_time_msec') / 1000.0
              END), 2) AS avg_session_duration_default,
              
              ROUND(AVG(CASE 
                WHEN user_pseudo_id IN (
                  SELECT DISTINCT user_pseudo_id
                  FROM base_events
                  WHERE event_name IN ('charpstAR_AR_Button_Click', 'charpstAR_3D_Button_Click')
                )
                THEN (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'engagement_time_msec') / 1000.0
              END), 2) AS avg_session_duration_ar
            FROM base_events
            WHERE event_name = 'user_engagement'
          ),

          ar_3d_clicks AS (
            SELECT
              COUNT(DISTINCT CASE WHEN event_name = 'charpstAR_AR_Button_Click' THEN event_timestamp END) AS total_ar_clicks,
              COUNT(DISTINCT CASE WHEN event_name = 'charpstAR_3D_Button_Click' THEN event_timestamp END) AS total_3d_clicks
            FROM base_events
            WHERE event_name IN ('charpstAR_AR_Button_Click', 'charpstAR_3D_Button_Click')
          )

          SELECT
            (SELECT total_views FROM total_views_overall) AS total_page_views,
            (SELECT total_ar_load_users FROM ar_load_user_count) AS total_unique_users,
            (SELECT total_ar_users FROM ar_user_count) AS total_users_with_service,
            (SELECT percentage_ar_users FROM ar_percentage) AS percentage_users_with_service,
            (SELECT overall_avg_conversion_rate FROM conversion_rates) AS conversion_rate_without_ar,
            (SELECT overall_avg_conversion_rate_with_ar FROM conversion_rates) AS conversion_rate_with_ar,
            (SELECT total_purchases_with_ar FROM total_purchases_with_ar) AS total_purchases_with_ar,
            (SELECT cart_percentage_default FROM cart_metrics) AS add_to_cart_default,
            (SELECT cart_percentage_ar FROM cart_metrics) AS add_to_cart_with_ar,
            (SELECT avg_order_value_default FROM order_values) AS avg_order_value_without_ar,
            (SELECT avg_order_value_ar FROM order_values) AS avg_order_value_with_ar,
            (SELECT total_ar_clicks FROM ar_3d_clicks) AS total_ar_clicks,
            (SELECT total_3d_clicks FROM ar_3d_clicks) AS total_3d_clicks,
            (SELECT avg_session_duration_default FROM session_durations) AS session_duration_without_ar,
            (SELECT avg_session_duration_ar FROM session_durations) AS session_duration_with_ar
        `,
        jobTimeoutMs: 60000,
        maximumBytesBilled: "10000000000",
      } as any);

      if (!rows?.[0]) {
        return NextResponse.json(
          { error: "No data found for the specified date range" },
          { status: 404 }
        );
      }

      // Validate and sanitize the response data
      const data = rows[0];
      const sanitizedData = {
        total_page_views: Number(data.total_page_views) || 0,
        total_unique_users: Number(data.total_unique_users) || 0,
        total_users_with_service: Number(data.total_users_with_service) || 0,
        percentage_users_with_service:
          Number(data.percentage_users_with_service) || 0,
        conversion_rate_without_ar:
          Number(data.conversion_rate_without_ar) || 0,
        conversion_rate_with_ar: Number(data.conversion_rate_with_ar) || 0,
        total_purchases_with_ar: Number(data.total_purchases_with_ar) || 0,
        add_to_cart_default: Number(data.add_to_cart_default) || 0,
        add_to_cart_with_ar: Number(data.add_to_cart_with_ar) || 0,
        avg_order_value_without_ar:
          Number(data.avg_order_value_without_ar) || 0,
        avg_order_value_with_ar: Number(data.avg_order_value_with_ar) || 0,
        total_ar_clicks: Number(data.total_ar_clicks) || 0,
        total_3d_clicks: Number(data.total_3d_clicks) || 0,
        session_duration_without_ar:
          Number(data.session_duration_without_ar) || 0,
        session_duration_with_ar: Number(data.session_duration_with_ar) || 0,
      };

      return NextResponse.json({
        data: sanitizedData,
        meta: {
          dateRange: {
            start: startDate,
            end: endDate,
          },
        },
      });
    } catch (queryError: any) {
      console.error("BigQuery Error:", queryError);

      // Handle specific BigQuery errors
      if (queryError.message?.includes("Permission denied")) {
        return NextResponse.json(
          {
            error:
              "Authentication failed. Please check service account permissions.",
          },
          { status: 403 }
        );
      }
      if (queryError.message?.includes("exceeded limit")) {
        return NextResponse.json(
          { error: "Query limit exceeded. Please try a smaller date range." },
          { status: 429 }
        );
      }

      throw queryError; // Re-throw for general error handling
    }
  } catch (error: any) {
    console.error("Analytics API Error:", error);

    // Determine if it's a known error type
    const status = error.status || 500;
    const message = error.message || "An unexpected error occurred";

    return NextResponse.json(
      {
        error: message,
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
      },
      { status }
    );
  }
}
