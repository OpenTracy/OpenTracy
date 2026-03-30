import { Activity, CheckCircle, XCircle, Timer, Coins, DollarSign } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { DeploymentMetricsData } from '../../types';

interface MetricsGridProps {
  metricsData: DeploymentMetricsData;
  formatNumber: (n: number) => string;
  formatLatency: (n: number) => string;
  formatCost: (n: number) => string;
}

interface MetricTileProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: string;
}

function MetricTile({ icon: Icon, label, value, accent }: MetricTileProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-lg',
          accent || 'bg-muted'
        )}
      >
        <Icon className={cn('size-4', accent ? 'text-inherit' : 'text-muted-foreground')} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

export function DeploymentMetricsGrid({
  metricsData,
  formatNumber,
  formatLatency,
  formatCost,
}: MetricsGridProps) {
  const stats = metricsData.inference_stats;

  return (
    <Card className="overflow-hidden">
      <CardContent className="grid grid-cols-2 gap-3 pt-5 md:grid-cols-3 lg:grid-cols-6">
        <MetricTile
          icon={Activity}
          label="Total Inferences"
          value={formatNumber(stats?.total_inferences ?? 0)}
          accent="bg-chart-1/10 text-chart-1"
        />
        <MetricTile
          icon={CheckCircle}
          label="Successful"
          value={formatNumber(stats?.successful ?? 0)}
          accent="bg-chart-2/10 text-chart-2"
        />
        <MetricTile
          icon={XCircle}
          label="Failed"
          value={formatNumber(stats?.failed ?? 0)}
          accent={(stats?.failed ?? 0) > 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted'}
        />
        <MetricTile
          icon={Timer}
          label="Avg Latency"
          value={formatLatency(stats?.avg_latency_ms ?? 0)}
          accent="bg-chart-4/10 text-chart-4"
        />
        <MetricTile
          icon={Coins}
          label="Total Tokens"
          value={formatNumber(stats?.total_tokens ?? 0)}
          accent="bg-chart-3/10 text-chart-3"
        />
        <MetricTile
          icon={DollarSign}
          label="Total Cost"
          value={formatCost(stats?.total_cost_usd ?? 0)}
          accent="bg-chart-5/10 text-chart-5"
        />
      </CardContent>
    </Card>
  );
}
