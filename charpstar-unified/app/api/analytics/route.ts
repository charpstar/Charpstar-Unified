import { NextResponse } from "next/server";
import { queries } from "@/utils/BigQuery/clientQueries";
import { getEventsBetween } from "@/utils/BigQuery/utils";
import type { BigQueryResponse } from "@/utils/BigQuery/types";
import { bigquery } from "@/lib/bigquery";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  console.log("COOKIES RECEIVED:", (await cookies()).getAll());
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

    const bigqueryClient = bigquery;
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

    const [job] = await bigqueryClient.createQueryJob(options);
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

export async function POST(request: Request) {
  try {
    const { projectId, datasetId, startTableName, endTableName } =
      await request.json();

    const bigqueryClient = bigquery;
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

    const [job] = await bigqueryClient.createQueryJob(options);
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
