import { useState, useMemo, useEffect, useCallback } from 'react';
import { Activity, Gauge, Cpu, HardDrive, Clock } from 'lucide-react';
import { Area, AreaChart, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import { useAnalyticsMetricsService } from '@/services/analyticsMetricsService';
import type { DeploymentMetricsData, TimeSeriesPoint, EKSTimeSeriesPoint } from '../../types';

type ChartType = 'invocations' | 'cpu' | 'memory' | 'latency' | 'ttft';

interface DeploymentChartsSectionProps {
  metricsData: DeploymentMetricsData;
  timeRangeMinutes?: number;
  deploymentId?: string;
}

interface ChartPoint {
  time: string;
  value: number;
  fullTime: string;
}

const chartConfig: ChartConfig = {
  value: { label: 'Value', color: 'var(--color-chart-1)' },
};

export function DeploymentChartsSection({
  metricsData,
  timeRangeMinutes = 1440,
  deploymentId,
}: DeploymentChartsSectionProps) {
  const tenantId = 'default';
  const { getAnalyticsMetrics } = useAnalyticsMetricsService();
  const [invocationsData, setInvocationsData] = useState<ChartPoint[]>([]);
  const [loadingInvocations, setLoadingInvocations] = useState(false);

  const formatTimestamp = useCallback((ts: string, isLast: boolean) => {
    const d = new Date(ts);
    if (isLast) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `${d.getHours().toString().padStart(2, '0')}h`;
  }, []);

  const filterByTimeRange = useCallback(
    (data: (TimeSeriesPoint | EKSTimeSeriesPoint)[]) => {
      if (!data?.length) return [];
      const cutoff = new Date(Date.now() - timeRangeMinutes * 60 * 1000);
      return data.filter((p) => {
        const t = 'timestamp' in p ? p.timestamp : p.time;
        return new Date(t) >= cutoff;
      });
    },
    [timeRangeMinutes]
  );

  const formatChartData = useCallback(
    (data: (TimeSeriesPoint | EKSTimeSeriesPoint)[]): ChartPoint[] => {
      if (!data?.length) return [];
      const seen = new Set<string>();
      const sampled: typeof data = [];
      for (let i = 0; i < data.length; i++) {
        const p = data[i];
        const t = 'timestamp' in p ? p.timestamp : p.time;
        const d = new Date(t);
        const hk = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
        if (i === data.length - 1 || !seen.has(hk)) {
          seen.add(hk);
          sampled.push(p);
        }
      }
      return sampled.map((p, i) => {
        const t = 'timestamp' in p ? p.timestamp : p.time;
        return { time: formatTimestamp(t, i === sampled.length - 1), value: p.value, fullTime: t };
      });
    },
    [formatTimestamp]
  );

  /* Fetch invocations from analytics API */
  const fetchInvocationsData = useCallback(async () => {
    if (!tenantId) return;
    setLoadingInvocations(true);
    try {
      const days = Math.max(1, Math.ceil(timeRangeMinutes / 1440));
      const response = await getAnalyticsMetrics('', tenantId, days, { trace_limit: 1000 });

      const raw = response.raw_sample || [];
      const filtered = raw.filter((s) => {
        if (s.backend !== 'opentracy') return false;
        return deploymentId ? s.deployment_id === deploymentId : true;
      });

      const cutoff = new Date(Date.now() - timeRangeMinutes * 60 * 1000);
      const hourly = new Map<string, number>();
      filtered.forEach((s) => {
        const d = new Date(s.created_at);
        if (d >= cutoff) {
          const k = new Date(
            d.getFullYear(),
            d.getMonth(),
            d.getDate(),
            d.getHours()
          ).toISOString();
          hourly.set(k, (hourly.get(k) || 0) + 1);
        }
      });

      setInvocationsData(
        Array.from(hourly.entries())
          .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
          .map(([t, c], i, arr) => ({
            time: formatTimestamp(t, i === arr.length - 1),
            value: c,
            fullTime: t,
          }))
      );
    } catch {
      setInvocationsData([]);
    } finally {
      setLoadingInvocations(false);
    }
  }, [tenantId, deploymentId, timeRangeMinutes, getAnalyticsMetrics, formatTimestamp]);

  useEffect(() => {
    fetchInvocationsData();
  }, [fetchInvocationsData]);

  /* Available chart tabs */
  const availableTabs = useMemo(() => {
    const ts = metricsData?.time_series;
    const tabs: { key: ChartType; label: string; icon: typeof Activity }[] = [];

    if (invocationsData.length > 0 || loadingInvocations)
      tabs.push({ key: 'invocations', label: 'Requests', icon: Activity });
    if (filterByTimeRange(ts?.cpu_utilization || []).length > 0)
      tabs.push({ key: 'cpu', label: 'CPU', icon: Cpu });
    if (filterByTimeRange(ts?.memory_utilization || []).length > 0)
      tabs.push({ key: 'memory', label: 'Memory', icon: HardDrive });
    if (filterByTimeRange(ts?.avg_ttft || []).length > 0)
      tabs.push({ key: 'ttft', label: 'TTFT', icon: Clock });
    if (filterByTimeRange(ts?.model_latency || []).length > 0)
      tabs.push({ key: 'latency', label: 'Latency', icon: Gauge });

    return tabs;
  }, [metricsData, invocationsData, loadingInvocations, filterByTimeRange]);

  const [activeChart, setActiveChart] = useState<ChartType | null>(null);

  useEffect(() => {
    if (
      availableTabs.length > 0 &&
      (!activeChart || !availableTabs.find((t) => t.key === activeChart))
    ) {
      setActiveChart(availableTabs[0].key);
    }
  }, [availableTabs, activeChart]);

  const {
    data: chartData,
    label: chartLabel,
    unit,
    loading,
  } = useMemo(() => {
    const ts = metricsData?.time_series;
    switch (activeChart) {
      case 'invocations':
        return { data: invocationsData, label: 'Requests', unit: '', loading: loadingInvocations };
      case 'cpu':
        return {
          data: formatChartData(filterByTimeRange(ts?.cpu_utilization || [])),
          label: 'CPU Utilization',
          unit: '%',
          loading: false,
        };
      case 'memory':
        return {
          data: formatChartData(filterByTimeRange(ts?.memory_utilization || [])),
          label: 'Memory Utilization',
          unit: '%',
          loading: false,
        };
      case 'latency':
        return {
          data: formatChartData(filterByTimeRange(ts?.model_latency || [])),
          label: 'Model Latency',
          unit: 'ms',
          loading: false,
        };
      case 'ttft':
        return {
          data: formatChartData(filterByTimeRange(ts?.avg_ttft || [])),
          label: 'Time to First Token',
          unit: 'ms',
          loading: false,
        };
      default:
        return { data: [] as ChartPoint[], label: 'No Data', unit: '', loading: false };
    }
  }, [
    activeChart,
    metricsData,
    invocationsData,
    loadingInvocations,
    formatChartData,
    filterByTimeRange,
  ]);

  if (availableTabs.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{chartLabel} Over Time</CardTitle>
        </div>
        <div className="flex gap-0.5 rounded-lg border bg-muted/50 p-0.5 w-fit">
          {availableTabs.map((tab) => (
            <Button
              key={tab.key}
              variant={activeChart === tab.key ? 'default' : 'ghost'}
              size="sm"
              className={`h-7 gap-1.5 text-xs font-medium transition-all ${
                activeChart === tab.key
                  ? 'shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveChart(tab.key)}
            >
              <tab.icon className="size-3" />
              {tab.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="size-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
              <p className="text-xs text-muted-foreground">Loading metrics...</p>
            </div>
          </div>
        ) : chartData.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-64 w-full">
            <AreaChart data={chartData} accessibilityLayer>
              <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted/50" />
              <XAxis dataKey="time" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis
                tickLine={false}
                axisLine={false}
                fontSize={11}
                tickFormatter={(v: number) => (unit ? `${v}${unit}` : String(v))}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value: any) => [`${value}${unit ? ` ${unit}` : ''}`, chartLabel]}
                  />
                }
              />
              <defs>
                <linearGradient id="deployChartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <Area
                dataKey="value"
                type="monotone"
                fill="url(#deployChartGrad)"
                stroke="var(--color-chart-1)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed">
            <Activity className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No data available for this metric</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
