ALTER TABLE eval_datasets ADD COLUMN IF NOT EXISTS tenant_id String DEFAULT 'default';
ALTER TABLE eval_datasets ADD COLUMN IF NOT EXISTS dataset_id String DEFAULT '';
ALTER TABLE eval_datasets UPDATE dataset_id = id WHERE dataset_id = '' AND id != '';
