import {
  Hash,
  MessageSquare,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { KpiCard } from '@/components/shared/KpiCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import type { DatasetStats as Stats } from '../../hooks/useDatasetSamples';
import type { Dataset } from '../../types';

interface DatasetStatsProps {
  stats: Stats;
  dataset: Dataset;
  onHistogramClick?: (type: 'input' | 'output', bucket: { min: number; max: number }) => void;
  inputLengthFilter?: { min: number; max: number } | null;
  outputLengthFilter?: { min: number; max: number } | null;
}

export function DatasetStats({
  stats,
  dataset,
  onHistogramClick,
  inputLengthFilter,
  outputLengthFilter,
}: DatasetStatsProps) {
  const completenessPercent = (stats.withOutput / stats.total) * 100;
  const isComplete = completenessPercent === 100;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Total Samples"
          value={stats.total.toLocaleString()}
          icon={Hash}
          subtitle={`${stats.withOutput.toLocaleString()} with output`}
        />
        <KpiCard
          label="Avg Input Length"
          value={`${stats.avgInputTokens}`}
          icon={MessageSquare}
          subtitle={`${stats.minInputTokens}–${stats.maxInputTokens} range`}
        />
        <KpiCard
          label="Avg Output Length"
          value={`${stats.avgOutputTokens}`}
          icon={ArrowRight}
          subtitle={`${stats.minOutputTokens}–${stats.maxOutputTokens} range`}
        />
        <KpiCard
          label="Total Tokens"
          value={`${(stats.totalTokens / 1000).toFixed(1)}k`}
          icon={TrendingUp}
          subtitle="Estimated from char count"
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Data Completeness</CardTitle>
            <Badge
              variant={
                isComplete ? 'default' : stats.missingOutput > 0 ? 'destructive' : 'secondary'
              }
              className="text-xs"
            >
              {isComplete ? (
                <CheckCircle2 className="size-3" />
              ) : (
                <AlertTriangle className="size-3" />
              )}
              {completenessPercent.toFixed(0)}%
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={completenessPercent} className="h-2.5" />
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {stats.withOutput.toLocaleString()} of {stats.total.toLocaleString()} samples have
              output
            </span>
            {stats.missingOutput > 0 && (
              <span className="text-destructive font-medium">
                {stats.missingOutput.toLocaleString()} missing
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[
          {
            title: 'Input Length Distribution',
            histogram: stats.inputHistogram,
            type: 'input' as const,
            activeFilter: inputLengthFilter,
            barClass: 'bg-primary',
            accentClass: 'bg-secondary',
          },
          {
            title: 'Output Length Distribution',
            histogram: stats.outputHistogram,
            type: 'output' as const,
            activeFilter: outputLengthFilter,
            barClass: 'bg-chart-2',
            accentClass: 'bg-secondary',
          },
        ].map(({ title, histogram, type, activeFilter, barClass, accentClass }) => {
          const maxCount = Math.max(...histogram.map((b) => b.count));
          const totalCount = histogram.reduce((sum, b) => sum + b.count, 0);

          return (
            <Card key={type}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">{title}</CardTitle>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {totalCount.toLocaleString()} total
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                {histogram.map((bucket) => {
                  const pct = maxCount > 0 ? (bucket.count / maxCount) * 100 : 0;
                  const isActive = activeFilter?.min === bucket.min;
                  const proportion =
                    totalCount > 0 ? ((bucket.count / totalCount) * 100).toFixed(0) : '0';

                  return (
                    <button
                      key={bucket.label}
                      onClick={() => onHistogramClick?.(type, bucket)}
                      className={`w-full flex items-center gap-3 px-2.5 py-1.5 rounded-md transition-colors ${
                        isActive ? `${accentClass} ring-1 ring-ring` : 'hover:bg-muted'
                      }`}
                    >
                      <span className="w-14 text-xs text-muted-foreground text-left font-mono shrink-0">
                        {bucket.label}
                      </span>
                      <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                        <div
                          className={`h-full rounded transition-all ${barClass}`}
                          style={{ width: `${pct}%`, minWidth: bucket.count > 0 ? '2px' : '0' }}
                        />
                      </div>
                      <span className="w-8 text-xs text-muted-foreground text-right tabular-nums shrink-0">
                        {proportion}%
                      </span>
                      <span className="w-10 text-xs font-medium text-foreground text-right tabular-nums shrink-0">
                        {bucket.count.toLocaleString()}
                      </span>
                    </button>
                  );
                })}
                <p className="text-[11px] text-muted-foreground pt-2">
                  Click a bucket to filter samples
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Dataset Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-8 gap-y-0 sm:grid-cols-3">
            {[
              { label: 'Source', value: dataset.source?.replace(/_/g, ' ') ?? 'manual' },
              {
                label: 'Created',
                value: dataset.created_at ? new Date(dataset.created_at).toLocaleDateString() : '-',
              },
              {
                label: 'Updated',
                value: dataset.updated_at ? new Date(dataset.updated_at).toLocaleDateString() : '-',
              },
              { label: 'Min Input', value: `${stats.minInputTokens} tokens` },
              { label: 'Max Input', value: `${stats.maxInputTokens} tokens` },
              { label: 'Avg Input', value: `${stats.avgInputTokens} tokens` },
              { label: 'Min Output', value: `${stats.minOutputTokens} tokens` },
              { label: 'Max Output', value: `${stats.maxOutputTokens} tokens` },
              { label: 'Avg Output', value: `${stats.avgOutputTokens} tokens` },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between py-2.5 border-b border-border last:border-0"
              >
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className="text-xs font-medium text-foreground capitalize">{item.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
