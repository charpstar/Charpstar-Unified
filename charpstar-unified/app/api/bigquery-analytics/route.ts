import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";
import { queries } from "@/utils/BigQuery/clientQueries";
import { getEventsBetween } from "@/utils/BigQuery/utils";
import type { BigQueryResponse } from "@/utils/BigQuery/types";

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

    // Filter for only product data_type if needed
    const productData = (response as BigQueryResponse[]).filter(
      (item) => item.data_type === "product"
    );

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
