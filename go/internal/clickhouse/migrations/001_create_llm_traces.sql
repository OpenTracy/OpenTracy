-- 001: Raw per-request trace table.
-- One row per routing decision or LLM inference request.
-- ORDER BY (selected_model, timestamp) optimizes the most common query pattern:
--   "show metrics for model X in the last N hours"
-- PARTITION BY month keeps partition sizes manageable and enables efficient TTL cleanup.

CREATE TABLE IF NOT EXISTS llm_traces
(
    -- Identity
    request_id              String DEFAULT generateUUIDv4(),
    timestamp               DateTime64(3, 'UTC'),

    -- Routing context
    selected_model          LowCardinality(String),
    provider                LowCardinality(String)   DEFAULT '',
    cluster_id              Int32                     DEFAULT -1,
    expected_error          Float64                   DEFAULT 0,
    cost_adjusted_score     Float64                   DEFAULT 0,

    -- Timing (milliseconds)
    latency_ms              Float64                   DEFAULT 0,
    ttft_ms                 Float64                   DEFAULT 0,
    routing_ms              Float64                   DEFAULT 0,
    embedding_ms            Float64                   DEFAULT 0,

    -- Tokens
    tokens_in               UInt32                    DEFAULT 0,
    tokens_out              UInt32                    DEFAULT 0,
    total_tokens            UInt32                    DEFAULT 0,

    -- Cost (USD)
    input_cost_usd          Float64                   DEFAULT 0,
    output_cost_usd         Float64                   DEFAULT 0,
    cache_input_cost_usd    Float64                   DEFAULT 0,
    total_cost_usd          Float64                   DEFAULT 0,

    -- Status
    is_error                UInt8                     DEFAULT 0,
    error_category          LowCardinality(String)    DEFAULT '',
    error_message           String                    DEFAULT '',

    -- Request metadata
    request_type            LowCardinality(String)    DEFAULT 'chat',  -- 'route', 'chat', 'chat_stream'
    is_stream               UInt8                     DEFAULT 0,
    cache_hit               UInt8                     DEFAULT 0,

    -- Fallback chain
    fallback_count          UInt8                     DEFAULT 0,
    provider_attempts       String                    DEFAULT '[]',    -- JSON array

    -- Routing decision detail (JSON blobs)
    all_scores              String                    DEFAULT '{}',
    cluster_probabilities   String                    DEFAULT '[]'
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(timestamp)
ORDER BY (selected_model, timestamp)
TTL toDateTime(timestamp) + INTERVAL 90 DAY;
