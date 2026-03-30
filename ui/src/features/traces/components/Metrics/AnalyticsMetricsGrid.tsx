import { Activity, BarChart2, Clock, DollarSign, Cpu, Zap, AlertCircle } from 'lucide-react';
import { KpiCard } from '@/components/shared/KpiCard';
import { formatLatency, formatCost } from '@/utils/formatUtils';
import type { AnalyticsMetrics } from '@/types/analyticsType';

interface AnalyticsMetricsGridProps {
  metrics: AnalyticsMetrics | null;
}

export function AnalyticsMetricsGrid({ metrics }: AnalyticsMetricsGridProps) {
  if (!metrics) return null;

  const metricsConfig = [
    {
      label: 'Total Requests',
      value: metrics.totals?.request_count?.toLocaleString() || '0',
      icon: Activity,
    },
    {
      label: 'Success Rate',
      value: metrics.totals?.success_rate
        ? `${(metrics.totals.success_rate * 100).toFixed(1)}%`
        : '0%',
      icon: BarChart2,
    },
    {
      label: 'Avg Latency',
      value: metrics.totals?.avg_latency_s ? formatLatency(metrics.totals.avg_latency_s) : '0ms',
      icon: Clock,
    },
    {
      label: 'Total Cost',
      value: metrics.totals?.total_cost_usd ? formatCost(metrics.totals.total_cost_usd) : '$0.00',
      icon: DollarSign,
    },
    {
      label: 'Input Tokens',
      value: metrics.totals?.total_input_tokens?.toLocaleString() || '0',
      icon: Cpu,
    },
    {
      label: 'Output Tokens',
      value: metrics.totals?.total_output_tokens?.toLocaleString() || '0',
      icon: Zap,
    },
    {
      label: 'P95 Latency',
      value: metrics.totals?.p95_latency_s ? formatLatency(metrics.totals.p95_latency_s) : '0ms',
      icon: AlertCircle,
    },
    {
      label: 'Cost / 1k Tokens',
      value: metrics.totals?.avg_cost_per_1k_tokens_usd
        ? `$${metrics.totals.avg_cost_per_1k_tokens_usd.toFixed(4)}`
        : '$0.0000',
      icon: DollarSign,
    },
  ];

  return (
    <div className="px-4 sm:px-6 py-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        {metricsConfig.map((metric) => (
          <KpiCard key={metric.label} {...metric} />
        ))}
      </div>
    </div>
  );
}
