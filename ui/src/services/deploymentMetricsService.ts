import { useCallback } from 'react';
import { API_BASE_URL } from '../config/api';

// Interface for the NEW deployment metrics API response
export interface NewMetricsResponse {
  deployment_id: string;
  latest: {
    cpu_utilization: number;
    memory_utilization: number;
    gpu_utilization: number;
    gpu_memory_utilization: number;
    model_latency_ms: number;
    invocations: number;
  };
  inference_stats: {
    total_inferences: number;
    successful: number;
    failed: number;
    success_rate: number;
    avg_latency_ms: number;
    total_tokens: number;
    total_cost_usd: number;
  };
  time_series: {
    cpu_utilization: { timestamp: string; value: number }[];
    memory_utilization: { timestamp: string; value: number }[];
    gpu_utilization: { timestamp: string; value: number }[];
    gpu_memory_utilization: { timestamp: string; value: number }[];
    model_latency: { timestamp: string; value: number }[];
    invocations: { timestamp: string; value: number }[];
  };
}

// Interface for OLD deployment metrics API response (legacy)
export interface LegacyMetricsResponse {
  deployment_id: string;
  endpoint: string;
  variant: string;
  metric_type: string;
  detected_mode: string | null;
  region: string;
  start: string;
  end: string;
  period: number;
  stat: string;
  series: {
    id: string;
    label: string;
    points: [string, number][];
  }[];
  table: {
    timestamp: string;
    invocations: number;
    invocationsperinstance: number;
    modellatency: number;
    overheadlatency: number;
    invocation4xxerrors: number;
    invocation5xxerrors: number;
    invocationmodelerrors: number;
  }[];
}

// Union type for both response formats
export type DeploymentMetricsResponse = NewMetricsResponse | LegacyMetricsResponse;

// Type guard to check if response is new format
function isNewMetricsFormat(metrics: DeploymentMetricsResponse): metrics is NewMetricsResponse {
  return 'latest' in metrics && 'inference_stats' in metrics && 'time_series' in metrics;
}

// Interface for deployment metrics API parameters
export interface DeploymentMetricsParams {
  deployment_id: string;
  type: string;
  minutes: number;
  period: number;
}

// Interface for processed deployment metrics
export interface ProcessedDeploymentMetrics {
  deploymentId: string;
  endpoint: string;
  totalInvocations: number;
  successRate: number;
  avgLatency: number;
  p95Latency: number;
  avgOverhead: number;
  errorRate: number;
  // End-to-end latency and breakdown
  e2eLatency: number;
  modelLatencyPercentage: number;
  overheadPercentage: number;
  // Throughput and headroom
  rps: number;
  rpm: number;
  theoreticalRps: number;
  utilizationPercentage: number;
  headroomPercentage: number;
  // Error breakdown
  errors4xx: number;
  errors5xx: number;
  errorsModel: number;
  // SLO/Apdex
  apdexScore: number;
  sloStatus: 'pass' | 'fail';
  // Saturation
  invocationsPerInstance: number;
  // Anomaly detection
  hasLatencyAnomaly: boolean;
  hasErrorAnomaly: boolean;
  timePoints: {
    timestamp: string;
    invocations: number;
    latency: number;
    overhead: number;
    errors: number;
    isLatencyAnomaly?: boolean;
    isErrorAnomaly?: boolean;
  }[];
}

export function useDeploymentMetricsService() {
  // Function to get metrics for a specific deployment
  const getDeploymentMetrics = useCallback(
    async (
      accessToken: string,
      params: DeploymentMetricsParams
    ): Promise<DeploymentMetricsResponse> => {
      console.log(
        '[DeploymentMetricsService] Getting metrics for deployment:',
        params.deployment_id
      );

      // Build URL with parameters
      const queryParams = new URLSearchParams();
      queryParams.append('type', params.type);
      queryParams.append('minutes', params.minutes.toString());
      queryParams.append('period', params.period.toString());

      const url = `${API_BASE_URL}/v1/deployments/${params.deployment_id}/metrics?${queryParams.toString()}`;

      try {
        // Using the access token from the session
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          mode: 'cors',
          credentials: 'omit', // Don't include cookies for cross-origin requests to avoid CORS issues
        });

        if (!res.ok) {
          const errorText = await res.text().catch(() => '');
          console.error(
            '[DeploymentMetricsService] Request failed:',
            res.status,
            res.statusText,
            errorText
          );

          // More descriptive error message
          if (res.status === 403) {
            throw new Error(
              `Authentication failed: Please check your credentials or permissions (${res.status} ${res.statusText})`
            );
          } else {
            throw new Error(`Failed to fetch deployment metrics: ${res.status} ${res.statusText}`);
          }
        }

        const result = await res.json();
        console.log('[DeploymentMetricsService] Metrics fetched successfully:', result);
        return result;
      } catch (error) {
        console.error('[DeploymentMetricsService] Error fetching metrics:', error);
        throw error;
      }
    },
    []
  );

  // Function to process NEW metrics format
  const processNewMetrics = useCallback(
    (metrics: NewMetricsResponse): ProcessedDeploymentMetrics => {
      console.log(
        '[DeploymentMetricsService] Processing NEW format metrics for deployment:',
        metrics.deployment_id
      );

      const { inference_stats, latest, time_series } = metrics;

      // Safely extract values with defaults
      const totalInvocations = inference_stats?.total_inferences ?? 0;
      const successRate = inference_stats?.success_rate ?? 100;
      const avgLatency = inference_stats?.avg_latency_ms ?? 0;
      const errorRate =
        totalInvocations > 0 ? ((inference_stats?.failed ?? 0) / totalInvocations) * 100 : 0;

      // Build time points from time_series with defensive checks
      const invocationsData = time_series?.invocations ?? [];
      const latencyData = time_series?.model_latency ?? [];

      const timePoints = invocationsData.map((inv, idx) => ({
        timestamp: inv?.timestamp ?? new Date().toISOString(),
        invocations: inv?.value ?? 0,
        latency: latencyData[idx]?.value ?? 0,
        overhead: 0,
        errors: 0,
        isLatencyAnomaly: false,
        isErrorAnomaly: false,
      }));

      // Calculate P95 from time series latency data
      const latencies = latencyData.map((p) => p?.value ?? 0).filter((l) => l > 0);
      const sortedLatencies = [...latencies].sort((a, b) => a - b);
      const p95Index = Math.floor(sortedLatencies.length * 0.95);
      const p95Latency =
        sortedLatencies.length > 0
          ? sortedLatencies[p95Index] || sortedLatencies[sortedLatencies.length - 1]
          : 0;

      return {
        deploymentId: metrics.deployment_id,
        endpoint: '',
        totalInvocations,
        successRate,
        avgLatency,
        p95Latency,
        avgOverhead: 0,
        errorRate,
        // End-to-end latency and breakdown
        e2eLatency: avgLatency,
        modelLatencyPercentage: 100,
        overheadPercentage: 0,
        // Throughput and headroom
        rps: 0,
        rpm: 0,
        theoreticalRps: 0,
        utilizationPercentage: latest?.gpu_utilization ?? 0,
        headroomPercentage: 100 - (latest?.gpu_memory_utilization ?? 0),
        // Error breakdown
        errors4xx: 0,
        errors5xx: 0,
        errorsModel: inference_stats?.failed ?? 0,
        // SLO/Apdex
        apdexScore: successRate >= 95 ? 0.95 : successRate / 100,
        sloStatus: successRate >= 95 ? 'pass' : 'fail',
        // Saturation
        invocationsPerInstance: totalInvocations,
        // Anomaly detection
        hasLatencyAnomaly: false,
        hasErrorAnomaly: false,
        timePoints,
      };
    },
    []
  );

  // Function to process LEGACY metrics format
  const processLegacyMetrics = useCallback(
    (metrics: LegacyMetricsResponse): ProcessedDeploymentMetrics => {
      console.log(
        '[DeploymentMetricsService] Processing LEGACY format metrics for deployment:',
        metrics.deployment_id
      );

      // Calculate aggregated metrics
      const totalInvocations = metrics.table.reduce((sum, entry) => sum + entry.invocations, 0);

      // Calculate error breakdown
      const errors4xx = metrics.table.reduce((sum, entry) => sum + entry.invocation4xxerrors, 0);
      const errors5xx = metrics.table.reduce((sum, entry) => sum + entry.invocation5xxerrors, 0);
      const errorsModel = metrics.table.reduce(
        (sum, entry) => sum + entry.invocationmodelerrors,
        0
      );
      const totalErrors = errors4xx + errors5xx + errorsModel;

      // Calculate success rate
      const successRate =
        totalInvocations > 0 ? ((totalInvocations - totalErrors) / totalInvocations) * 100 : 100;

      // Calculate average latency (convert from microseconds to milliseconds)
      const latencies = metrics.table
        .map((entry) => entry.modellatency / 1000)
        .filter((l) => l > 0);
      const avgLatency =
        latencies.length > 0
          ? latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length
          : 0;

      // Calculate P95 latency
      const sortedLatencies = [...latencies].sort((a, b) => a - b);
      const p95Index = Math.floor(sortedLatencies.length * 0.95);
      const p95Latency =
        sortedLatencies.length > 0
          ? sortedLatencies[p95Index] || sortedLatencies[sortedLatencies.length - 1]
          : 0;

      // Calculate average overhead (convert from microseconds to milliseconds)
      const overheads = metrics.table
        .map((entry) => entry.overheadlatency / 1000)
        .filter((o) => o > 0);
      const avgOverhead =
        overheads.length > 0
          ? overheads.reduce((sum, overhead) => sum + overhead, 0) / overheads.length
          : 0;

      // Calculate error rate
      const errorRate = totalInvocations > 0 ? (totalErrors / totalInvocations) * 100 : 0;

      // 1) End-to-end latency and breakdown
      const e2eLatency = avgLatency + avgOverhead;
      const modelLatencyPercentage = e2eLatency > 0 ? (avgLatency / e2eLatency) * 100 : 100;
      const overheadPercentage = e2eLatency > 0 ? (avgOverhead / e2eLatency) * 100 : 0;

      // 2) Throughput and headroom
      const windowSizeSeconds = metrics.period || 300;
      const rps = totalInvocations / (metrics.table.length * windowSizeSeconds);
      const rpm = rps * 60;

      const e2eLatencySeconds = e2eLatency / 1000;
      const theoreticalRps = e2eLatencySeconds > 0 ? 1 / e2eLatencySeconds : 0;

      const utilizationPercentage = theoreticalRps > 0 ? (rps / theoreticalRps) * 100 : 0;
      const headroomPercentage = Math.max(0, 100 - utilizationPercentage);

      // 3) SLO/Apdex calculation
      const sloThresholdMs = 1000;
      const satisfiedCount = metrics.table.filter(
        (entry) => (entry.modellatency + entry.overheadlatency) / 1000 <= sloThresholdMs
      ).length;
      const toleratingCount = metrics.table.filter((entry) => {
        const latencyMs = (entry.modellatency + entry.overheadlatency) / 1000;
        return latencyMs > sloThresholdMs && latencyMs <= sloThresholdMs * 4;
      }).length;

      const apdexScore =
        metrics.table.length > 0
          ? (satisfiedCount + toleratingCount * 0.5) / metrics.table.length
          : 1;

      const sloStatus = apdexScore >= 0.9 ? 'pass' : 'fail';

      // 4) Saturation per instance
      const invocationsPerInstance =
        metrics.table.reduce((sum, entry) => sum + entry.invocationsperinstance, 0) /
        (metrics.table.length || 1);

      // 5) Anomaly detection
      const latencyMean = avgLatency;
      const latencyStdDev = Math.sqrt(
        latencies.reduce((sum, val) => sum + Math.pow(val - latencyMean, 2), 0) /
          (latencies.length || 1)
      );

      const errorRates = metrics.table.map((entry) => {
        const totalEntryErrors =
          entry.invocation4xxerrors + entry.invocation5xxerrors + entry.invocationmodelerrors;
        return entry.invocations > 0 ? totalEntryErrors / entry.invocations : 0;
      });

      const errorRateMean =
        errorRates.reduce((sum, rate) => sum + rate, 0) / (errorRates.length || 1);
      const errorRateStdDev = Math.sqrt(
        errorRates.reduce((sum, val) => sum + Math.pow(val - errorRateMean, 2), 0) /
          (errorRates.length || 1)
      );

      const hasLatencyAnomaly =
        latencyStdDev > 0 &&
        metrics.table.some(
          (entry) => Math.abs((entry.modellatency / 1000 - latencyMean) / latencyStdDev) > 2
        );

      const hasErrorAnomaly =
        errorRateStdDev > 0 &&
        metrics.table.some((entry) => {
          const entryErrorRate =
            entry.invocations > 0
              ? (entry.invocation4xxerrors +
                  entry.invocation5xxerrors +
                  entry.invocationmodelerrors) /
                entry.invocations
              : 0;
          return Math.abs((entryErrorRate - errorRateMean) / errorRateStdDev) > 2;
        });

      const timePoints = metrics.table.map((entry) => {
        const entryLatencyMs = entry.modellatency / 1000;
        const isLatencyAnomaly =
          latencyStdDev > 0 && Math.abs((entryLatencyMs - latencyMean) / latencyStdDev) > 2;

        const entryErrorRate =
          entry.invocations > 0
            ? (entry.invocation4xxerrors +
                entry.invocation5xxerrors +
                entry.invocationmodelerrors) /
              entry.invocations
            : 0;
        const isErrorAnomaly =
          errorRateStdDev > 0 && Math.abs((entryErrorRate - errorRateMean) / errorRateStdDev) > 2;

        return {
          timestamp: entry.timestamp,
          invocations: entry.invocations,
          latency: entryLatencyMs,
          overhead: entry.overheadlatency / 1000,
          errors:
            entry.invocation4xxerrors + entry.invocation5xxerrors + entry.invocationmodelerrors,
          isLatencyAnomaly,
          isErrorAnomaly,
        };
      });

      return {
        deploymentId: metrics.deployment_id,
        endpoint: metrics.endpoint,
        totalInvocations,
        successRate,
        avgLatency,
        p95Latency,
        avgOverhead,
        errorRate,
        e2eLatency,
        modelLatencyPercentage,
        overheadPercentage,
        rps,
        rpm,
        theoreticalRps,
        utilizationPercentage,
        headroomPercentage,
        errors4xx,
        errors5xx,
        errorsModel,
        apdexScore,
        sloStatus,
        invocationsPerInstance,
        hasLatencyAnomaly,
        hasErrorAnomaly,
        timePoints,
      };
    },
    []
  );

  // Main function to process metrics - handles both formats
  const processMetrics = useCallback(
    (metrics: DeploymentMetricsResponse): ProcessedDeploymentMetrics => {
      if (isNewMetricsFormat(metrics)) {
        return processNewMetrics(metrics);
      } else {
        return processLegacyMetrics(metrics);
      }
    },
    [processNewMetrics, processLegacyMetrics]
  );

  return {
    getDeploymentMetrics,
    processMetrics,
  };
}
