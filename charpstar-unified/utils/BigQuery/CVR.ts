"use server";

import { getBigQueryClient } from "./Client";
import { queries, type TDatasets } from "./clientQueries";
import { getEventsBetween, getEventsTableName } from "@/utils/BigQuery/utils";

// Default CVR = (Total amount of people who have purchased the product / page_view event count) * 100
// ga_session_id can be used to identity users.
// Conversion Rate with CharpstAR clicks = (Total Purchases of the "Trip" Product after the user has clicked the AR/3D Button / Total times any of the two buttons were clicked) * 100
// Total times any of the two buttons were clicked - This we already have ready
// Total Purchases of the "Trip" Product after the user has clicked the AR/3D Button - This we need to look at the users who have made the purchases and see if they have interacted with either AR or 3D buttons. But I'm not sure if you have the capability of doing that from the BigQuery data

// - Get purchases list.
// - Check if the purchase had an AR button click a week before by the same user id

export async function getPurchasesCount({
  projectId,
  datasetId,

  startTableName,
  endTableName,
}: {
  projectId: string;
  datasetId: string;

  startTableName: string;
  endTableName: string;
}) {
  const bigqueryClient = getBigQueryClient({ projectId });
  const eventsTableName = getEventsTableName({ projectId, datasetId });
  const eventsBetween = getEventsBetween({ startTableName, endTableName });

  const query = `
      WITH data_prep AS (
        SELECT
          (
            SELECT quantity
            FROM UNNEST(items)
          ) AS quantity,
          (
            SELECT value.string_value
            FROM UNNEST(event_params)
            WHERE KEY = 'page_title'
          ) AS page_title,
          FROM ${eventsTableName}
        WHERE
          event_name IN ('in_app_purchase', 'purchase')
          AND ${eventsBetween}
      )
      SELECT
        page_title,
        SUM(quantity) as total_quantity
      FROM data_prep
      GROUP BY 1
      ORDER BY 2 DESC;
  `;

  const options = {
    query: query,
    projectId,
  };

  const [job] = await bigqueryClient.createQueryJob(options);
  const [_response] = await job.getQueryResults();

  const response = _response as {
    count: number;
  }[];

  const { count } = response[0]!;

  return count;
}

export async function getPageViewsCount({
  projectId,
  datasetId,

  startTableName,
  endTableName,
}: {
  projectId: string;
  datasetId: string;

  startTableName: string;
  endTableName: string;
}) {
  const bigqueryClient = getBigQueryClient({ projectId });

  const query = `
    WITH data_prep AS (
      SELECT user_pseudo_id,
        (
          SELECT value.int_value
          FROM UNNEST(event_params)
          WHERE KEY = 'ga_session_id'
        ) AS session_id,
        (
          SELECT value.string_value
          FROM UNNEST(event_params)
          WHERE KEY = 'page_title'
        ) AS page_title,
        FROM \`${projectId}.${datasetId}.events_*\`
      WHERE
        event_name = 'page_view'
        AND _TABLE_SUFFIX BETWEEN '${startTableName}' AND '${endTableName}'
        AND traffic_source.source != "(none)"
    )
    SELECT
      page_title,
      COUNT(*) AS total_pageviews
    FROM data_prep
    GROUP BY 1
    ORDER BY 2 DESC;
  `;

  const options = {
    query: query,
    projectId,
  };

  const [job] = await bigqueryClient.createQueryJob(options);
  const [response] = await job.getQueryResults();

  return response as {
    page_title: string;
    total_pageviews: number;
  }[];
}

export async function executeClientQuery({
  projectId,
  datasetId,
  startTableName,
  endTableName,
}: {
  projectId: string;
  datasetId: TDatasets;
  startTableName: string;
  endTableName: string;
}) {
  // Validate datasetId
  if (!datasetId || !queries[datasetId]) {
    console.error("Invalid datasetId:", datasetId);

    throw new Error(
      `Invalid dataset ID: ${datasetId}. Available datasets: ${Object.keys(queries).join(", ")}`
    );
  }

  const eventsBetween = getEventsBetween({ startTableName, endTableName });
  const query = queries[datasetId](eventsBetween);

  if (!query) {
    throw new Error(`Query not found for datasetId: ${datasetId}`);
  }

  const bigqueryClient = getBigQueryClient({ projectId });

  const options = {
    query: query,
    projectId,
  };

  try {
    const [job] = await bigqueryClient.createQueryJob(options);
    const [_response] = await job.getQueryResults();

    const response = _response as {
      product_name: string;
      _3D_Button_Clicks: number;
      AR_Button_Clicks: number;
      total_button_clicks: number;
      total_purchases: number;
      total_views: number;
      purchases_with_service: number;
      product_conv_rate: number;
      default_conv_rate: number;
      avg_session_duration_seconds: number;
      avg_combined_session_duration: number;
    }[];

    return response;
  } catch (error) {
    console.error("BigQuery execution error:", error);
    throw error;
  }
}
