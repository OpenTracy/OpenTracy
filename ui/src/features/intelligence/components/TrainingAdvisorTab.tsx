import { useMemo } from 'react';
import {
  GraduationCap,
  DollarSign,
  TrendingUp,
  Settings,
  CalendarClock,
  PiggyBank,
  Download,
} from 'lucide-react';
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Pie, PieChart } from 'recharts';
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
  formatStatus,
  formatPercent,
  formatNumber,
  exportTableToCsv,
} from '../utils/intelligenceHelpers';
import type { IntelligenceData } from '../hooks/useIntelligenceData';
import { MetricCard } from './shared/MetricCard';
import { TrainingSkeleton, EmptyState, ErrorState } from './shared';

interface TrainingAdvisorTabProps {
  data: IntelligenceData;
}

export function TrainingAdvisorTab({ data }: TrainingAdvisorTabProps) {
  const { loading, error, trainingRuns, training, efficiency, refreshData } = data;

  if (loading) return <TrainingSkeleton />;
  if (error) return <ErrorState error={error} onRetry={refreshData} />;
  if (trainingRuns.length === 0 && !training && !efficiency)
    return (
      <EmptyState
        message="No training data available yet. Training runs will appear after the advisor triggers."
        onRefresh={refreshData}
      />
    );

  return <TrainingContent data={data} />;
}

function TrainingContent({ data }: { data: IntelligenceData }) {
  const { trainingRuns, training, efficiency, selectedDays, advisorConfig: advisorCfg } = data;

  const cb = efficiency?.cost_breakdown;
  const distSummary = training?.distillation_summary;

  const costSummary = useMemo(() => {
    const totalInvested = trainingRuns.reduce((s, r) => s + r.cost, 0);
    const avgPerRun = trainingRuns.length > 0 ? totalInvested / trainingRuns.length : 0;
    const projectedRoi = cb ? cb.roi_pct : 0;
    return { totalInvested, avgPerRun, projectedRoi };
  }, [trainingRuns, cb]);

  const promotedCount = useMemo(
    () => trainingRuns.filter((r) => r.outcome === 'promoted').length,
    [trainingRuns]
  );

  // Advisor configuration from API
  const advisorConfig = useMemo(
    () => ({
      threshold: advisorCfg?.threshold ?? 0.75,
      strategy: advisorCfg?.strategy ?? 'Quality-first with cost optimization',
      modelTargets: advisorCfg?.model_targets ?? [],
    }),
    [advisorCfg]
  );

  // Next training trigger estimate from API
  const nextTriggerEstimate = useMemo(() => {
    if (advisorCfg?.next_trigger_estimate) return advisorCfg.next_trigger_estimate;
    return '—';
  }, [advisorCfg]);

  const savingsTrend = useMemo(() => {
    if (!efficiency?.cost_savings_trend?.length) return [];
    return efficiency.cost_savings_trend.map((item) => ({
      date: item.date,
      savings: item.baseline - item.actual,
    }));
  }, [efficiency]);

  const savingsTrendConfig = useMemo<ChartConfig>(
    () => ({ savings: { label: 'Savings', color: 'var(--chart-2)' } }),
    []
  );

  const costBreakdownPieData = useMemo(() => {
    if (!cb) return [];
    return [
      { category: 'cat-0', name: 'Provider', value: cb.routing_actual, fill: 'var(--color-cat-0)' },
      {
        category: 'cat-1',
        name: 'Training',
        value: cb.training_investment,
        fill: 'var(--color-cat-1)',
      },
    ].filter((d) => d.value > 0);
  }, [cb]);

  const costBreakdownConfig = useMemo<ChartConfig>(() => {
    const cfg: ChartConfig = { value: { label: 'Cost' } };
    cfg['cat-0'] = { label: 'Routing', color: 'var(--chart-1)' };
    cfg['cat-1'] = { label: 'Training', color: 'var(--chart-2)' };
    return cfg;
  }, []);

  const handleExportRuns = () => {
    const headers = ['Run ID', 'Date', 'Outcome', 'Confidence', 'Cost', 'Duration', 'Reason'];
    const rows = trainingRuns.map((r) => [
      r.runId,
      formatDateWithYear(r.date),
      formatStatus(r.outcome),
      formatPercent(r.confidence, false),
      formatCost(r.cost),
      r.duration,
      r.reason,
    ]);
    exportTableToCsv(headers, rows, 'training-runs-detail');
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Runs"
          value={formatNumber(trainingRuns.length)}
          icon={GraduationCap}
          tooltip="Total number of training runs executed"
        />
        <MetricCard
          label="Promoted"
          value={formatNumber(promotedCount)}
          icon={TrendingUp}
          tooltip="Number of training runs where the new model was promoted"
        />
        <MetricCard
          label="Total Invested"
          value={formatCost(costSummary.totalInvested)}
          icon={DollarSign}
          tooltip="Total cost spent on all training runs"
        />
        <MetricCard
          label="Avg Cost / Run"
          value={formatCost(costSummary.avgPerRun)}
          icon={DollarSign}
          tooltip="Average cost of each training run"
        />
      </div>

      {cb && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <PiggyBank className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Estimated Savings from Trained Model</CardTitle>
            </div>
            <CardDescription>Savings = Baseline Cost − Actual Cost</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-1 rounded-lg border p-4">
                <p className="text-xs text-muted-foreground">Baseline Cost</p>
                <p className="text-xl font-semibold tabular-nums">
                  {formatCost(cb.provider_baseline)}
                </p>
              </div>
              <div className="space-y-1 rounded-lg border p-4">
                <p className="text-xs text-muted-foreground">Actual Cost</p>
                <p className="text-xl font-semibold tabular-nums">
                  {formatCost(cb.routing_actual)}
                </p>
              </div>
              <div className="space-y-1 rounded-lg border p-4">
                <p className="text-xs text-muted-foreground">Net Savings</p>
                <p className="text-xl font-semibold tabular-nums">{formatCost(cb.net_savings)}</p>
              </div>
              <div className="space-y-1 rounded-lg border p-4">
                <p className="text-xs text-muted-foreground">ROI</p>
                <p className="text-xl font-semibold tabular-nums">{cb.roi_pct.toFixed(0)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Full Training Run History</CardTitle>
          <CardDescription>All training runs with detailed metrics</CardDescription>
          <CardAction>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5"
                  onClick={handleExportRuns}
                >
                  <Download className="size-3" />
                  CSV
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export training runs as CSV</TooltipContent>
            </Tooltip>
          </CardAction>
        </CardHeader>
        <CardContent className="px-6">
          {trainingRuns.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead className="text-right">Confidence</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trainingRuns.map((run) => (
                  <TableRow key={run.runId}>
                    <TableCell className="font-mono text-xs">{run.runId}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateWithYear(run.date)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={run.outcome === 'promoted' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {formatStatus(run.outcome)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPercent(run.confidence, false)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCost(run.cost)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{run.duration}</TableCell>
                    <TableCell className="max-w-48 truncate text-sm text-muted-foreground">
                      {run.reason}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No training runs recorded yet
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Savings Trend</CardTitle>
            <CardDescription>Daily cost savings over time &middot; {selectedDays}d</CardDescription>
          </CardHeader>
          <CardContent>
            {savingsTrend.length > 0 ? (
              <ChartContainer config={savingsTrendConfig} className="h-64 w-full">
                <AreaChart data={savingsTrend}>
                  <defs>
                    <linearGradient id="fillSavingsTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: string) => {
                      const d = new Date(v);
                      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={45}
                    tickFormatter={(v: number) => `$${Number(v).toFixed(2)}`}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent formatter={(v: number) => formatCost(Number(v))} />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="savings"
                    fill="url(#fillSavingsTrend)"
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <ChartEmpty icon={TrendingUp} message="No savings data yet" />
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="items-center pb-0">
            <CardTitle className="text-base">Training vs Routing Cost</CardTitle>
            <CardDescription>Cost distribution breakdown</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            {costBreakdownPieData.length > 0 ? (
              <ChartContainer
                config={costBreakdownConfig}
                className="mx-auto aspect-square max-h-64"
              >
                <PieChart>
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        formatter={(value: number) => [formatCost(Number(value)), '']}
                      />
                    }
                  />
                  <Pie
                    data={costBreakdownPieData}
                    dataKey="value"
                    nameKey="category"
                    innerRadius={50}
                    strokeWidth={2}
                  />
                  <ChartLegend
                    content={<ChartLegendContent nameKey="category" />}
                    className="-translate-y-2 flex-wrap gap-2 *:basis-1/3 *:justify-center"
                  />
                </PieChart>
              </ChartContainer>
            ) : (
              <ChartEmpty icon={DollarSign} message="No cost data available" />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Advisor Configuration</CardTitle>
            </div>
            <CardDescription>Current training advisor settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Quality Threshold</span>
                <span className="font-medium tabular-nums">
                  {formatPercent(advisorConfig.threshold, false)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Strategy</span>
                <span className="text-sm font-medium">{advisorConfig.strategy}</span>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Target Models</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {advisorConfig.modelTargets.map((m) => (
                    <Badge key={m} variant="outline" className="text-xs">
                      {m}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CalendarClock className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Next Training Trigger</CardTitle>
            </div>
            <CardDescription>Estimated based on data accumulation rate</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Estimated Date</p>
                <p className="text-2xl font-semibold">{nextTriggerEstimate}</p>
              </div>
              {advisorCfg && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Traces Since Last Training
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatNumber(advisorCfg.traces_since_last_training)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Data Accumulation</span>
                    <span className="font-medium tabular-nums">
                      {formatNumber(advisorCfg.data_accumulation_rate)}/day
                    </span>
                  </div>
                </div>
              )}
              {distSummary && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Jobs Run</span>
                    <span className="font-medium tabular-nums">{distSummary.total_jobs}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Completed</span>
                    <span className="font-medium tabular-nums">{distSummary.completed_jobs}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Training Cost</span>
                    <span className="font-medium tabular-nums">
                      {formatCost(distSummary.total_training_cost)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ChartEmpty({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex h-56 flex-col items-center justify-center gap-3">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
