import { useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import type { SampleResult, EvaluationMetric } from '../../../types';
import {
  formatScore,
  getScoreColor,
  computeModelAvgScores,
  findBestModel,
  buildMetricRows,
  buildLatencies,
} from '../utils';
import { MetricsDataTable } from '../MetricsDataTable';
import { ExpandableText } from '../../shared/ExpandableText';
import { ModelOutputCard } from './ModelOutputCard';

interface SampleRowProps {
  sample: SampleResult;
  index: number;
  modelIds: string[];
  metricIds: string[];
  metrics: EvaluationMetric[];
  isOpen: boolean;
  onToggle: () => void;
}

export function SampleRow({
  sample,
  index,
  modelIds,
  metricIds,
  metrics,
  isOpen,
  onToggle,
}: SampleRowProps) {
  const avgScores = useMemo(
    () => computeModelAvgScores(sample, modelIds, metricIds),
    [sample, modelIds, metricIds]
  );

  const bestModelId = useMemo(() => findBestModel(modelIds, avgScores), [modelIds, avgScores]);

  const metricRows = useMemo(
    () => buildMetricRows(sample, modelIds, metricIds),
    [sample, modelIds, metricIds]
  );

  const latencies = useMemo(() => buildLatencies(sample, modelIds), [sample, modelIds]);

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <button
          className={`group w-full flex items-center gap-4 px-6 py-3 text-left transition-colors ${
            isOpen ? 'sticky top-10 z-10 bg-background border-b shadow-sm' : 'hover:bg-muted/30'
          }`}
        >
          <span className="text-xs text-muted-foreground tabular-nums shrink-0 w-5 text-right">
            {index + 1}
          </span>

          <span className="flex-1 truncate text-sm text-foreground/80">
            {(sample.input ?? '').slice(0, 120)}
            {(sample.input?.length ?? 0) > 120 ? '…' : ''}
          </span>

          <div className="flex items-center gap-2 shrink-0">
            {modelIds.map((modelId) => {
              const hasError = sample.outputs?.[modelId]?.error;
              return (
                <span
                  key={modelId}
                  className={`w-20 text-center text-xs font-bold tabular-nums ${
                    hasError ? 'text-destructive' : getScoreColor(avgScores[modelId])
                  }`}
                >
                  {hasError ? 'ERR' : formatScore(avgScores[modelId])}
                </span>
              );
            })}
          </div>

          <ChevronDown
            className={`size-4 text-muted-foreground shrink-0 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="border-t bg-muted/5 px-6 py-5 space-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
              Metrics Comparison
            </Label>
            <MetricsDataTable
              modelIds={modelIds}
              metricRows={metricRows}
              metrics={metrics}
              latencies={latencies}
              className="rounded-lg border overflow-hidden"
            />
          </div>

          <ExpandableText text={sample.input} previewLines={3} label="Input" />

          {sample.expected && (
            <ExpandableText text={sample.expected} previewLines={3} label="Expected Response" />
          )}

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
              Model Outputs
            </Label>
            <div
              className={`grid gap-3 ${modelIds.length === 2 ? 'sm:grid-cols-2' : 'grid-cols-1'}`}
            >
              {modelIds.map((modelId) => (
                <ModelOutputCard
                  key={modelId}
                  modelId={modelId}
                  output={sample.outputs?.[modelId]}
                  metricIds={metricIds}
                  metrics={metrics}
                  scores={sample.scores}
                  isBest={bestModelId === modelId && modelIds.length > 1}
                />
              ))}
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
