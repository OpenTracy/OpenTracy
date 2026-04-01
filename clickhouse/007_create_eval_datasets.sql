-- ============================================================================
-- Evaluations: datasets + samples tables
-- ============================================================================

-- Datasets table
CREATE TABLE IF NOT EXISTS eval_datasets (
    dataset_id          String,
    tenant_id           String       DEFAULT 'default',
    name                String,
    description         String       DEFAULT '',
    source              LowCardinality(String)  DEFAULT 'manual',
    samples_count       UInt32       DEFAULT 0,
    created_at          DateTime64(3, 'UTC') DEFAULT now64(3),
    updated_at          DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (tenant_id, dataset_id);


-- Samples table
CREATE TABLE IF NOT EXISTS eval_samples (
    sample_id           String,
    dataset_id          String,
    tenant_id           String       DEFAULT 'default',
    input               String       DEFAULT '',
    expected_output     String       DEFAULT '',
    metadata            String       DEFAULT '{}',
    trace_id            String       DEFAULT '',
    created_at          DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(created_at)
ORDER BY (tenant_id, dataset_id, sample_id);


-- Auto-collect config table
CREATE TABLE IF NOT EXISTS eval_auto_collect (
    dataset_id          String,
    tenant_id           String       DEFAULT 'default',
    enabled             UInt8        DEFAULT 1,
    source_model        String       DEFAULT '',
    instruction         String       DEFAULT '',
    max_samples         UInt32       DEFAULT 5000,
    collection_interval_minutes UInt32 DEFAULT 60,
    curation_config     String       DEFAULT '{}',
    last_collected_at   Nullable(DateTime64(3, 'UTC')),
    total_collected     UInt32       DEFAULT 0,
    created_at          DateTime64(3, 'UTC') DEFAULT now64(3),
    updated_at          DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (tenant_id, dataset_id);


-- Collection run history
CREATE TABLE IF NOT EXISTS eval_collect_runs (
    run_id              String,
    dataset_id          String,
    tenant_id           String       DEFAULT 'default',
    samples_added       UInt32       DEFAULT 0,
    traces_scanned      UInt32       DEFAULT 0,
    traces_new          UInt32       DEFAULT 0,
    status              LowCardinality(String) DEFAULT 'completed',
    details             String       DEFAULT '{}',
    created_at          DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = MergeTree
ORDER BY (tenant_id, dataset_id, created_at)
TTL toDateTime(created_at) + INTERVAL 90 DAY;
