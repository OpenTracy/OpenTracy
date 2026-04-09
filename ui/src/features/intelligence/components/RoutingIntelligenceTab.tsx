import { useMemo } from 'react';
import { Route, Target, Download, DollarSign, Clock } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCost } from '@/utils/formatUtils';
import {
  formatDateWithYear,
  formatNumber,
  formatPercent,
  exportTableToCsv,
} from '../utils/intelligenceHelpers';
import type { IntelligenceData } from '../hooks/useIntelligenceData';
import { MetricCard } from './shared/MetricCard';
import { RoutingSkeleton, EmptyState, ErrorState } from './shared';

const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)'];

interface RoutingIntelligenceTabProps {
  data: IntelligenceData;
}

export function RoutingIntelligenceTab({ data }: RoutingIntelligenceTabProps) {
  const { loading, error, routingDecisions, refreshData } = data;

  if (loading) return <RoutingSkeleton />;
  if (error) return <ErrorState error={error} onRetry={refreshData} />;
  if (routingDecisions.length === 0)
    return (
      <EmptyState
        message="No routing decisions recorded yet. Decisions will appear after routing begins."
        onRefresh={refreshData}
      />
    );

  return <RoutingContent data={data} />;
}

function RoutingContent({ data }: { data: IntelligenceData }) {
  const { routingDecisions, efficiency, models, routingIntelligence, selectedDays } = data;

  const cb = efficiency?.cost_breakdown;

  const successRate = useMemo(() => {
    if (routingDecisions.length === 0) return 0;
    const successes = routingDecisions.filter((d) => d.outcome === 'success').length;
    return successes / routingDecisions.length;
  }, [routingDecisions]);

  const avgLatency = useMemo(() => {
    if (routingDecisions.length === 0) return 0;
    return routingDecisions.reduce((s, d) => s + d.latency, 0) / routingDecisions.length;
  }, [routingDecisions]);

  const avgCost = useMemo(() => {
    if (routingDecisions.length === 0) return 0;
    return routingDecisions.reduce((s, d) => s + d.cost, 0) / routingDecisions.length;
  }, [routingDecisions]);

  // Real win rate from /v1/intelligence/routing
  const winRateData = routingIntelligence?.win_rate ?? [];

  const winRateConfig = useMemo<ChartConfig>(
    () => ({
      router: { label: 'Router', color: 'var(--chart-1)' },
      baseline: { label: 'Baseline', color: 'var(--chart-3)' },
    }),
    []
  );

  // Real confidence distribution from /v1/intelligence/routing
  const confidenceData = routingIntelligence?.confidence_distribution ?? [];
  const confidenceConfig = useMemo<ChartConfig>(
    () => ({ count: { label: 'Decisions', color: 'var(--chart-2)' } }),
    []
  );

  const clusterModelMatrix = useMemo(() => {
    if (!models?.cluster_accuracy?.length) return [];
    const clusterIds = Object.keys(models.cluster_accuracy[0].clusters).sort(
      (a, b) => Number(a) - Number(b)
    );
    return clusterIds.map((cid) => {
      const row: Record<string, unknown> = { cluster: `C${cid}` };
      for (const m of models.cluster_accuracy) {
        row[m.model] = m.clusters[cid] ?? 0;
      }
      return row;
    });
  }, [models]);

  const clusterModelNames = useMemo(
    () => models?.cluster_accuracy?.map((m) => m.model) ?? [],
    [models]
  );

  const clusterConfig = useMemo<ChartConfig>(() => {
    const cfg: ChartConfig = {};
    clusterModelNames.forEach((name, i) => {
      cfg[name] = { label: name, color: CHART_COLORS[i % CHART_COLORS.length] };
    });
    return cfg;
  }, [clusterModelNames]);

  const handleExportDecisions = () => {
    const headers = [
      'Request ID',
      'Cluster',
      'Model',
      'Reason',
      'Cost',
      'Latency',
      'Outcome',
      'Date',
    ];
    const rows = routingDecisions.map((d) => [
      d.requestId,
      `C${d.cluster}`,
      d.modelChosen,
      d.reason,
      formatCost(d.cost),
      `${d.latency.toFixed(0)}ms`,
      d.outcome,
      formatDateWithYear(d.timestamp),
    ]);
    exportTableToCsv(headers, rows, 'routing-decisions');
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Routing Decisions"
          value={formatNumber(routingDecisions.length)}
          icon={Route}
          tooltip="Total routing decisions made by the router in this period"
        />
        <MetricCard
          label="Success Rate"
          value={formatPercent(successRate)}
          icon={Target}
          tooltip="Percentage of routing decisions that resulted in a successful response"
        />
        <MetricCard
          label="Avg Latency"
          value={`${avgLatency.toFixed(0)}ms`}
          icon={Clock}
          tooltip="Average end-to-end latency for routed requests"
        />
        <MetricCard
          label="Avg Cost / Decision"
          value={formatCost(avgCost)}
          icon={DollarSign}
          tooltip="Average cost per routing decision"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Router Decision Log</CardTitle>
          <CardDescription>
            Recent routing decisions with outcomes &middot; {selectedDays}d
          </CardDescription>
          <CardAction>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5"
                    onClick={handleExportDecisions}
                  >
                    <Download className="size-3" />
                    CSV
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export decisions as CSV</TooltipContent>
              </Tooltip>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request ID</TableHead>
                <TableHead>Cluster</TableHead>
                <TableHead>Model Chosen</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Latency</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routingDecisions.slice(0, 15).map((d) => (
                <TableRow key={d.requestId}>
                  <TableCell className="font-mono text-xs">{d.requestId}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      C{d.cluster}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{d.modelChosen}</TableCell>
                  <TableCell className="max-w-40 truncate text-sm text-muted-foreground">
                    {d.reason}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCost(d.cost)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {d.latency.toFixed(0)}ms
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={d.outcome === 'success' ? 'default' : 'destructive'}
                      className="text-xs"
                    >
                      {d.outcome === 'success' ? 'Success' : 'Error'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateWithYear(d.timestamp)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Routing Win Rate Over Time</CardTitle>
            <CardDescription>Router accuracy vs baseline &middot; {selectedDays}d</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={winRateConfig} className="h-64 w-full">
              <LineChart data={winRateData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => {
                    const d = new Date(v);
                    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  }}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  tickFormatter={(v) => formatPercent(Number(v))}
                  domain={[0, 1]}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent formatter={(v: number) => formatPercent(Number(v))} />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Line
                  type="monotone"
                  dataKey="router"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="baseline"
                  stroke="var(--chart-3)"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Routing Confidence Distribution</CardTitle>
            <CardDescription>Distribution of confidence scores across decisions</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={confidenceConfig} className="h-64 w-full">
              <BarChart data={confidenceData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                <XAxis dataKey="bucket" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={35} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {clusterModelMatrix.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cluster-Model Routing Map</CardTitle>
            <CardDescription>Which models serve which clusters most effectively</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={clusterConfig} className="h-72 w-full">
              <BarChart data={clusterModelMatrix}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                <XAxis
                  dataKey="cluster"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatPercent(Number(v))}
                  domain={[0, 1]}
                  width={40}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent formatter={(v: number) => formatPercent(Number(v))} />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                {clusterModelNames.map((name, i) => (
                  <Bar
                    key={name}
                    dataKey={name}
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {cb && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Baseline Model Comparison</CardTitle>
            <CardDescription>Router actual cost vs always-cheapest vs always-best</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1 rounded-lg border p-4">
                <p className="text-xs text-muted-foreground">Router (Actual)</p>
                <p className="text-xl font-semibold tabular-nums">
                  {formatCost(cb.routing_actual)}
                </p>
                <p className="text-xs text-muted-foreground">Smart routing with trained model</p>
              </div>
              <div className="space-y-1 rounded-lg border p-4">
                <p className="text-xs text-muted-foreground">Always Best Model</p>
                <p className="text-xl font-semibold tabular-nums">
                  {formatCost(cb.provider_baseline)}
                </p>
                <p className="text-xs text-muted-foreground">Most accurate, most expensive</p>
              </div>
              <div className="space-y-1 rounded-lg border p-4">
                <p className="text-xs text-muted-foreground">Savings</p>
                <p className="text-xl font-semibold tabular-nums">
                  {formatCost(cb.routing_savings)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {cb.provider_baseline > 0
                    ? formatPercent(cb.routing_savings / cb.provider_baseline)
                    : '0.0%'}{' '}
                  reduction
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
