-- 006: Add tool call tracking, execution timeline, and tokens_per_s.

ALTER TABLE llm_traces ADD COLUMN IF NOT EXISTS finish_reason LowCardinality(String) DEFAULT '';
ALTER TABLE llm_traces ADD COLUMN IF NOT EXISTS request_tools String DEFAULT '[]';
ALTER TABLE llm_traces ADD COLUMN IF NOT EXISTS response_tool_calls String DEFAULT '[]';
ALTER TABLE llm_traces ADD COLUMN IF NOT EXISTS has_tool_calls UInt8 DEFAULT 0;
ALTER TABLE llm_traces ADD COLUMN IF NOT EXISTS tool_calls_count UInt16 DEFAULT 0;
ALTER TABLE llm_traces ADD COLUMN IF NOT EXISTS execution_timeline String DEFAULT '[]';
ALTER TABLE llm_traces ADD COLUMN IF NOT EXISTS tokens_per_s Float64 DEFAULT 0;
