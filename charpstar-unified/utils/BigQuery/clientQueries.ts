export type TDatasets = keyof typeof queries;

export const queries = {
  analytics_311675532: (eventsBetween: string) => `WITH
  -- This CTE Grabs all the product names from the items array
  all_products AS (
    SELECT DISTINCT
      CASE
        WHEN TRIM(i.item_name) = 'Modern sort spot  til loftudtag/lampeudtag' THEN CONCAT('Modern sort spot til loftudtag/lampeudtag',' - ',i.item_category)
        ELSE TRIM(CONCAT(i.item_name,' - ',i.item_category))
      END AS product_name
    FROM
      \`fast-lattice-421210.analytics_311675532.events_*\`, UNNEST(items) AS i
    WHERE ${eventsBetween}
  ),
  -- This CTE Grabs all the two click events and their timestamp along with their session id for every user this will help identifying the purchases that take place after one of these events were triggered in that session
  click_events AS (
    SELECT DISTINCT
      user_pseudo_id,
      event_name,
      event_timestamp AS click_timestamp,
      (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS ga_session_id
    FROM
      \`fast-lattice-421210.analytics_311675532.events_*\`
    WHERE
      event_name IN ('charpstAR_AR_Button_Click', 'charpstAR_3D_Button_Click')
      AND ${eventsBetween}
  ),
  -- This CTE extracts the product name from the event parameter 'page_title' because there is not any parameter except this which provides us the product name.
  click_events_with_products AS (
    SELECT DISTINCT
      event_timestamp AS click_timestamp,
      user_pseudo_id,
      event_name,
      REGEXP_REPLACE(
        (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_title'),
        r' - Dyberg Larsen$', ''
      ) AS page_title_product_name
    FROM
      \`fast-lattice-421210.analytics_311675532.events_*\`
    WHERE
      event_name IN ('charpstAR_AR_Button_Click', 'charpstAR_3D_Button_Click')
      AND ${eventsBetween}
  ),
  -- This CTE counts the number of times the 'charpstAR_AR_Button_Click' event was triggered
  ar_clicks AS (
    SELECT
      TRIM(page_title_product_name) AS page_title_product_name,
      COUNT(DISTINCT click_timestamp) AS AR_Button_Clicks
    FROM
      click_events_with_products
    WHERE
      event_name = 'charpstAR_AR_Button_Click'
    GROUP BY TRIM(page_title_product_name)
  ),
  -- This CTE counts the number of times the 'charpstAR_3D_Button_Click' event was triggered
  _3d_clicks AS (
    SELECT
      TRIM(page_title_product_name) AS page_title_product_name,
      COUNT(DISTINCT click_timestamp) AS _3D_Button_Clicks
    FROM
      click_events_with_products
    WHERE
      event_name = 'charpstAR_3D_Button_Click'
    GROUP BY TRIM(page_title_product_name)
  ),
  -- This CTE gets the transaction id once a purchase event happens for a user
  purchase AS (
    SELECT DISTINCT
      user_pseudo_id,
      event_timestamp,
      (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS ga_session_id,
      (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'transaction_id') AS transaction_id
    FROM
      \`fast-lattice-421210.analytics_311675532.events_*\`
    WHERE
      event_name = 'purchase'
      AND ${eventsBetween}
  ),
  -- This CTE accounts only those transaction id that are required i.e that happened after those click events in that session.
  tran_ids_required AS (
    SELECT DISTINCT purchase.transaction_id
    FROM click_events AS click
    INNER JOIN purchase AS purchase
      ON click.ga_session_id = purchase.ga_session_id
      AND click.user_pseudo_id = purchase.user_pseudo_id
      AND purchase.event_timestamp > click.click_timestamp
  ),
  -- This CTE grabs the product name with their transaction ids so that we know what was the name of the product that was purchased.
  products_purchased_cte AS (
    SELECT DISTINCT
      CASE
        WHEN TRIM(i.item_name) = 'Modern sort spot  til loftudtag/lampeudtag' THEN CONCAT('Modern sort spot til loftudtag/lampeudtag',' - ',i.item_category)
        ELSE TRIM(CONCAT(i.item_name,' - ',i.item_category))
      END AS product_name,
      (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'transaction_id') AS transaction_id
    FROM
      \`fast-lattice-421210.analytics_311675532.events_*\`, UNNEST(items) AS i
    WHERE
      event_name = 'purchase'
      AND ${eventsBetween}
  ),
  -- In this CTE we have our final products that were being purchased after the click events along with the cleaned product names
  products_purchased_after_click_events AS (
    SELECT
      product_name,
      COUNT(DISTINCT transaction_id) AS purchases_with_service
    FROM
      products_purchased_cte
    WHERE
      transaction_id IN (SELECT DISTINCT transaction_id FROM tran_ids_required)
    GROUP BY product_name
  ),
  -- Total views per product
  total_views AS (
    SELECT
      TRIM(REGEXP_REPLACE(
        ep.value.string_value,
        r' - Dyberg Larsen$', ''
      )) AS product_name,
      COUNT(*) AS total_views
    FROM
      \`fast-lattice-421210.analytics_311675532.events_*\`,
      UNNEST(event_params) AS ep
    WHERE
      event_name = 'page_view'
      AND ep.key = 'page_title'
      AND ${eventsBetween}
    GROUP BY TRIM(REGEXP_REPLACE(
      ep.value.string_value,
      r' - Dyberg Larsen$', ''
    ))
  ),
  -- Total purchases per product
  total_purchases AS (
    SELECT
      TRIM(CONCAT(i.item_name,' - ',i.item_category)) AS product_name,
      COUNT(DISTINCT (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'transaction_id')) AS total_purchases
    FROM
      \`fast-lattice-421210.analytics_311675532.events_*\`, UNNEST(items) AS i
    WHERE
      event_name = 'purchase'
      AND ${eventsBetween}
    GROUP BY TRIM(CONCAT(i.item_name,' - ',i.item_category))
  ),
  -- Default conversion rate calculation
  default_conversion_rate AS (
    SELECT
      v.product_name,
      v.total_views,
      p.total_purchases,
      ROUND(SAFE_DIVIDE(p.total_purchases, v.total_views) * 100, 2) AS default_conv_rate
    FROM total_views AS v
    JOIN total_purchases AS p
      ON LOWER(v.product_name) = LOWER(p.product_name)
  ),
  -- Joining the CTEs to get the final table
  final AS (
    SELECT
      a.product_name,
      COALESCE(c._3D_Button_Clicks, 0) AS _3D_Button_Clicks,
      COALESCE(b.AR_Button_Clicks, 0) AS AR_Button_Clicks,
      COALESCE(d.purchases_with_service, 0) AS purchases_with_service,
      COALESCE(dc.total_purchases, 0) AS total_purchases,
      COALESCE(c._3D_Button_Clicks, 0) + COALESCE(b.AR_Button_Clicks, 0) AS total_button_clicks,
      ROUND(SAFE_DIVIDE(COALESCE(d.purchases_with_service, 0), COALESCE(c._3D_Button_Clicks, 0) + COALESCE(b.AR_Button_Clicks, 0)) * 100, 2) AS product_conv_rate,
      COALESCE(dc.total_views, 0) AS total_views,
      COALESCE(dc.default_conv_rate, 0) AS default_conv_rate
    FROM all_products AS a
    LEFT JOIN ar_clicks AS b ON LOWER(a.product_name) = LOWER(b.page_title_product_name)
    LEFT JOIN _3d_clicks AS c ON LOWER(a.product_name) = LOWER(c.page_title_product_name)
    LEFT JOIN products_purchased_after_click_events AS d ON a.product_name = d.product_name
    LEFT JOIN default_conversion_rate AS dc ON LOWER(a.product_name) = LOWER(dc.product_name)
    WHERE COALESCE(c._3D_Button_Clicks, 0) + COALESCE(b.AR_Button_Clicks, 0) > 0
    ORDER BY d.purchases_with_service DESC
  )

SELECT * FROM final
WHERE total_button_clicks > 0 OR purchases_with_service > 0
`,

  analytics_351120479: (eventsBetween: string) => `WITH
  all_products AS (
    SELECT DISTINCT TRIM(i.item_name) AS product_name
    FROM \`fast-lattice-421210.analytics_351120479.events_*\`, UNNEST(items) AS i
    WHERE ${eventsBetween}
 ),
  click_events AS (
    SELECT DISTINCT
      user_pseudo_id,
      event_name,
      event_timestamp AS click_timestamp,
      (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS ga_session_id
    FROM \`fast-lattice-421210.analytics_351120479.events_*\`
    WHERE event_name IN ('charpstAR_AR_Button_Click', 'charpstAR_3D_Button_Click') AND ${eventsBetween}
  ),
  click_events_with_products AS (
    SELECT DISTINCT
      event_timestamp AS click_timestamp,
      user_pseudo_id,
      event_name,
      REGEXP_REPLACE(
        (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_title'),
        r' (?:- Handla hos|- Shop at).*$',
        ''
      ) AS page_title_product_name
    FROM \`fast-lattice-421210.analytics_351120479.events_*\`
    WHERE event_name IN ('charpstAR_AR_Button_Click', 'charpstAR_3D_Button_Click') AND ${eventsBetween}
  ),
  ar_clicks AS (
    SELECT
      TRIM(page_title_product_name) AS page_title_product_name,
      COUNT(DISTINCT click_timestamp) AS AR_Button_Clicks
    FROM click_events_with_products
    WHERE event_name = 'charpstAR_AR_Button_Click'
    GROUP BY TRIM(page_title_product_name)
  ),
  _3d_clicks AS (
    SELECT
      TRIM(page_title_product_name) AS page_title_product_name,
      COUNT(DISTINCT click_timestamp) AS _3D_Button_Clicks
    FROM click_events_with_products
    WHERE event_name = 'charpstAR_3D_Button_Click'
    GROUP BY TRIM(page_title_product_name)
  ),

  purchases AS (
    SELECT DISTINCT
      user_pseudo_id,
      event_timestamp,
      (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS ga_session_id,
      (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'transaction_id') AS transaction_id,
      (SELECT TRIM(i.item_name) FROM UNNEST(items) AS i LIMIT 1) AS product_name
      FROM \`fast-lattice-421210.analytics_351120479.events_*\`
      WHERE event_name = 'purchase' AND ${eventsBetween}
  ),

  tran_ids_required AS (
    SELECT DISTINCT p.transaction_id
    FROM click_events AS c
    INNER JOIN purchases AS p
      ON c.ga_session_id = p.ga_session_id
      AND c.user_pseudo_id = p.user_pseudo_id
      AND p.event_timestamp > c.click_timestamp
  ),
  purchases_with_ar AS (
    SELECT
      p.user_pseudo_id,
      p.transaction_id,
      p.product_name,
      IF(
        EXISTS (
          SELECT 1
          FROM click_events_with_products AS c
          WHERE c.user_pseudo_id = p.user_pseudo_id
          AND c.click_timestamp < p.event_timestamp
        ),
        'yes',
        'no'
      ) AS purchased_after_ar
    FROM
      purchases AS p
  ),
  products_purchased_after_click_events AS (
    SELECT
      product_name,
      COUNT(DISTINCT transaction_id) AS purchases_with_service
    FROM
      purchases_with_ar
    WHERE
      purchased_after_ar = 'yes'
    GROUP BY
      product_name
  ),
  total_views AS (
    SELECT
      TRIM(REGEXP_REPLACE(
        value.string_value,
        r' (?:- Handla hos|- Shop at).*$',
        ''
      )) AS product_name,
      COUNT(DISTINCT user_pseudo_id) AS total_views
      FROM \`fast-lattice-421210.analytics_351120479.events_*\`,
    UNNEST(event_params) AS ep
    WHERE event_name = 'page_view'
    AND ep.key = 'page_title'
    AND ${eventsBetween}
    GROUP BY TRIM(REGEXP_REPLACE(
      value.string_value,
      r' (?:- Handla hos|- Shop at).*$',
      ''
    ))
  ),
  total_purchases AS (
    SELECT
      TRIM(i.item_name) AS product_name,
      COUNT(DISTINCT (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'transaction_id')) AS total_purchases
      FROM \`fast-lattice-421210.analytics_351120479.events_*\`, UNNEST(items) AS i
    WHERE event_name = 'purchase' AND ${eventsBetween}
    GROUP BY TRIM(i.item_name)
  ),
  default_conversion_rate AS (
    SELECT
      v.product_name,
      v.total_views,
      p.total_purchases,
      ROUND(SAFE_DIVIDE(p.total_purchases, v.total_views) * 100, 2) AS default_conv_rate
    FROM total_views AS v
    JOIN total_purchases AS p
      ON LOWER(v.product_name) = LOWER(p.product_name)
  ),
  avg_session_duration AS (
    SELECT
      TRIM(REGEXP_REPLACE(
        (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_title'),
        r' (?:- Handla hos|- Shop at).*$',
        ''
      )) AS product_name,
      AVG((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'engagement_time_msec')) / 1000 AS avg_session_duration_seconds,
      COUNT(1) AS count_engagement_time
      FROM \`fast-lattice-421210.analytics_351120479.events_*\`
    WHERE event_name IN ('page_view', 'scroll', 'user_engagement')
    GROUP BY product_name
  ),
  ar_events AS (
    SELECT
      user_pseudo_id,
      event_timestamp,
      REGEXP_REPLACE(
        (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_title'),
        r' (?:- Handla hos|- Shop at).*$',
        ''
      ) AS page_title_product_name
      FROM \`fast-lattice-421210.analytics_351120479.events_*\`
    WHERE
      event_name = 'charpstAR_AR_Button_Click'
  ),
  next_events AS (
    SELECT
      ar.user_pseudo_id,
      ar.event_timestamp AS ar_event_timestamp,
      ar.page_title_product_name,
      MIN(e.event_timestamp) / 1000 AS next_event_timestamp
    FROM
      ar_events AS ar
    JOIN
      \`fast-lattice-421210.analytics_351120479.events_*\` AS e
    ON
      ar.user_pseudo_id = e.user_pseudo_id
      AND e.event_timestamp > ar.event_timestamp
    GROUP BY
      ar.user_pseudo_id,
      ar.event_timestamp,
      ar.page_title_product_name
  ),
  ar_durations AS (
    SELECT
      ar.page_title_product_name AS product_name,
      SAFE_DIVIDE(ne.next_event_timestamp - ar.event_timestamp / 1000, 1000) AS interaction_duration_seconds
    FROM
      ar_events AS ar
    LEFT JOIN
      next_events AS ne
    ON
      ar.user_pseudo_id = ne.user_pseudo_id
      AND ar.event_timestamp = ne.ar_event_timestamp
    WHERE
      ne.next_event_timestamp IS NOT NULL
      AND SAFE_DIVIDE(ne.next_event_timestamp - ar.event_timestamp / 1000, 1000) BETWEEN 0 AND 3600
  ),
  avg_ar_duration AS (
    SELECT
      product_name,
      AVG(interaction_duration_seconds) AS avg_ar_duration
    FROM
      ar_durations
    GROUP BY
      product_name
  ),
  _3d_events AS (
    SELECT
      user_pseudo_id,
      event_timestamp,
      REGEXP_REPLACE(
        (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_title'),
        r' (?:- Handla hos|- Shop at).*$',
        ''
      ) AS page_title_product_name
    FROM
      \`fast-lattice-421210.analytics_351120479.events_*\`
    WHERE
      event_name = 'charpstAR_3D_Button_Click'
  ),
  next_3d_events AS (
    SELECT
      ar.user_pseudo_id,
      ar.event_timestamp AS ar_event_timestamp,
      ar.page_title_product_name,
      MIN(e.event_timestamp) / 1000 AS next_event_timestamp
    FROM
      _3d_events AS ar
    JOIN
      \`fast-lattice-421210.analytics_351120479.events_*\` AS e
    ON
      ar.user_pseudo_id = e.user_pseudo_id
         AND e.event_timestamp > ar.event_timestamp
    GROUP BY
      ar.user_pseudo_id,
      ar.event_timestamp,
      ar.page_title_product_name
  ),
  _3d_durations AS (
    SELECT
      ar.page_title_product_name AS product_name,
      SAFE_DIVIDE(ne.next_event_timestamp - ar.event_timestamp / 1000, 1000) AS interaction_duration_seconds
    FROM
      _3d_events AS ar
    LEFT JOIN
      next_3d_events AS ne
    ON
      ar.user_pseudo_id = ne.user_pseudo_id
      AND ar.event_timestamp = ne.ar_event_timestamp
    WHERE
      ne.next_event_timestamp IS NOT NULL
      AND SAFE_DIVIDE(ne.next_event_timestamp - ar.event_timestamp / 1000, 1000) BETWEEN 0 AND 3600
  ),
  avg_3d_duration AS (
    SELECT
      product_name,
      AVG(interaction_duration_seconds) AS avg_3d_duration
    FROM
      _3d_durations
    GROUP BY
      product_name
  ),
  final AS (
    SELECT
      a.product_name,
      COALESCE(c._3D_Button_Clicks, 0) AS _3D_Button_Clicks,
      COALESCE(b.AR_Button_Clicks, 0) AS AR_Button_Clicks,
      COALESCE(d.purchases_with_service, 0) AS purchases_with_service,
      COALESCE(dc.total_purchases, 0) AS total_purchases,
      COALESCE(c._3D_Button_Clicks, 0) + COALESCE(b.AR_Button_Clicks, 0) AS total_button_clicks,
      ROUND(SAFE_DIVIDE(COALESCE(d.purchases_with_service, 0), COALESCE(c._3D_Button_Clicks, 0) + COALESCE(b.AR_Button_Clicks, 0)) * 100, 2) AS product_conv_rate,
      COALESCE(dc.total_views, 0) AS total_views,
      COALESCE(dc.default_conv_rate, 0) AS default_conv_rate,
      ROUND(COALESCE(ad.avg_session_duration_seconds, 0),2) AS avg_session_duration_seconds,
      ROUND(COALESCE(ar.avg_ar_duration, 0),2) AS avg_ar_duration,
      ROUND(COALESCE(td.avg_3d_duration, 0),2) AS avg_3d_duration,
      ROUND(COALESCE(ad.avg_session_duration_seconds, 0) + COALESCE(ar.avg_ar_duration, 0),2) AS avg_ar_session_duration,
      ROUND(COALESCE(ad.avg_session_duration_seconds, 0) + COALESCE(td.avg_3d_duration, 0),2) AS avg_3d_session_duration,
      ROUND((COALESCE(ad.avg_session_duration_seconds, 0) + COALESCE(ar.avg_ar_duration, 0) + COALESCE(ad.avg_session_duration_seconds, 0) + COALESCE(td.avg_3d_duration, 0) / 2),2) AS avg_combined_session_duration
    FROM all_products AS a
    LEFT JOIN ar_clicks AS b ON LOWER(a.product_name) = LOWER(b.page_title_product_name)
    LEFT JOIN _3d_clicks AS c ON LOWER(a.product_name) = LOWER(c.page_title_product_name)
    LEFT JOIN products_purchased_after_click_events AS d ON a.product_name = d.product_name
    LEFT JOIN default_conversion_rate AS dc ON LOWER(a.product_name) = LOWER(dc.product_name)
    LEFT JOIN avg_session_duration AS ad ON LOWER(a.product_name) = LOWER(ad.product_name)
    LEFT JOIN avg_ar_duration AS ar ON LOWER(a.product_name) = LOWER(ar.product_name)
    LEFT JOIN avg_3d_duration AS td ON LOWER(a.product_name) = LOWER(td.product_name)
    WHERE COALESCE(c._3D_Button_Clicks, 0) + COALESCE(b.AR_Button_Clicks, 0) > 0
    ORDER BY d.purchases_with_service DESC
  )

SELECT * FROM final
WHERE total_button_clicks > 0 OR purchases_with_service > 0
`,

  analytics_274422295: (eventsBetween: string) => `WITH
  -- This CTE Grabs all the product names from the items array
  all_products AS (
    SELECT DISTINCT
      TRIM(i.item_name) AS product_name
    FROM
      \`fast-lattice-421210.analytics_274422295.events_*\`, UNNEST(items) AS i
    WHERE ${eventsBetween}
  ),
  -- This CTE Grabs all the two click events and their timestamp along with their session id for every user
  click_events AS (
    SELECT DISTINCT
      user_pseudo_id,
      event_name,
      event_timestamp AS click_timestamp,
      (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS ga_session_id
    FROM
      \`fast-lattice-421210.analytics_274422295.events_*\`
    WHERE
      event_name IN ('charpstAR_AR_Button_Click', 'charpstAR_3D_Button_Click')
      AND ${eventsBetween}
  ),
  -- This CTE extracts the product name from the event parameter 'page_title'
  click_events_with_products AS (
    SELECT DISTINCT
      event_timestamp AS click_timestamp,
      user_pseudo_id,
      event_name,
      SPLIT(REGEXP_REPLACE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_title'), 'â€“', '-'), '-')[SAFE_OFFSET(0)] AS page_title_product_name
    FROM
      \`fast-lattice-421210.analytics_274422295.events_*\`
    WHERE
      event_name IN ('charpstAR_AR_Button_Click', 'charpstAR_3D_Button_Click')
      AND ${eventsBetween}
  ),
  -- This CTE counts the number of times the 'charpstAR_AR_Button_Click' event was triggered
  ar_clicks AS (
    SELECT
      TRIM(page_title_product_name) AS page_title_product_name,
      COUNT(DISTINCT click_timestamp) AS AR_Button_Clicks
    FROM
      click_events_with_products
    WHERE
      event_name = 'charpstAR_AR_Button_Click'
    GROUP BY TRIM(page_title_product_name)
  ),
  -- This CTE counts the number of times the 'charpstAR_3D_Button_Click' event was triggered
  _3d_clicks AS (
    SELECT
      TRIM(page_title_product_name) AS page_title_product_name,
      COUNT(DISTINCT click_timestamp) AS _3D_Button_Clicks
    FROM
      click_events_with_products
    WHERE
      event_name = 'charpstAR_3D_Button_Click'
    GROUP BY TRIM(page_title_product_name)
  ),
  -- This CTE gets the transaction id once a purchase event happens for a user
  purchases AS (
    SELECT DISTINCT
      user_pseudo_id,
      event_timestamp,
      (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS ga_session_id,
      (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'transaction_id') AS transaction_id
    FROM
      \`fast-lattice-421210.analytics_274422295.events_*\`
    WHERE
      event_name = 'purchase'
      AND ${eventsBetween}
  ),
  -- This CTE accounts only those transaction ids that happened after those click events in that session
  tran_ids_required AS (
    SELECT DISTINCT p.transaction_id
    FROM click_events AS c
    INNER JOIN purchases AS p
      ON c.ga_session_id = p.ga_session_id
      AND c.user_pseudo_id = p.user_pseudo_id
      AND p.event_timestamp > c.click_timestamp
  ),
  -- This CTE grabs the product name with their transaction ids to identify purchased products
  products_purchased_cte AS (
    SELECT DISTINCT
      TRIM(i.item_name) AS product_name,
      (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'transaction_id') AS transaction_id
    FROM
      \`fast-lattice-421210.analytics_274422295.events_*\`, UNNEST(items) AS i
    WHERE
      event_name = 'purchase'
      AND ${eventsBetween}
  ),
  -- This CTE contains products purchased after the click events along with the cleaned product names
  products_purchased_after_click_events AS (
    SELECT
      product_name,
      COUNT(DISTINCT transaction_id) AS purchases_with_service
    FROM
      products_purchased_cte
    WHERE
      transaction_id IN (SELECT DISTINCT transaction_id FROM tran_ids_required)
    GROUP BY product_name
  ),
  -- Total views per product
  total_views AS (
    SELECT
      TRIM(SPLIT(REGEXP_REPLACE(ep.value.string_value, 'â€“', '-'), '-')[SAFE_OFFSET(0)]) AS product_name,
      COUNT(DISTINCT ev.user_pseudo_id) AS total_views
    FROM
      \`fast-lattice-421210.analytics_274422295.events_*\` ev,
      UNNEST(event_params) AS ep
    WHERE
      event_name = 'page_view'
      AND ep.key = 'page_title'
      AND ${eventsBetween}
    GROUP BY TRIM(SPLIT(REGEXP_REPLACE(ep.value.string_value, 'â€“', '-'), '-')[SAFE_OFFSET(0)])
  ),
  -- Total purchases per product
  total_purchases AS (
    SELECT
      TRIM(i.item_name) AS product_name,
      COUNT(DISTINCT (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'transaction_id')) AS total_purchases
    FROM
      \`fast-lattice-421210.analytics_274422295.events_*\`, UNNEST(items) AS i
    WHERE
      event_name = 'purchase'
      AND ${eventsBetween}
    GROUP BY TRIM(i.item_name)
  ),
  -- Default conversion rate calculation
  default_conversion_rate AS (
    SELECT
      v.product_name,
      v.total_views,
      p.total_purchases,
      ROUND(SAFE_DIVIDE(p.total_purchases, v.total_views) * 100, 2) AS default_conv_rate
    FROM total_views AS v
    JOIN total_purchases AS p
      ON LOWER(v.product_name) = LOWER(p.product_name)
  ),
  -- Joining the CTEs to get the final table
  final AS (
    SELECT
      a.product_name,
      COALESCE(c._3D_Button_Clicks, 0) AS _3D_Button_Clicks,
      COALESCE(b.AR_Button_Clicks, 0) AS AR_Button_Clicks,
      COALESCE(d.purchases_with_service, 0) AS purchases_with_service,
      COALESCE(dc.total_purchases, 0) AS total_purchases,
      COALESCE(c._3D_Button_Clicks, 0) + COALESCE(b.AR_Button_Clicks, 0) AS total_button_clicks,
      ROUND(SAFE_DIVIDE(COALESCE(d.purchases_with_service, 0), COALESCE(c._3D_Button_Clicks, 0) + COALESCE(b.AR_Button_Clicks, 0)) * 100, 2) AS product_conv_rate,
      COALESCE(dc.total_views, 0) AS total_views,
      COALESCE(dc.default_conv_rate, 0) AS default_conv_rate
    FROM all_products AS a
    LEFT JOIN ar_clicks AS b ON LOWER(a.product_name) = LOWER(b.page_title_product_name)
    LEFT JOIN _3d_clicks AS c ON LOWER(a.product_name) = LOWER(c.page_title_product_name)
    LEFT JOIN products_purchased_after_click_events AS d ON a.product_name = d.product_name
    LEFT JOIN default_conversion_rate AS dc ON LOWER(a.product_name) = LOWER(dc.product_name)
    WHERE COALESCE(c._3D_Button_Clicks, 0) + COALESCE(b.AR_Button_Clicks, 0) > 0
    ORDER BY d.purchases_with_service DESC
  )

SELECT * FROM final
WHERE total_button_clicks > 0 OR purchases_with_service > 0
`,
};
