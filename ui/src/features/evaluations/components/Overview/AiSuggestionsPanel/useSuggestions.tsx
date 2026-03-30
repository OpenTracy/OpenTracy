import { useMemo } from 'react';
import { Play, FlaskConical, AlertTriangle, AlertCircle } from 'lucide-react';
import type { Evaluation, TraceIssue, Dataset, AvailableModel } from '../../../types';
import type { Suggestion } from './types';

const ISSUE_TYPE_LABELS: Record<string, string> = {
  hallucination: 'Hallucination',
  refusal: 'Refusal',
  safety: 'Safety',
  quality_regression: 'Quality Regression',
  latency_spike: 'Latency Spike',
  cost_anomaly: 'Cost Anomaly',
  format_violation: 'Format Violation',
  incomplete_response: 'Incomplete Response',
};

interface UseSuggestionsParams {
  evaluations: Evaluation[];
  datasets: Dataset[];
  availableModels: AvailableModel[];
  metrics: { builtin: { metric_id: string }[]; custom: { metric_id: string }[] };
  traceIssues?: TraceIssue[];
}

export function useSuggestions({
  evaluations,
  datasets,
  availableModels,
  metrics,
  traceIssues,
}: UseSuggestionsParams): Suggestion[] {
  return useMemo(() => {
    const result: Suggestion[] = [];
    const allMetricIds = [...metrics.builtin, ...metrics.custom].map((m) => m.metric_id);
    const availableModelIds = availableModels.filter((m) => m.available).map((m) => m.id);

    // 1. Issue-based suggestions (highest priority)
    if (traceIssues) {
      const actionable = traceIssues
        .filter(
          (i) =>
            !i.resolved &&
            i.suggested_eval_config &&
            (i.severity === 'high' || i.severity === 'medium')
        )
        .sort((a, b) => {
          if (a.severity === 'high' && b.severity !== 'high') return -1;
          if (b.severity === 'high' && a.severity !== 'high') return 1;
          return b.ai_confidence - a.ai_confidence;
        });

      for (const issue of actionable.slice(0, 2)) {
        const typeLabel = ISSUE_TYPE_LABELS[issue.type] ?? issue.type;
        result.push({
          id: `issue-${issue.id}`,
          title: `${issue.model_id} · ${typeLabel}`,
          description: issue.title,
          icon:
            issue.severity === 'high' ? (
              <AlertTriangle className="size-3.5" />
            ) : (
              <AlertCircle className="size-3.5" />
            ),
          prefill: issue.suggested_eval_config!,
          confidence: issue.ai_confidence,
          isIssueBased: true,
        });
      }
    }

    // 2. Unevaluated datasets
    const evaluatedIds = new Set(evaluations.map((e) => e.dataset_id));
    const unevaluated = datasets.filter((d) => !evaluatedIds.has(d.id));

    for (const ds of unevaluated.slice(0, 1)) {
      if (result.length >= 3) break;
      result.push({
        id: `uneval-${ds.id}`,
        title: ds.name,
        description: `${ds.samples_count} samples · no evaluations yet`,
        icon: <Play className="size-3.5" />,
        prefill: {
          name: `Eval - ${ds.name}`,
          datasetId: ds.id,
          models: availableModelIds.slice(0, 2),
          metrics: allMetricIds.slice(0, 3),
        },
      });
    }

    // 3. Never-compared model pairs
    if (availableModelIds.length >= 2 && result.length < 3) {
      const comparedPairs = new Set<string>();
      evaluations.forEach((e) => {
        if (e.models.length >= 2) {
          const s = [...e.models].sort();
          for (let i = 0; i < s.length; i++)
            for (let j = i + 1; j < s.length; j++) comparedPairs.add(`${s[i]}::${s[j]}`);
        }
      });

      outer: for (let i = 0; i < availableModelIds.length; i++) {
        for (let j = i + 1; j < availableModelIds.length; j++) {
          const pair = [availableModelIds[i], availableModelIds[j]].sort();
          const key = `${pair[0]}::${pair[1]}`;
          if (!comparedPairs.has(key) && datasets.length > 0) {
            const nameA = availableModels.find((m) => m.id === pair[0])?.name ?? pair[0];
            const nameB = availableModels.find((m) => m.id === pair[1])?.name ?? pair[1];
            result.push({
              id: `compare-${pair[0]}-${pair[1]}`,
              title: `${nameA} vs ${nameB}`,
              description: 'Never compared head-to-head',
              icon: <FlaskConical className="size-3.5" />,
              prefill: {
                name: `${nameA} vs ${nameB}`,
                datasetId: datasets[0].id,
                models: [pair[0], pair[1]],
                metrics: allMetricIds.slice(0, 3),
              },
            });
            break outer;
          }
        }
        if (result.length >= 3) break;
      }
    }

    // 4. Expand completed evals with more metrics
    if (result.length < 3) {
      for (const evalItem of evaluations
        .filter((e) => e.status === 'completed' && e.metrics.length < 3)
        .slice(0, 1)) {
        if (result.length >= 3) break;
        const unused = allMetricIds.filter((m) => !evalItem.metrics.includes(m));
        if (unused.length > 0) {
          result.push({
            id: `rerun-${evalItem.id}`,
            title: evalItem.name,
            description: 'Add more metrics for deeper insight',
            icon: <FlaskConical className="size-3.5" />,
            prefill: {
              name: `${evalItem.name} (expanded)`,
              datasetId: evalItem.dataset_id,
              models: evalItem.models,
              metrics: [...evalItem.metrics, ...unused.slice(0, 2)],
            },
          });
        }
      }
    }

    return result.slice(0, 3);
  }, [evaluations, datasets, availableModels, metrics, traceIssues]);
}
