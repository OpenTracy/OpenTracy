-- 002: Materialized view — hourly model-level aggregations.
-- Auto-populated from inserts into llm_traces.
-- Uses AggregatingMergeTree for quantile and uniq support.
--
-- Query pattern (always use Merge combinators, never SELECT ... FINAL):
--   SELECT
--     selected_model,
--     hour,
--     countMerge(request_count)                          AS requests,
--     sumMerge(error_count)                              AS errors,
--     quantilesMerge(0.5, 0.95, 0.99)(latency_quantiles) AS latency_pcts,
--     quantilesMerge(0.5, 0.95)(ttft_quantiles)          AS ttft_pcts,
--     sumMerge(total_tokens_in)                          AS tokens_in,
--     sumMerge(total_tokens_out)                         AS tokens_out,
--     sumMerge(total_cost_usd)                           AS cost,
--     uniqMerge(unique_providers)                        AS providers,
--     uniqMerge(unique_clusters)                         AS clusters
--   FROM model_hourly_stats
--   WHERE selected_model = 'gpt-4o' AND hour >= now() - INTERVAL 24 HOUR
--   GROUP BY selected_model, hour
--   ORDER BY hour;

CREATE TABLE IF NOT EXISTS model_hourly_stats
(
    hour                DateTime,
    selected_model      LowCardinality(String),

    request_count       AggregateFunction(count, UInt8),
    error_count         AggregateFunction(sum, UInt8),

    latency_quantiles   AggregateFunction(quantiles(0.5, 0.95, 0.99), Float64),
    ttft_quantiles      AggregateFunction(quantiles(0.5, 0.95), Float64),

    total_tokens_in     AggregateFunction(sum, UInt32),
    total_tokens_out    AggregateFunction(sum, UInt32),
    total_cost_usd      AggregateFunction(sum, Float64),

    unique_providers    AggregateFunction(uniq, String),
    unique_clusters     AggregateFunction(uniq, Int32)
)
ENGINE = AggregatingMergeTree
PARTITION BY toYYYYMM(hour)
ORDER BY (selected_model, hour)
TTL toDateTime(hour) + INTERVAL 90 DAY;

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_model_hourly
TO model_hourly_stats
AS
SELECT
    toStartOfHour(timestamp)                          AS hour,
    selected_model,
    countState(is_error)                              AS request_count,
    sumState(is_error)                                AS error_count,
    quantilesState(0.5, 0.95, 0.99)(latency_ms)      AS latency_quantiles,
    quantilesState(0.5, 0.95)(ttft_ms)                AS ttft_quantiles,
    sumState(tokens_in)                               AS total_tokens_in,
    sumState(tokens_out)                              AS total_tokens_out,
    sumState(total_cost_usd)                          AS total_cost_usd,
    uniqState(provider)                               AS unique_providers,
    uniqState(cluster_id)                             AS unique_clusters
FROM llm_traces
GROUP BY hour, selected_model;
