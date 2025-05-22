"use server";

import { getBigQueryClient } from "./Client";

export async function getMonthlyTrends({
  projectId,
  datasetId,
  months = 6,
}: {
  projectId: string;
  datasetId: string;
  months?: number;
}) {
  const bigqueryClient = getBigQueryClient({ projectId });

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

  const options = {
    query: query,
    projectId,
  };

  const [job] = await bigqueryClient.createQueryJob(options);
  const [rows] = await job.getQueryResults();

  return rows as {
    month: string;
    ar_clicks: number;
    threed_clicks: number;
  }[];
}
