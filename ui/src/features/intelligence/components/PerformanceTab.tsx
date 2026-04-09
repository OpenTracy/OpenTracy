import { useMemo } from 'react';
import {
  Activity,
  AlertCircle,
  Clock,
  Brain,
  Zap,
  BarChart3,
  TrendingUp,
  GraduationCap,
  DollarSign,
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
} from 'recharts';
import {
  Card,
  CardAction,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
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
  exportTableToCsv,
} from '../utils/intelligenceHelpers';
import type { IntelligenceData } from '../hooks/useIntelligenceData';
import { MetricCard } from './shared/MetricCard';
import { PerformanceSkeleton, EmptyState, ErrorState } from './shared';
import { ModelPerformanceContent } from './ModelPerformanceSection';

interface PerformanceTabProps {
  data: IntelligenceData;
}

export function PerformanceTab({ data }: PerformanceTabProps) {
  const { loading, error, training, models, performanceData, refreshData } = data;

  if (loading) return <PerformanceSkeleton />;
  if (error) return <ErrorState error={error} onRetry={refreshData} />;
  if (!training && !models && !performanceData)
    return <EmptyState message="No performance data available yet." onRefresh={refreshData} />;

  return <PerformanceContent data={data} />;
}

function PerformanceContent({ data }: { data: IntelligenceData }) {
  const { training, models, costData, performanceData, overviewData, trainingRuns, selectedDays } =
    data;

  const kpis = training?.kpis as Record<string, unknown> | undefined;
  const advisorStatus = kpis?.advisor_status as
    | { recommendation: string; confidence: number }
    | undefined;

  const distSummary = training?.distillation_summary;

  const avgDailyCost = useMemo(() => {
    const externalCosts = costData?.externalCosts || [];
    const totalCost = externalCosts.reduce((sum, item) => sum + item.cost, 0);
    return totalCost / selectedDays;
  }, [costData, selectedDays]);

  const advisorLabel = useMemo((): string => {
    const rec = advisorStatus?.recommendation;
    if (!rec) return 'Waiting for data';
    return formatStatus(rec);
  }, [advisorStatus]);

  const signalChartData = useMemo(() => {
    if (!training?.signal_trends?.length) return [];
    const signalMap = new Map<string, Record<string, number | string>>();
    for (const s of training.signal_trends) {
      const dateKey = s.date.split('T')[0];
      if (!signalMap.has(dateKey)) signalMap.set(dateKey, { date: dateKey });
      const entry = signalMap.get(dateKey)!;
      entry[s.signal] = s.value;
    }
    return Array.from(signalMap.values());
  }, [training]);

  const signalConfig = useMemo<ChartConfig>(
    () => ({
      error_rate_increase: { label: 'Error Rate', color: 'var(--chart-1)' },
      drift_ratio: { label: 'Drift Ratio', color: 'var(--chart-3)' },
      high_severity_issues: { label: 'Issues', color: 'var(--chart-2)' },
    }),
    []
  );

  const latencyP95 = overviewData?.kpis?.find((k) => k.icon === 'trending')?.value ?? '—';
  const errorRate = overviewData?.kpis?.find((k) => k.icon === 'alert')?.value ?? '—';
  const totalRequests = overviewData?.kpis?.find((k) => k.icon === 'activity')?.value ?? '0';

  const latencyHistogram = performanceData?.latencyHistogram ?? [];
  const latencyConfig = useMemo<ChartConfig>(
    () => ({ count: { label: 'Requests', color: 'var(--chart-2)' } }),
    []
  );

  const errorData = performanceData?.errors ?? [];
  const errorConfig = useMemo<ChartConfig>(
    () => ({ errors: { label: 'Errors', color: 'var(--chart-1)' } }),
    []
  );

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
    exportTableToCsv(headers, rows, 'training-runs');
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          label="Latency P95"
          value={latencyP95}
          icon={Clock}
          tooltip="95th percentile response time across all requests"
        />
        <MetricCard
          label="Error Rate"
          value={errorRate}
          icon={AlertCircle}
          tooltip="Percentage of requests that resulted in an error"
        />
        <MetricCard
          label="Total Requests"
          value={totalRequests}
          icon={Activity}
          tooltip="Total requests processed in this period"
        />
        <MetricCard
          label="Avg Daily Cost"
          value={formatCost(avgDailyCost)}
          icon={Zap}
          tooltip="Average daily cost across all external API calls"
        />
        <MetricCard
          label="Training Runs"
          value={String(kpis?.training_runs ?? 0)}
          icon={GraduationCap}
          tooltip="Total number of model training runs executed"
        />
        <MetricCard
          label="Advisor Status"
          value={advisorLabel}
          icon={Brain}
          tooltip="Current recommendation from the training advisor"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Latency Distribution</CardTitle>
            <CardDescription>Request count by response time bucket</CardDescription>
          </CardHeader>
          <CardContent>
            {latencyHistogram.length > 0 ? (
              <ChartContainer config={latencyConfig} className="h-64 w-full">
                <BarChart data={latencyHistogram}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis
                    dataKey="bucket"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <ChartEmpty icon={Clock} message="No latency data yet" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Errors Over Time</CardTitle>
            <CardDescription>Error occurrences by type &middot; {selectedDays}d</CardDescription>
          </CardHeader>
          <CardContent>
            {errorData.length > 0 ? (
              <ChartContainer config={errorConfig} className="h-64 w-full">
                <BarChart data={errorData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={35} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="errors" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <ChartEmpty icon={AlertCircle} message="No error data yet" />
            )}
          </CardContent>
        </Card>
      </div>

      {distSummary && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <GraduationCap className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Distillation Overview</CardTitle>
            </div>
            <CardDescription>Model training pipeline status and costs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatBlock icon={CheckCircle2} label="Completed" value={distSummary.completed_jobs} />
              {distSummary.running_jobs > 0 && (
                <StatBlock
                  icon={Loader2}
                  label="Running"
                  value={distSummary.running_jobs}
                  iconClassName="animate-spin"
                />
              )}
              {distSummary.failed_jobs > 0 && (
                <StatBlock icon={XCircle} label="Failed" value={distSummary.failed_jobs} />
              )}
              <StatBlock
                icon={DollarSign}
                label="Total Training Cost"
                value={formatCost(distSummary.total_training_cost)}
              />
            </div>

            {distSummary.latest_completed_job && (
              <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg border px-4 py-3">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Latest Distillation
                </span>
                <span className="text-sm font-semibold">
                  {distSummary.latest_completed_job.name}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Teacher:</span>
                  <Badge variant="outline" className="text-xs">
                    {distSummary.latest_completed_job.teacher_model || '—'}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Student:</span>
                  <Badge variant="secondary" className="text-xs">
                    {distSummary.latest_completed_job.student_model || '—'}
                  </Badge>
                </div>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {formatCost(distSummary.latest_completed_job.cost)} cost
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {trainingRuns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Training Runs History</CardTitle>
            <CardDescription>
              Detailed history of all training runs &middot; {selectedDays}d
            </CardDescription>
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
                {trainingRuns.slice(0, 10).map((run) => (
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
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Training History</CardTitle>
            <CardDescription>Run outcomes over time</CardDescription>
            <CardAction>
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1">
                  <span className="inline-block size-2.5 rounded-full bg-chart-2" />
                  Promoted
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block size-2.5 rounded-full bg-chart-1" />
                  Rejected
                </span>
              </div>
            </CardAction>
          </CardHeader>
          <CardContent>
            {training?.training_history && training.training_history.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={training.training_history.map((h, i) => ({
                    ...h,
                    idx: i + 1,
                    value: 1,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis
                    dataKey="idx"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    label={{
                      value: 'Run #',
                      position: 'insideBottom',
                      offset: -5,
                      style: { fontSize: 11, fill: 'var(--color-muted-foreground)' },
                    }}
                  />
                  <YAxis hide />
                  <ChartTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload as {
                        promoted: boolean;
                        reason: string;
                        date: string;
                      };
                      return (
                        <div className="rounded-md border bg-popover px-3 py-2 text-sm">
                          <p className="font-medium">{d.promoted ? 'Promoted' : 'Rejected'}</p>
                          <p className="text-muted-foreground">{d.reason}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDateWithYear(d.date)}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {training.training_history.map((h, i) => (
                      <Cell key={i} fill={h.promoted ? 'var(--chart-2)' : 'var(--chart-1)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty icon={BarChart3} message="No training runs yet" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Signal Trends</CardTitle>
            <CardDescription>Drift and issue signals by type over time</CardDescription>
          </CardHeader>
          <CardContent>
            {signalChartData.length > 0 ? (
              <ChartContainer config={signalConfig} className="h-62.5 w-full">
                <LineChart data={signalChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={35} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line
                    type="monotone"
                    dataKey="error_rate_increase"
                    stroke="var(--chart-1)"
                    strokeWidth={1.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="drift_ratio"
                    stroke="var(--chart-3)"
                    strokeWidth={1.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="high_severity_issues"
                    stroke="var(--chart-2)"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ChartContainer>
            ) : (
              <ChartEmpty icon={TrendingUp} message="No signal data yet" />
            )}
          </CardContent>
        </Card>
      </div>

      {models && <ModelPerformanceContent data={models} />}
    </div>
  );
}

function StatBlock({
  icon: Icon,
  label,
  value,
  iconClassName,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  iconClassName?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
      <Icon className={`size-4 shrink-0 text-muted-foreground ${iconClassName ?? ''}`} />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-base font-semibold tabular-nums">{String(value)}</p>
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
