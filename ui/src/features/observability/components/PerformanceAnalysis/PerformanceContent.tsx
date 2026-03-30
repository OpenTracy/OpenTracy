import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  Gauge,
  AlertTriangle,
  AlertCircle,
  ArrowUpRight,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  XAxis,
  YAxis,
} from 'recharts';

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';

import { formatLatencyMs } from '@/utils/formatUtils';
import type { PerformanceData } from '../../types';
import { KpiCard } from '@/components/shared/KpiCard';
import { TimeRangeSelector } from '../shared/TimeRangeSelector';
import type { TimeRange } from '../../constants';

interface PerformanceContentProps {
  data: PerformanceData;
  selectedDays: number;
  onTimeRangeChange: (days: TimeRange) => void;
}

const histogramConfig: ChartConfig = {
  count: { label: 'Requests', color: 'var(--chart-1)' },
};

const errorChartConfig: ChartConfig = {
  errors: { label: 'Errors', color: 'var(--chart-5)' },
};

export function PerformanceContent({
  data,
  selectedDays,
  onTimeRangeChange,
}: PerformanceContentProps) {
  const navigate = useNavigate();
  const [insightsOpen, setInsightsOpen] = useState(true);

  const kpis = useMemo(() => {
    const latencies = data.latencyBy.map((l) => l.value);
    const avgLatency = latencies.length
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;
    const totalErrors = data.errors.reduce((sum, e) => sum + e.errors, 0);
    const totalRequests = data.latencyHistogram.reduce((sum, h) => sum + h.count, 0);
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
    return { avgLatency, totalErrors, errorRate, totalRequests };
  }, [data]);

  const latencyBarData = useMemo(
    () =>
      data.latencyBy.slice(0, 6).map((item) => ({
        model: item.key,
        value: item.value,
      })),
    [data.latencyBy]
  );

  const latencyBarConfig = useMemo<ChartConfig>(() => {
    const cfg: ChartConfig = {
      value: { label: 'Latency', color: 'var(--chart-2)' },
      label: { label: 'Label', color: 'var(--background)' },
    };

    data.latencyBy.slice(0, 6).forEach((item, i) => {
      cfg[`model-${i}`] = {
        label: item.key,
        color: 'var(--chart-2)',
      };
    });

    return cfg;
  }, [data.latencyBy]);

  const histogramData = useMemo(
    () => data.latencyHistogram.map((item) => ({ name: item.bucket, count: item.count })),
    [data.latencyHistogram]
  );

  const maxHistogramCount = useMemo(
    () => Math.max(...histogramData.map((item) => item.count), 1),
    [histogramData]
  );

  const errorStatus = useMemo(() => {
    if (kpis.errorRate > 5)
      return { label: 'Critical', variant: 'destructive' as const, icon: XCircle };
    if (kpis.errorRate > 1)
      return { label: 'Warning', variant: 'outline' as const, icon: AlertTriangle };
    return { label: 'Healthy', variant: 'secondary' as const, icon: CheckCircle2 };
  }, [kpis.errorRate]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <TimeRangeSelector value={selectedDays} onChange={onTimeRangeChange} />
        <Badge variant={errorStatus.variant} className="hidden gap-1.5 md:flex">
          <errorStatus.icon className="size-3" />
          {errorStatus.label}
        </Badge>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Avg Latency (P95)" value={formatLatencyMs(kpis.avgLatency)} icon={Clock} />
        <KpiCard label="Total Requests" value={kpis.totalRequests.toLocaleString()} icon={Gauge} />
        <KpiCard
          label="Total Errors"
          value={kpis.totalErrors.toString()}
          icon={AlertTriangle}
          className={kpis.totalErrors > 0 ? '[&_p:first-of-type]:text-destructive' : ''}
        />
        <KpiCard
          label="Error Rate"
          value={`${kpis.errorRate.toFixed(1)}%`}
          icon={AlertCircle}
          className={
            kpis.errorRate > 5
              ? '[&_p:first-of-type]:text-destructive'
              : kpis.errorRate > 1
                ? '[&_p:first-of-type]:text-chart-5'
                : '[&_p:first-of-type]:text-chart-2'
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Latency Distribution</CardTitle>
            <CardDescription>Request count by response time bucket</CardDescription>
            <CardAction>
              <Badge variant="secondary" className="tabular-nums">
                {kpis.totalRequests.toLocaleString()} total
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            {histogramData.length > 0 ? (
              <ChartContainer config={histogramConfig} className="h-72 w-full">
                <BarChart data={histogramData}>
                  <CartesianGrid
                    vertical={false}
                    strokeDasharray="3 3"
                    className="stroke-muted/50"
                  />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <defs>
                    {histogramData.map((entry, i) => {
                      const strength = Math.max(0.35, entry.count / maxHistogramCount);
                      return (
                        <linearGradient
                          key={entry.name}
                          id={`histogram-bar-${i}`}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="var(--chart-1)"
                            stopOpacity={0.3 + strength * 0.7}
                          />
                          <stop
                            offset="100%"
                            stopColor="var(--chart-1)"
                            stopOpacity={0.15 + strength * 0.45}
                          />
                        </linearGradient>
                      );
                    })}
                  </defs>
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    <LabelList
                      dataKey="count"
                      position="top"
                      className="fill-foreground"
                      fontSize={11}
                      formatter={(value: string | number) => Number(value).toLocaleString()}
                    />
                    {histogramData.map((entry, i) => (
                      <Cell key={entry.name} fill={`url(#histogram-bar-${i})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-lg border border-dashed">
                <Gauge className="size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No distribution data</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Latency by Model (P95)</CardTitle>
            <CardDescription>Response time per model</CardDescription>
            <CardAction>
              <Badge variant="secondary" className="tabular-nums">
                {formatLatencyMs(kpis.avgLatency)} avg
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            {latencyBarData.length > 0 ? (
              <ChartContainer config={latencyBarConfig} className="h-72 w-full">
                <BarChart
                  accessibilityLayer
                  data={latencyBarData}
                  layout="vertical"
                  margin={{ right: 26 }}
                >
                  <CartesianGrid horizontal={false} className="stroke-muted/40" />
                  <YAxis
                    dataKey="model"
                    type="category"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    hide
                  />
                  <XAxis dataKey="value" type="number" hide />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        indicator="line"
                        formatter={(value: any, _name: any, item: { payload: { model: any } }) => [
                          String(item?.payload?.model ?? 'Model'),
                          ' - ',
                          formatLatencyMs(Number(value)),
                        ]}
                      />
                    }
                  />
                  <Bar dataKey="value" fill="var(--color-value)" radius={6}>
                    <LabelList
                      dataKey="model"
                      position="insideLeft"
                      offset={8}
                      className="fill-(--color-label)"
                      fontSize={12}
                    />
                    <LabelList
                      dataKey="value"
                      position="right"
                      offset={8}
                      className="fill-foreground"
                      fontSize={12}
                      formatter={(value: string | number) => formatLatencyMs(Number(value))}
                    />
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-lg border border-dashed">
                <Clock className="size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No latency data</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Error Rate Over Time</CardTitle>
            <CardDescription>Errors per day</CardDescription>
            <CardAction>
              {kpis.totalErrors > 0 ? (
                <Badge variant="secondary" className="tabular-nums">
                  {kpis.totalErrors} total
                </Badge>
              ) : (
                <Badge variant="secondary" className="tabular-nums">
                  0 total
                </Badge>
              )}
            </CardAction>
          </CardHeader>
          <CardContent>
            {data.errors.length > 0 ? (
              <ChartContainer config={errorChartConfig} className="h-72 w-full">
                <AreaChart data={data.errors}>
                  <CartesianGrid
                    vertical={false}
                    strokeDasharray="3 3"
                    className="stroke-muted/50"
                  />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => {
                      const d = new Date(v);
                      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    }}
                    tick={{ fontSize: 11 }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <defs>
                    <linearGradient id="fillErrorOverTime" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-5)" stopOpacity={0.3} />
                      <stop offset="50%" stopColor="var(--chart-5)" stopOpacity={0.1} />
                      <stop offset="100%" stopColor="var(--chart-5)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <Area
                    dataKey="errors"
                    type="monotone"
                    fill="url(#fillErrorOverTime)"
                    stroke="var(--chart-5)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-lg border border-dashed">
                <CheckCircle2 className="size-8 text-chart-5/60" />
                <p className="text-sm text-muted-foreground">No errors recorded</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Recent Errors</CardTitle>
          <CardDescription>Click a row to view the trace</CardDescription>
        </CardHeader>
        <CardContent className="pl-10 pr-10">
          {data.errorsTable.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.errorsTable.slice(0, 8).map((err, i) => (
                  <TableRow
                    key={err.requestId || i}
                    className="cursor-pointer"
                    onClick={() => navigate(`/traces?trace=${err.requestId}`)}
                  >
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(err.date).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell className="font-medium">{err.model}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="max-w-48 truncate">
                        {err.reason}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 px-2">
                        <ArrowUpRight />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed">
              <CheckCircle2 className="size-6 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No recent errors</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Collapsible open={insightsOpen} onOpenChange={setInsightsOpen}>
        <Card className="overflow-hidden">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer transition-colors hover:bg-muted/30">
              <CardTitle>Performance Insights</CardTitle>
              <CardDescription>Recommendations to improve latency and throughput</CardDescription>
              <CardAction>
                <Button variant="ghost" size="icon">
                  <ChevronDown
                    className={`transition-transform duration-500 ${insightsOpen ? 'rotate-180' : ''}`}
                  />
                </Button>
              </CardAction>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Item variant="outline" className="border-chart-2/20 bg-chart-2/5">
                <ItemMedia className="size-8 rounded-full bg-chart-2/10">
                  <Zap className="size-4 text-chart-2" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Latency Analysis</ItemTitle>
                  <ItemDescription className="leading-relaxed">
                    Average P95 latency is{' '}
                    <span className="font-semibold text-foreground">
                      {formatLatencyMs(data.latencyBy[0]?.value || 0)}
                    </span>
                    . Consider faster models for low-latency requirements.
                  </ItemDescription>
                </ItemContent>
              </Item>
              <Item variant="outline" className="border-chart-1/20 bg-chart-1/5">
                <ItemMedia className="size-8 rounded-full bg-chart-1/10">
                  <Gauge className="size-4 text-chart-1" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Throughput Optimization</ItemTitle>
                  <ItemDescription className="leading-relaxed">
                    Optimize throughput by batching similar requests and implementing caching for
                    common responses.
                  </ItemDescription>
                </ItemContent>
              </Item>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
