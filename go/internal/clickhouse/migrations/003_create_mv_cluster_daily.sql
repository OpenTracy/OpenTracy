-- 003: Materialized view — daily cluster-level aggregations.
-- Used for understanding routing distribution and per-cluster model performance.
-- Longer TTL (365d) since daily rollups are compact.
--
-- Query pattern:
--   SELECT
--     cluster_id,
--     day,
--     countMerge(request_count)                    AS requests,
--     sumMerge(error_count)                        AS errors,
--     quantilesMerge(0.5, 0.95)(latency_quantiles) AS latency_pcts,
--     sumMerge(total_tokens)                       AS tokens,
--     sumMerge(total_cost_usd)                     AS cost,
--     uniqMerge(unique_models)                     AS models_used
--   FROM cluster_daily_stats
--   WHERE day >= today() - 30
--   GROUP BY cluster_id, day
--   ORDER BY day;

CREATE TABLE IF NOT EXISTS cluster_daily_stats
(
    day                 Date,
    cluster_id          Int32,

    request_count       AggregateFunction(count, UInt8),
    error_count         AggregateFunction(sum, UInt8),

    latency_quantiles   AggregateFunction(quantiles(0.5, 0.95), Float64),

    total_tokens        AggregateFunction(sum, UInt32),
    total_cost_usd      AggregateFunction(sum, Float64),

    unique_models       AggregateFunction(uniq, String)
)
ENGINE = AggregatingMergeTree
PARTITION BY toYYYYMM(day)
ORDER BY (cluster_id, day)
TTL toDate(day) + INTERVAL 365 DAY;

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_cluster_daily
TO cluster_daily_stats
AS
SELECT
    toDate(timestamp)                              AS day,
    cluster_id,
    countState(is_error)                           AS request_count,
    sumState(is_error)                             AS error_count,
    quantilesState(0.5, 0.95)(latency_ms)          AS latency_quantiles,
    sumState(total_tokens)                         AS total_tokens,
    sumState(total_cost_usd)                       AS total_cost_usd,
    uniqState(selected_model)                      AS unique_models
FROM llm_traces
GROUP BY day, cluster_id;
