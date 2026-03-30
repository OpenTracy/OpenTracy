import { useState } from 'react';
import { AlertCircle, ChevronRight, Clock, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { SampleResult, EvaluationMetric } from '../../../types';
import { formatLatency } from '@/utils/formatUtils';
import { formatScore, getScoreColor, formatModelName, getMetricName } from '../utils';

interface ModelOutputCardProps {
  modelId: string;
  output: SampleResult['outputs'][string] | undefined;
  metricIds: string[];
  metrics: EvaluationMetric[];
  scores: SampleResult['scores'];
  isBest: boolean;
}

export function ModelOutputCard({
  modelId,
  output,
  metricIds,
  metrics,
  scores,
  isBest,
}: ModelOutputCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={`rounded-lg overflow-hidden ${
          isBest ? 'border-2 border-foreground/40' : 'border'
        }`}
      >
        <CollapsibleTrigger className="group w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-2 min-w-0">
            <ChevronRight
              className={`size-3.5 text-muted-foreground shrink-0 transition-transform duration-150 ${
                open ? 'rotate-90' : ''
              }`}
            />
            <span className="text-sm font-semibold truncate">{formatModelName(modelId)}</span>
            {isBest && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 shrink-0">
                Best
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0 text-xs">
            {metricIds.map((metricId) => {
              const s = scores?.[metricId]?.[modelId];
              return (
                <span key={metricId} className="flex items-center gap-1">
                  <span className="text-muted-foreground hidden sm:inline">
                    {getMetricName(metricId, metrics)}:
                  </span>
                  <span
                    className={`font-bold tabular-nums ${s ? getScoreColor(s.score) : 'text-muted-foreground'}`}
                  >
                    {s ? formatScore(s.score) : '—'}
                  </span>
                </span>
              );
            })}
            {output && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock className="size-3" />
                {formatLatency(output.latency ?? 0)}
              </span>
            )}
            {(output?.cost ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <DollarSign className="size-3" />${output!.cost!.toFixed(4)}
              </span>
            )}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="border-t p-3">
          {output?.error ? (
            <div className="flex items-start gap-2 text-destructive text-xs">
              <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
              <span>{output.error}</span>
            </div>
          ) : (
            <pre className="text-xs font-mono whitespace-pre-wrap wrap-break-word leading-relaxed">
              {output?.output || <span className="text-muted-foreground italic">No output</span>}
            </pre>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
