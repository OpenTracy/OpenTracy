import { useMemo } from 'react';
import { Clock, DollarSign } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { EvaluationMetric } from '../../types';
import { formatLatency } from '@/utils/formatUtils';
import { formatScore, formatModelName, getScoreColor, getMetricName } from './utils';

interface MetricRowData {
  metricId: string;
  /** scores keyed by modelId */
  scores: Record<string, number | undefined>;
}

interface MetricsDataTableProps {
  modelIds: string[];
  metricRows: MetricRowData[];
  metrics: EvaluationMetric[];
  latencies?: Record<string, number>;
  costs?: Record<string, number>;
  className?: string;
}

export function MetricsDataTable({
  modelIds,
  metricRows,
  metrics,
  latencies,
  costs,
  className,
}: MetricsDataTableProps) {
  const bestByRow = useMemo(() => {
    const best: Record<string, string> = {};
    metricRows.forEach(({ metricId, scores }) => {
      if (modelIds.length <= 1) return;
      let bestModel = '';
      let bestScore = -1;
      let allZero = true;
      modelIds.forEach((modelId) => {
        const score = scores[modelId] ?? 0;
        if (score > 0) allZero = false;
        if (score > bestScore) {
          bestScore = score;
          bestModel = modelId;
        }
      });
      if (!allZero) best[metricId] = bestModel;
    });
    return best;
  }, [modelIds, metricRows]);

  const hasCost = costs ? Object.values(costs).some((c) => (c ?? 0) > 0) : false;

  return (
    <div className={className}>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="w-36 text-xs font-medium text-muted-foreground">Metric</TableHead>
            {modelIds.map((modelId) => (
              <TableHead
                key={modelId}
                className="text-center text-xs font-semibold text-foreground"
              >
                <span className="truncate" title={modelId}>
                  {formatModelName(modelId)}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {metricRows.map(({ metricId, scores }) => (
            <TableRow key={metricId} className="hover:bg-muted/20">
              <TableCell className="text-sm text-muted-foreground capitalize py-2.5">
                {getMetricName(metricId, metrics)}
              </TableCell>
              {modelIds.map((modelId) => {
                const score = scores[modelId];
                const isBest = bestByRow[metricId] === modelId;
                const hasValue = score !== undefined;

                return (
                  <TableCell key={modelId} className="text-center py-2.5">
                    {isBest && hasValue ? (
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-sm font-bold tabular-nums bg-muted border border-border">
                        {formatScore(score)}
                      </span>
                    ) : (
                      <span
                        className={`text-sm tabular-nums ${
                          hasValue ? `font-medium ${getScoreColor(score)}` : 'text-muted-foreground'
                        }`}
                      >
                        {hasValue ? formatScore(score) : '—'}
                      </span>
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}

          {latencies && (
            <TableRow className="hover:bg-muted/20">
              <TableCell className="text-sm text-muted-foreground py-2.5">
                <span className="flex items-center gap-1.5">
                  <Clock className="size-3" />
                  Latency
                </span>
              </TableCell>
              {modelIds.map((modelId) => (
                <TableCell key={modelId} className="text-center py-2.5">
                  <span className="text-sm font-medium tabular-nums text-foreground">
                    {formatLatency(latencies[modelId] ?? 0)}
                  </span>
                </TableCell>
              ))}
            </TableRow>
          )}

          {hasCost && costs && (
            <TableRow className="hover:bg-muted/20">
              <TableCell className="text-sm text-muted-foreground py-2.5">
                <span className="flex items-center gap-1.5">
                  <DollarSign className="size-3" />
                  Cost
                </span>
              </TableCell>
              {modelIds.map((modelId) => (
                <TableCell key={modelId} className="text-center py-2.5">
                  <span className="text-sm font-medium tabular-nums text-foreground">
                    ${(costs[modelId] ?? 0).toFixed(4)}
                  </span>
                </TableCell>
              ))}
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
