import type { Evaluation } from './types';

/**
 * Extracts a per-model score map from an evaluation's results,
 * trying multiple data paths in order of priority.
 */
export function extractScoresByModel(evaluation: Evaluation): Record<string, number> {
  const results = evaluation.results;
  if (!results) return {};

  // 1. winner.scores_by_model (most specific)
  const winnerScores = results.winner?.scores_by_model;
  if (winnerScores) {
    const valid = Object.fromEntries(
      Object.entries(winnerScores).filter(([, v]) => typeof v === 'number')
    );
    if (Object.keys(valid).length > 0) return valid;
  }

  // 2. summary.models[].avg_scores (detailed breakdown)
  const summaryModels = results.summary?.models;
  if (summaryModels) {
    const scores = Object.fromEntries(
      Object.entries(summaryModels)
        .map(([modelId, summary]) => {
          const values = Object.values(summary?.avg_scores ?? {}).filter(
            (v): v is number => typeof v === 'number'
          );
          if (values.length === 0) return null;
          return [modelId, values.reduce((a, b) => a + b, 0) / values.length] as const;
        })
        .filter((e): e is readonly [string, number] => e !== null)
    );
    if (Object.keys(scores).length > 0) return scores;
  }

  // 3. winner.model + winner.overall_score (single winner fallback)
  const { model, overall_score } = results.winner ?? {};
  if (model && typeof overall_score === 'number') {
    return { [model]: overall_score };
  }

  return {};
}

/**
 * Returns the appropriate text color class for a given score value (0-1).
 * Uses shadcn color tokens: primary, foreground, muted-foreground, destructive.
 */
export function getScoreColor(score: number): string {
  if (score >= 0.8) return 'text-primary';
  if (score >= 0.6) return 'text-foreground';
  if (score >= 0.4) return 'text-muted-foreground';
  return 'text-destructive';
}
