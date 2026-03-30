-- 005: Domain clustering tables and trace linkage.

-- Clustering runs (one row per pipeline execution)
CREATE TABLE IF NOT EXISTS clustering_runs
(
    run_id              String,
    created_at          DateTime64(3, 'UTC'),
    strategy            LowCardinality(String),
    num_clusters        UInt32,
    silhouette_score    Float64,
    source_window_start DateTime64(3, 'UTC'),
    source_window_end   DateTime64(3, 'UTC'),
    total_traces        UInt32,
    embedding_model     String,
    labeler_model       String,
    config              String
)
ENGINE = MergeTree
ORDER BY (run_id);

-- Per-cluster dataset results (one row per cluster per run)
CREATE TABLE IF NOT EXISTS cluster_datasets
(
    run_id              String,
    cluster_id          UInt32,
    status              LowCardinality(String),
    domain_label        String,
    short_description   String,
    inclusion_rule      String,
    exclusion_rule      String,
    label_confidence    Float64,
    trace_count         UInt32,
    coherence_score     Float64,
    diversity_score     Float64,
    noise_rate          Float64,
    avg_success_rate    Float64,
    avg_latency_ms      Float64,
    avg_cost_usd        Float64,
    top_models          String,
    top_providers       String,
    sample_prompts      String,
    version             String
)
ENGINE = MergeTree
ORDER BY (run_id, cluster_id);

-- Mapping table: links each trace to its domain cluster (batch insert, no mutations)
CREATE TABLE IF NOT EXISTS trace_cluster_map
(
    run_id              String,
    request_id          String,
    cluster_id          UInt32
)
ENGINE = ReplacingMergeTree
ORDER BY (run_id, request_id);
