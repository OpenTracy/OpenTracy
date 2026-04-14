-- 009: Operator loop metadata — dataset status/rationale and decision log.

ALTER TABLE eval_datasets
    ADD COLUMN IF NOT EXISTS status LowCardinality(String) DEFAULT 'active';

ALTER TABLE eval_datasets
    ADD COLUMN IF NOT EXISTS rationale String DEFAULT '';

ALTER TABLE eval_samples
    ADD COLUMN IF NOT EXISTS status LowCardinality(String) DEFAULT 'curated';

CREATE TABLE IF NOT EXISTS operator_decisions
(
    id              String,
    timestamp       DateTime64(3, 'UTC'),
    tick_id         String,
    action          LowCardinality(String),
    rationale       String,
    inputs          String,
    outcome         LowCardinality(String),
    outcome_json    String
)
ENGINE = MergeTree
ORDER BY timestamp;
