import { useMemo } from 'react';
import { Trophy } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { RankingCard } from '../shared/RankingCard';
import { ScorePill } from './ScorePill';
import { formatPct, formatMetric } from './utils';
import type { ExperimentComparison } from '../../types/evaluationsTypes';

function DeltaChip({ delta }: { delta: number }) {
  if (Math.abs(delta) < 0.001) return null;

  const isPositive = delta > 0;

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium tabular-nums ${
        isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
      }`}
    >
      {isPositive ? '↑' : '↓'}
      {isPositive ? '+' : ''}
      {(delta * 100).toFixed(1)}
    </span>
  );
}

interface ComparisonOverviewProps {
  evalIds: string[];
  metricIds: string[];
  comparison: ExperimentComparison;
  getEvalName: (id: string) => string;
}

export function ComparisonOverview({
  evalIds,
  metricIds,
  comparison,
  getEvalName,
}: ComparisonOverviewProps) {
  const baselineId = evalIds[0];

  const overallAvg = useMemo(() => {
    const avgs: Record<string, number> = {};
    for (const evalId of evalIds) {
      const scores = Object.values(comparison.metric_summary[evalId] || {}).filter(
        (v): v is number => v != null
      );
      avgs[evalId] = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    }
    return avgs;
  }, [comparison, evalIds]);

  const sortedEvalIds = useMemo(
    () => [...evalIds].sort((a, b) => (overallAvg[b] ?? 0) - (overallAvg[a] ?? 0)),
    [evalIds, overallAvg]
  );

  const bestEvalId = sortedEvalIds[0];

  return (
    <div className="space-y-6 p-6">
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${sortedEvalIds.length}, minmax(0, 1fr))` }}
      >
        {sortedEvalIds.map((evalId, idx) => (
          <RankingCard
            key={evalId}
            name={getEvalName(evalId)}
            nameTitle={evalId}
            rank={idx + 1}
            formattedScore={formatPct(overallAvg[evalId] ?? 0)}
            scoreColorClass={
              (overallAvg[evalId] ?? 0) >= 0.8
                ? 'text-emerald-600 dark:text-emerald-400'
                : (overallAvg[evalId] ?? 0) >= 0.4
                  ? 'text-foreground'
                  : 'text-destructive'
            }
            isWinner={evalId === bestEvalId && sortedEvalIds.length > 1}
            winnerIcon={<Trophy className="size-4 text-muted-foreground" />}
            stats={evalId === baselineId ? [{ label: 'Role', value: 'baseline' }] : []}
          />
        ))}
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-36 text-xs font-medium text-muted-foreground">
                Metric
              </TableHead>
              {evalIds.map((evalId) => (
                <TableHead
                  key={evalId}
                  className="text-center text-xs font-semibold text-foreground"
                >
                  <span className="truncate" title={evalId}>
                    {getEvalName(evalId)}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {metricIds.map((metric) => (
              <TableRow key={metric} className="hover:bg-muted/20">
                <TableCell className="text-sm text-muted-foreground capitalize py-2.5">
                  {formatMetric(metric)}
                </TableCell>
                {evalIds.map((evalId) => {
                  const score = comparison.metric_summary[evalId]?.[metric];
                  const baseScore = comparison.metric_summary[baselineId]?.[metric];
                  const delta =
                    evalId !== baselineId && score != null && baseScore != null
                      ? score - baseScore
                      : null;

                  // Highlight best score per metric
                  const allScores = evalIds
                    .map((id) => comparison.metric_summary[id]?.[metric])
                    .filter((v): v is number => v != null);
                  const bestScore = allScores.length > 0 ? Math.max(...allScores) : null;
                  const isBest =
                    evalIds.length > 1 && score != null && bestScore != null && score === bestScore;

                  return (
                    <TableCell key={evalId} className="text-center py-2.5">
                      {score != null ? (
                        <div className="flex items-center justify-center gap-1.5">
                          {isBest ? (
                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-xs font-bold tabular-nums bg-muted border border-border">
                              {formatPct(score)}
                            </span>
                          ) : (
                            <ScorePill score={score} />
                          )}
                          {delta != null && <DeltaChip delta={delta} />}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">--</span>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
