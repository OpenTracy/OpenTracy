export interface TraceItem {
  id: string;
  event_id: string;
  model_id: string;
  backend: string;
  provider: string;
  endpoint: string;
  created_at: string;
  latency_s: number;
  ttft_s: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  tokens_per_s: number;
  cost_usd: number;
  is_success: boolean;
  is_stream: boolean;
  status: 'Success' | 'Error';
  input_preview: string;
  output_preview: string;
  output_text: string;
  deployment_id: string | null;
  error_code: string | null;
  history: string | null;
  input_messages: TraceMessage[] | null;
  output_message: TraceOutputMessage | null;
  finish_reason: string | null;
  request_tools: TraceToolDef[] | null;
}

export interface TraceToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface TraceMessage {
  role: string;
  content?: string | null;
  name?: string;
  tool_calls?: TraceToolCall[];
  tool_call_id?: string;
}

export interface TraceOutputMessage {
  role: string;
  content?: string | null;
  tool_calls?: TraceToolCall[];
}

export interface TraceToolDef {
  type: string;
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export interface AnalyticsMetrics {
  totals: AnalyticsTotals;
  series: AnalyticsSeries;
  distributions: AnalyticsDistributions;
  trends: AnalyticsTrends;
  leaders: AnalyticsLeaders;
  insights: AnalyticsInsight[];
  raw_sample?: TraceItem[];
}

export interface AnalyticsTotals {
  request_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
  success_rate: number;
  avg_latency_s: number;
  p95_latency_s: number;
  avg_cost_per_1k_tokens_usd: number;
  streaming_share: number;
}

export interface AnalyticsSeries {
  by_time: TimeSeriesPoint[];
  by_model: ModelSeriesPoint[];
  by_backend: BackendSeriesPoint[];
}

export interface TimeSeriesPoint {
  time: string;
  request_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  avg_latency_s: number;
  p95_latency_s: number;
  error_rate: number;
  total_cost_usd: number;
}

export interface ModelSeriesPoint {
  model_id: string;
  request_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  avg_latency_s: number;
  p95_latency_s: number;
  error_rate: number;
  total_cost_usd: number;
}

export interface BackendSeriesPoint {
  backend: string;
  request_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  avg_latency_s: number;
  p95_latency_s: number;
  error_rate: number;
  total_cost_usd: number;
}

export interface AnalyticsDistributions {
  latency_s: DistributionStats;
  ttft_s: DistributionStats;
  input_tokens: DistributionStats;
  output_tokens: DistributionStats;
  cost_per_request_usd: DistributionStats;
}

export interface DistributionStats {
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  mean: number;
  std: number;
}

export interface AnalyticsTrends {
  last_7d: TrendPeriod;
  prev_7d: TrendPeriod;
  pct_change: {
    requests: number | null;
    cost_usd: number | null;
    p95_latency_s: number | null;
    error_rate: number | null;
  };
}

export interface TrendPeriod {
  requests: number;
  cost_usd: number;
  p95_latency_s: number;
  error_rate: number;
}

export interface AnalyticsLeaders {
  top_cost_models: CostLeader[];
  slowest_models_p95_latency: LatencyLeader[];
  most_errors_models: ErrorLeader[];
}

export interface CostLeader {
  model_id: string;
  total_cost_usd: number;
  request_count: number;
}

export interface LatencyLeader {
  model_id: string;
  p95_latency_s: number;
  count: number;
}

export interface ErrorLeader {
  model_id: string;
  error_count: number;
  total_requests: number;
  error_rate: number;
}

export interface AnalyticsInsight {
  type: 'anomaly' | 'trend' | 'projection';
  message: string;
  severity: 'low' | 'medium' | 'high';
  data?: any;
}

export interface AnalyticsFilters {
  start_date?: string;
  end_date?: string;
  granularity?: 'hourly' | 'daily' | 'monthly';
  backend?: 'ecs' | 'sagemaker';
  model_id?: string;
  deployment_id?: string;
  is_stream?: boolean;
  is_success?: boolean;
  raw_sample_n?: number;
}
