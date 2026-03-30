import type { EvaluationMetric, SampleResult } from '../../types';

export function formatScore(score: number): string {
  return (score * 100).toFixed(1) + '%';
}

export function formatModelName(modelId: string): string {
  const parts = modelId.split(/[.:]/);
  if (parts.length > 2) return parts.slice(0, 2).join(' ');
  return modelId.length > 25 ? modelId.slice(0, 22) + '…' : modelId;
}

export function getScoreColor(score: number): string {
  if (score < 0.4) return 'text-destructive';
  return 'text-foreground';
}

export function getMetricName(metricId: string, metrics: EvaluationMetric[]): string {
  const metric = metrics.find((m) => m.metric_id === metricId);
  if (metric) return metric.name;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(metricId);
  if (isUuid) return `Custom (${metricId.substring(0, 8)}…)`;
  return metricId.replace(/_/g, ' ');
}

export function computeModelAvgScores(
  sample: SampleResult,
  modelIds: string[],
  metricIds: string[]
): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const modelId of modelIds) {
    let total = 0;
    let count = 0;
    for (const metricId of metricIds) {
      const score = sample.scores?.[metricId]?.[modelId]?.score;
      if (typeof score === 'number') {
        total += score;
        count++;
      }
    }
    scores[modelId] = count > 0 ? total / count : 0;
  }
  return scores;
}

export function findBestModel(modelIds: string[], avgScores: Record<string, number>): string {
  let best = '';
  let bestScore = -1;
  for (const modelId of modelIds) {
    const score = avgScores[modelId] ?? 0;
    if (score > bestScore) {
      bestScore = score;
      best = modelId;
    }
  }
  return best;
}

export function buildMetricRows(sample: SampleResult, modelIds: string[], metricIds: string[]) {
  return metricIds.map((metricId) => ({
    metricId,
    scores: Object.fromEntries(
      modelIds.map((modelId) => [modelId, sample.scores?.[metricId]?.[modelId]?.score])
    ),
  }));
}

export function buildLatencies(sample: SampleResult, modelIds: string[]) {
  return Object.fromEntries(
    modelIds.map((modelId) => [modelId, sample.outputs?.[modelId]?.latency ?? 0])
  );
}
