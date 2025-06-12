import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectid");
    const datasetId = searchParams.get("analytics_profile_id");
    const months = searchParams.get("months") || "6";

    if (!projectId || !datasetId) {
      return NextResponse.json(
        { error: "Missing required query parameters" },
        { status: 400 }
      );
    }

    const query = `
    WITH monthly_data AS (
      SELECT
        FORMAT_TIMESTAMP('%Y-%m', TIMESTAMP_MICROS(event_timestamp)) as month,
        COUNT(CASE WHEN event_name = 'charpstAR_AR_Button_Click' THEN 1 END) as ar_clicks,
        COUNT(CASE WHEN event_name = 'charpstAR_3D_Button_Click' THEN 1 END) as threed_clicks
      FROM \`${projectId}.${datasetId}.events_*\`
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

    console.log("Executing BigQuery with project:", projectId);
    const [rows] = await bigquery.query({ query });
    console.log("Query executed successfully, rows:", rows.length);

    return NextResponse.json(rows);
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
