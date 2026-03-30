import { useCallback } from 'react';
import { STATS_API_URL } from '../config/api';

const ANALYTICS_STATS_URL = STATS_API_URL;

export interface AnalyticsMetricsParams {
  start_date?: string;
  end_date?: string;
  granularity?: 'hourly' | 'daily' | 'monthly';
  backend?: string;
  model_id?: string;
  deployment_id?: string;
  is_stream?: boolean;
  is_success?: boolean;
  raw_sample_n?: number;
}

export interface AnalyticsMetricsResponse {
  totals: {
    request_count: number;
    total_input_tokens: number;
    total_output_tokens: number;
    total_cost_usd: number;
    success_rate: number;
    avg_latency_s: number;
    p95_latency_s: number;
    avg_cost_per_1k_tokens_usd: number;
    streaming_share: number;
  };
  series: {
    by_time: TimeSeriesData[];
    by_model: ModelSeriesData[];
    by_backend: BackendSeriesData[];
  };
  distributions: {
    latency_s: DistributionData;
    ttft_s: DistributionData;
    input_tokens: DistributionData;
    output_tokens: DistributionData;
    cost_per_request_usd: DistributionData;
  };
  trends: {
    last_7d: TrendData;
    prev_7d: TrendData;
    pct_change: {
      requests: number | null;
      cost_usd: number | null;
      p95_latency_s: number | null;
      error_rate: number | null;
    };
  };
  leaders: {
    top_cost_models: CostLeaderData[];
    slowest_models_p95_latency: LatencyLeaderData[];
    most_errors_models: ErrorLeaderData[];
  };
  insights: InsightData[];
  raw_sample?: RawSampleData[];
  total_traces?: number;
}

export interface TimeSeriesData {
  time: string;
  request_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  avg_latency_s: number;
  p95_latency_s: number;
  error_rate: number;
  total_cost_usd: number;
}

export interface ModelSeriesData {
  model_id: string;
  request_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  avg_latency_s: number;
  p95_latency_s: number;
  error_rate: number;
  total_cost_usd: number;
}

export interface BackendSeriesData {
  backend: string;
  request_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  avg_latency_s: number;
  p95_latency_s: number;
  error_rate: number;
  total_cost_usd: number;
}

export interface DistributionData {
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  mean: number;
  std: number;
}

export interface TrendData {
  requests: number;
  cost_usd: number;
  p95_latency_s: number;
  error_rate: number;
}

export interface CostLeaderData {
  model_id: string;
  total_cost_usd: number;
  request_count: number;
}

export interface LatencyLeaderData {
  model_id: string;
  p95_latency_s: number;
  count: number;
}

export interface ErrorLeaderData {
  model_id: string;
  error_count: number;
  total_requests: number;
  error_rate: number;
}

export interface InsightData {
  type: 'anomaly' | 'trend' | 'projection';
  message: string;
  severity: 'low' | 'medium' | 'high';
  data?: any;
}

export interface RawSampleData {
  event_id: string;
  id?: string;
  model_id: string;
  backend: string;
  endpoint: string;
  created_at: string;
  latency_s: number;
  ttft_s: number;
  input_tokens: number;
  output_tokens: number;
  total_cost_usd: number;
  cost_usd?: number;
  is_success: boolean;
  success?: boolean;
  is_stream: boolean;
  input_preview: string;
  output_preview: string;
  output_text: string;
  deployment_id: string | null;
  error_code: string | null;
  history: string | null;
  input_messages?: unknown[] | string | null;
  output_message?: Record<string, unknown> | string | null;
  finish_reason?: string | null;
  request_tools?: unknown[] | string | null;
}

export interface TraceQueryParams {
  trace_limit?: number;
  trace_offset?: number;
  model_id?: string;
  backend?: string;
  is_success?: boolean;
  search?: string;
}

export function useAnalyticsMetricsService() {
  const getAnalyticsMetrics = useCallback(
    async (
      _accessToken: string,
      tenantId: string,
      days: number = 30,
      traceParams?: TraceQueryParams
    ): Promise<AnalyticsMetricsResponse> => {

      const queryParams = new URLSearchParams();
      queryParams.append('days', days.toString());

      if (traceParams) {
        if (traceParams.trace_limit !== undefined) {
          queryParams.append('trace_limit', traceParams.trace_limit.toString());
        }
        if (traceParams.trace_offset !== undefined) {
          queryParams.append('trace_offset', traceParams.trace_offset.toString());
        }
        if (traceParams.model_id) {
          queryParams.append('model_id', traceParams.model_id);
        }
        if (traceParams.backend) {
          queryParams.append('backend', traceParams.backend);
        }
        if (traceParams.is_success !== undefined) {
          queryParams.append('is_success', traceParams.is_success.toString());
        }
        if (traceParams.search) {
          queryParams.append('search', traceParams.search);
        }
      }

      const url = `${ANALYTICS_STATS_URL}/v1/stats/${tenantId}/analytics?${queryParams.toString()}`;

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error(`Authentication failed: Please check your credentials (${res.status})`);
        } else if (res.status === 403) {
          throw new Error(`Access forbidden: You don't have permission (${res.status})`);
        } else if (res.status === 404) {
          throw new Error(`Resource not found (${res.status})`);
        } else {
          throw new Error(`Failed to fetch analytics metrics: ${res.status} ${res.statusText}`);
        }
      }

      return res.json();
    },
    []
  );

  return { getAnalyticsMetrics };
}
