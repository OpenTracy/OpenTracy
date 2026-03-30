import { useMemo } from 'react';
import type { EvaluationResults, EvaluationMetric } from '../../../types';
import { ModelRankingCard } from './ModelRankingCard';
import { MetricsDataTable } from '../MetricsDataTable';

interface OverviewProps {
  summary: EvaluationResults['summary'];
  winner?: EvaluationResults['winner'];
  metrics: EvaluationMetric[];
}

export function Overview({ summary, winner, metrics }: OverviewProps) {
  const modelIds = Object.keys(summary.models);
  const metricIds = Object.keys(summary.metrics);

  const modelOverallScores = useMemo(() => {
    const scores: Record<string, number> = {};
    modelIds.forEach((modelId) => {
      const avgScores = summary.models[modelId]?.avg_scores ?? {};
      const values = Object.values(avgScores).filter((v) => typeof v === 'number') as number[];
      scores[modelId] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    });
    return scores;
  }, [summary, modelIds]);

  const sortedModelIds = useMemo(
    () => [...modelIds].sort((a, b) => (modelOverallScores[b] ?? 0) - (modelOverallScores[a] ?? 0)),
    [modelIds, modelOverallScores]
  );

  const metricRows = useMemo(
    () =>
      metricIds.map((metricId) => ({
        metricId,
        scores: Object.fromEntries(
          sortedModelIds.map((modelId) => [
            modelId,
            summary.models[modelId]?.avg_scores?.[metricId] ?? 0,
          ])
        ),
      })),
    [summary, sortedModelIds, metricIds]
  );

  const latencies = useMemo(
    () =>
      Object.fromEntries(
        sortedModelIds.map((modelId) => [modelId, summary.models[modelId]?.avg_latency ?? 0])
      ),
    [summary, sortedModelIds]
  );

  const costs = useMemo(
    () =>
      Object.fromEntries(
        sortedModelIds.map((modelId) => [modelId, summary.models[modelId]?.avg_cost ?? 0])
      ),
    [summary, sortedModelIds]
  );

  return (
    <div className="space-y-6 p-6">
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${sortedModelIds.length}, minmax(0, 1fr))` }}
      >
        {sortedModelIds.map((modelId, idx) => (
          <ModelRankingCard
            key={modelId}
            modelId={modelId}
            rank={idx + 1}
            score={modelOverallScores[modelId] ?? 0}
            modelData={summary.models[modelId]}
            isWinner={winner?.model === modelId}
          />
        ))}
      </div>

      <MetricsDataTable
        modelIds={sortedModelIds}
        metricRows={metricRows}
        metrics={metrics}
        latencies={latencies}
        costs={costs}
        className="rounded-lg border overflow-hidden"
      />
    </div>
  );
}
