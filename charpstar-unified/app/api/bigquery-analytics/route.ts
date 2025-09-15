import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";
import { queries } from "@/utils/BigQuery/clientQueries";
import { getEventsBetween } from "@/utils/BigQuery/utils";
import type { BigQueryResponse, ProductMetrics } from "@/utils/BigQuery/types";

// GET handler for monthly AR/3D click analytics
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectid");
    const datasetId = searchParams.get("analytics_profile_id");
    const startTableName = searchParams.get("startDate");
    const endTableName = searchParams.get("endDate");

    if (!projectId || !datasetId || !startTableName || !endTableName) {
      return NextResponse.json(
        { error: "Missing required query parameters" },
        { status: 400 }
      );
    }

    // Select the BigQuery query for this dataset
    const query = queries[datasetId as keyof typeof queries](
      getEventsBetween({ startTableName, endTableName })
    );

    if (!query) {
      return NextResponse.json(
        { error: `Query not found for datasetId: ${datasetId}` },
        { status: 400 }
      );
    }

    // Run BigQuery
    const options = {
      query: query,
      projectId,
    };

    const [job] = await bigquery.createQueryJob(options);
    const [response] = await job.getQueryResults();

    // Filter for only product data_type and transform to match ProductMetrics format
    const productData = (response as BigQueryResponse[])
      .filter((item) => item.data_type === "product")
      .map((item) => {
        try {
          const metrics = JSON.parse(item.metrics);
          const arClicks = parseInt(metrics.AR_Button_Clicks || "0");
          const _3dClicks = parseInt(metrics._3D_Button_Clicks || "0");
          return {
            product_name: item.metric_name,
            ar_sessions: arClicks,
            _3d_sessions: _3dClicks,
            total_button_clicks: arClicks + _3dClicks,
            total_purchases: parseInt(metrics.total_purchases || "0"),
            total_views: parseInt(metrics.total_views || "0"),
            purchases_with_service: parseInt(
              metrics.purchases_with_service || "0"
            ),
            product_conv_rate: parseFloat(metrics.product_conv_rate || "0"),
            default_conv_rate: parseFloat(metrics.default_conv_rate || "0"),
            avg_session_duration_seconds: parseFloat(
              metrics.avg_session_duration_seconds || "0"
            ),
            avg_combined_session_duration: parseFloat(
              metrics.avg_combined_session_duration || "0"
            ),
          } as ProductMetrics;
        } catch (error) {
          console.error("Error parsing metrics for item:", item, error);
          return null;
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return NextResponse.json(productData);
  } catch (error) {
    console.error("BigQuery API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics data" },
      { status: 500 }
    );
  }
}

// POST handler (optional, but for parity with your example)
export async function POST(request: Request) {
  try {
    const { projectId, datasetId, startTableName, endTableName } =
      await request.json();

    // Select the BigQuery query for this dataset
    const query = queries[datasetId as keyof typeof queries](
      getEventsBetween({ startTableName, endTableName })
    );

    if (!query) {
      return NextResponse.json(
        { error: `Query not found for datasetId: ${datasetId}` },
        { status: 400 }
      );
    }

    const options = {
      query: query,
      projectId,
    };

    const [job] = await bigquery.createQueryJob(options);
    const [response] = await job.getQueryResults();

    return NextResponse.json(response as BigQueryResponse[]);
  } catch (error) {
    console.error("BigQuery API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics data" },
      { status: 500 }
    );
  }
}
