-- ============================================================================
-- Distillation: BOND distillation pipeline tables
-- ============================================================================

-- Distillation Jobs (master record for each pipeline run)
CREATE TABLE IF NOT EXISTS distillation_jobs (
    job_id              String,
    tenant_id           String       DEFAULT 'default',
    name                String       DEFAULT '',
    description         String       DEFAULT '',
    status              LowCardinality(String) DEFAULT 'pending',
    phase               LowCardinality(String) DEFAULT 'initializing',
    config              String       DEFAULT '{}',
    progress            String       DEFAULT '{}',
    results             String       DEFAULT '{}',
    artifacts           String       DEFAULT '{}',
    error               String       DEFAULT '',
    cost_accrued         Float64     DEFAULT 0,
    pipeline_logs       String       DEFAULT '[]',
    started_at          Nullable(DateTime64(3, 'UTC')),
    completed_at        Nullable(DateTime64(3, 'UTC')),
    created_at          DateTime64(3, 'UTC') DEFAULT now64(3),
    updated_at          DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (tenant_id, job_id);

-- BON Candidates (generated teacher responses per prompt)
CREATE TABLE IF NOT EXISTS distillation_candidates (
    candidate_id        String,
    job_id              String,
    tenant_id           String       DEFAULT 'default',
    prompt_id           String       DEFAULT '',
    candidate_idx       UInt8        DEFAULT 0,
    prompt              String       DEFAULT '',
    system_prompt       String       DEFAULT '',
    response            String       DEFAULT '',
    model               String       DEFAULT '',
    temperature         Float32      DEFAULT 0.8,
    score               Float64      DEFAULT 0,
    selected            UInt8        DEFAULT 0,
    usage               String       DEFAULT '{}',
    created_at          DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(created_at)
ORDER BY (job_id, prompt_id, candidate_idx);

-- Training Metrics (per-step metrics for training curves)
CREATE TABLE IF NOT EXISTS distillation_metrics (
    job_id              String,
    tenant_id           String       DEFAULT 'default',
    step                UInt32       DEFAULT 0,
    epoch               Float32      DEFAULT 0,
    loss                Float64      DEFAULT 0,
    learning_rate       Float64      DEFAULT 0,
    reward_policy_mean  Float64      DEFAULT 0,
    reward_anchor_mean  Float64      DEFAULT 0,
    kl_penalty          Float64      DEFAULT 0,
    bond_loss           Float64      DEFAULT 0,
    anchor_loss         Float64      DEFAULT 0,
    jeffreys_kl         Float64      DEFAULT 0,
    loss_forward_kl     Float64      DEFAULT 0,
    loss_backward_kl    Float64      DEFAULT 0,
    loss_kl_reg         Float64      DEFAULT 0,
    jbond_penalties     Float64      DEFAULT 0,
    reward_improvement  Float64      DEFAULT 0,
    created_at          DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(created_at)
ORDER BY (job_id, step);
