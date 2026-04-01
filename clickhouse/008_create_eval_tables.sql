-- ============================================================================
-- Evaluations: all remaining eval tables
-- ============================================================================

-- Evaluations (mutable — status changes, progress updates)
CREATE TABLE IF NOT EXISTS eval_evaluations (
    evaluation_id       String,
    tenant_id           String       DEFAULT 'default',
    name                String       DEFAULT '',
    description         String       DEFAULT '',
    dataset_id          String       DEFAULT '',
    models              String       DEFAULT '[]',
    metrics             String       DEFAULT '[]',
    config              String       DEFAULT '{}',
    status              LowCardinality(String)  DEFAULT 'pending',
    progress            UInt8        DEFAULT 0,
    current_sample      UInt32       DEFAULT 0,
    total_samples       UInt32       DEFAULT 0,
    execution_type      LowCardinality(String) DEFAULT 'platform',
    auto_eval_config_id String       DEFAULT '',
    original_evaluation_id String    DEFAULT '',
    error_message       String       DEFAULT '',
    started_at          Nullable(DateTime64(3, 'UTC')),
    completed_at        Nullable(DateTime64(3, 'UTC')),
    created_at          DateTime64(3, 'UTC') DEFAULT now64(3),
    updated_at          DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (tenant_id, evaluation_id);


-- Evaluation results (one per evaluation, mutable)
CREATE TABLE IF NOT EXISTS eval_evaluation_results (
    evaluation_id       String,
    tenant_id           String       DEFAULT 'default',
    summary             String       DEFAULT '{}',
    samples             String       DEFAULT '[]',
    winner              String       DEFAULT '',
    created_at          DateTime64(3, 'UTC') DEFAULT now64(3),
    updated_at          DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (tenant_id, evaluation_id);


-- Metrics (mutable — custom metrics can be edited)
CREATE TABLE IF NOT EXISTS eval_metrics (
    metric_id           String,
    tenant_id           String       DEFAULT 'default',
    name                String       DEFAULT '',
    type                LowCardinality(String) DEFAULT 'exact_match',
    description         String       DEFAULT '',
    is_builtin          UInt8        DEFAULT 0,
    config              String       DEFAULT '{}',
    python_script       String       DEFAULT '',
    requirements        String       DEFAULT '[]',
    source              String       DEFAULT '',
    created_at          DateTime64(3, 'UTC') DEFAULT now64(3),
    updated_at          DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (tenant_id, metric_id);


-- Experiments (mutable — status changes)
CREATE TABLE IF NOT EXISTS eval_experiments (
    experiment_id       String,
    tenant_id           String       DEFAULT 'default',
    name                String       DEFAULT '',
    description         String       DEFAULT '',
    dataset_id          String       DEFAULT '',
    evaluation_ids      String       DEFAULT '[]',
    tags                String       DEFAULT '[]',
    status              LowCardinality(String)  DEFAULT 'draft',
    started_at          Nullable(DateTime64(3, 'UTC')),
    completed_at        Nullable(DateTime64(3, 'UTC')),
    created_at          DateTime64(3, 'UTC') DEFAULT now64(3),
    updated_at          DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (tenant_id, experiment_id);


-- Experiment comparison results (one per experiment, mutable)
CREATE TABLE IF NOT EXISTS eval_experiment_comparisons (
    experiment_id       String,
    tenant_id           String       DEFAULT 'default',
    baseline_id         String       DEFAULT '',
    evaluation_ids      String       DEFAULT '[]',
    metric_summary      String       DEFAULT '{}',
    samples             String       DEFAULT '[]',
    created_at          DateTime64(3, 'UTC') DEFAULT now64(3),
    updated_at          DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (tenant_id, experiment_id);


-- Annotation queues (mutable — counters updated)
CREATE TABLE IF NOT EXISTS eval_annotation_queues (
    queue_id            String,
    tenant_id           String       DEFAULT 'default',
    name                String       DEFAULT '',
    dataset_id          String       DEFAULT '',
    rubric              String       DEFAULT '[]',
    total_items         UInt32       DEFAULT 0,
    completed_items     UInt32       DEFAULT 0,
    skipped_items       UInt32       DEFAULT 0,
    created_at          DateTime64(3, 'UTC') DEFAULT now64(3),
    updated_at          DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (tenant_id, queue_id);


-- Annotation items (mutable — status changes pending→completed/skipped)
CREATE TABLE IF NOT EXISTS eval_annotation_items (
    item_id             String,
    queue_id            String,
    tenant_id           String       DEFAULT 'default',
    sample_id           String       DEFAULT '',
    input               String       DEFAULT '',
    expected_output     String       DEFAULT '',
    metadata            String       DEFAULT '{}',
    status              LowCardinality(String) DEFAULT 'pending',
    scores              String       DEFAULT '{}',
    notes               String       DEFAULT '',
    annotated_at        Nullable(DateTime64(3, 'UTC')),
    created_at          DateTime64(3, 'UTC') DEFAULT now64(3),
    updated_at          DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (tenant_id, queue_id, item_id);


-- Auto-eval configs (mutable — settings change)
CREATE TABLE IF NOT EXISTS eval_auto_eval_configs (
    config_id           String,
    tenant_id           String       DEFAULT 'default',
    name                String       DEFAULT '',
    dataset_id          String       DEFAULT '',
    dataset_name        String       DEFAULT '',
    models              String       DEFAULT '[]',
    metrics             String       DEFAULT '[]',
    schedule            LowCardinality(String) DEFAULT 'daily',
    enabled             UInt8        DEFAULT 1,
    alert_on_regression UInt8        DEFAULT 1,
    regression_threshold Float32     DEFAULT 0.05,
    topic_filter        String       DEFAULT '',
    source              String       DEFAULT '',
    last_run_at         Nullable(DateTime64(3, 'UTC')),
    last_run_score      Nullable(Float32),
    created_at          DateTime64(3, 'UTC') DEFAULT now64(3),
    updated_at          DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (tenant_id, config_id);


-- Auto-eval runs (mutable — status/scores update after eval completes)
CREATE TABLE IF NOT EXISTS eval_auto_eval_runs (
    run_id              String,
    config_id           String,
    tenant_id           String       DEFAULT 'default',
    evaluation_id       String       DEFAULT '',
    status              LowCardinality(String) DEFAULT 'running',
    scores              String       DEFAULT '{}',
    regression_detected UInt8        DEFAULT 0,
    error_message       String       DEFAULT '',
    started_at          DateTime64(3, 'UTC') DEFAULT now64(3),
    completed_at        Nullable(DateTime64(3, 'UTC')),
    created_at          DateTime64(3, 'UTC') DEFAULT now64(3),
    updated_at          DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (tenant_id, config_id, run_id);


-- Trace issues (mutable — resolved flag changes)
CREATE TABLE IF NOT EXISTS eval_trace_issues (
    issue_id            String,
    tenant_id           String       DEFAULT 'default',
    trace_id            String       DEFAULT '',
    type                LowCardinality(String) DEFAULT '',
    severity            LowCardinality(String) DEFAULT 'medium',
    title               String       DEFAULT '',
    description         String       DEFAULT '',
    details             String       DEFAULT '{}',
    ai_confidence       Float32      DEFAULT 0,
    model_id            String       DEFAULT '',
    trace_input         String       DEFAULT '',
    trace_output        String       DEFAULT '',
    suggested_action    String       DEFAULT '',
    resolved            UInt8        DEFAULT 0,
    detected_at         DateTime64(3, 'UTC') DEFAULT now64(3),
    resolved_at         Nullable(DateTime64(3, 'UTC')),
    created_at          DateTime64(3, 'UTC') DEFAULT now64(3),
    updated_at          DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (tenant_id, issue_id);


-- Trace scans (mutable — status updates)
CREATE TABLE IF NOT EXISTS eval_trace_scans (
    scan_id             String,
    tenant_id           String       DEFAULT 'default',
    status              LowCardinality(String) DEFAULT 'running',
    traces_scanned      UInt32       DEFAULT 0,
    issues_found        UInt32       DEFAULT 0,
    error               String       DEFAULT '',
    started_at          DateTime64(3, 'UTC') DEFAULT now64(3),
    completed_at        Nullable(DateTime64(3, 'UTC')),
    created_at          DateTime64(3, 'UTC') DEFAULT now64(3),
    updated_at          DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (tenant_id, scan_id);


-- Proposals (mutable — status changes)
CREATE TABLE IF NOT EXISTS eval_proposals (
    proposal_id         String,
    tenant_id           String       DEFAULT 'default',
    proposal_type       LowCardinality(String) DEFAULT '',
    event_type          String       DEFAULT '',
    priority            String       DEFAULT 'medium',
    title               String       DEFAULT '',
    description         String       DEFAULT '',
    reason              String       DEFAULT '',
    status              LowCardinality(String) DEFAULT 'pending',
    dataset_id          String       DEFAULT '',
    config_id           String       DEFAULT '',
    evaluation_id       String       DEFAULT '',
    dedup_key           String       DEFAULT '',
    action_config       String       DEFAULT '{}',
    action_payload      String       DEFAULT '{}',
    execution_result    String       DEFAULT '{}',
    expires_at          Nullable(DateTime64(3, 'UTC')),
    resolved_at         Nullable(DateTime64(3, 'UTC')),
    created_at          DateTime64(3, 'UTC') DEFAULT now64(3),
    updated_at          DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (tenant_id, proposal_id);


-- Settings (one row per tenant, mutable)
CREATE TABLE IF NOT EXISTS eval_settings (
    tenant_id           String,
    default_judge_model String       DEFAULT 'gpt-4',
    default_temperature Float32      DEFAULT 0.7,
    max_parallel_requests UInt8      DEFAULT 5,
    python_script_timeout UInt16     DEFAULT 30,
    config              String       DEFAULT '{}',
    updated_at          DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (tenant_id);
