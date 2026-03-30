-- 004: Add input/output content columns for trace detail view.

ALTER TABLE llm_traces ADD COLUMN IF NOT EXISTS input_text String DEFAULT '';
ALTER TABLE llm_traces ADD COLUMN IF NOT EXISTS output_text String DEFAULT '';
ALTER TABLE llm_traces ADD COLUMN IF NOT EXISTS input_messages String DEFAULT '';
ALTER TABLE llm_traces ADD COLUMN IF NOT EXISTS output_message String DEFAULT '';
