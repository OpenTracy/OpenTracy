import { useState, useCallback, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { SamplesHeader, type SamplesColumn } from '../shared/SamplesHeader';
import { ExpandableText } from '../shared/ExpandableText';
import { ScorePill } from './ScorePill';
import { scorePillClasses, formatPct, formatMetric } from './utils';
import type { ExperimentComparisonRow } from '../../types/evaluationsTypes';

function DeltaChip({ delta }: { delta: number }) {
  if (Math.abs(delta) < 0.001) return null;
  const isPositive = delta > 0;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
        isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
      )}
    >
      {isPositive ? '↑+' : '↓'}
      {(delta * 100).toFixed(1)}
    </span>
  );
}

interface SampleRowProps {
  sample: ExperimentComparisonRow;
  index: number;
  evalIds: string[];
  metricIds: string[];
  getEvalName: (id: string) => string;
  isOpen: boolean;
  onToggle: () => void;
}

function SampleRow({
  sample,
  index,
  evalIds,
  metricIds,
  getEvalName,
  isOpen,
  onToggle,
}: SampleRowProps) {
  const evalAvgs = useMemo(() => {
    const avgs: Record<string, number> = {};
    for (const evalId of evalIds) {
      const evalScores = sample.scores[evalId];
      if (!evalScores) continue;
      const values = Object.values(evalScores)
        .map((d) => d.score)
        .filter((s): s is number => s != null);
      avgs[evalId] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    }
    return avgs;
  }, [sample, evalIds]);

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            'group w-full flex items-center gap-4 px-6 py-3 text-left transition-colors',
            isOpen ? 'sticky top-10 z-10 bg-background border-b shadow-sm' : 'hover:bg-muted/30'
          )}
        >
          <span className="text-xs text-muted-foreground tabular-nums shrink-0 w-5 text-right">
            {index + 1}
          </span>

          <span className="flex-1 truncate text-sm text-foreground/80">
            {(sample.input ?? '').slice(0, 120)}
            {(sample.input?.length ?? 0) > 120 ? '…' : ''}
          </span>

          <div className="flex items-center gap-2 shrink-0">
            {evalIds.map((evalId) => {
              const avg = evalAvgs[evalId];
              return avg != null ? (
                <Tooltip key={evalId}>
                  <TooltipTrigger asChild>
                    <span
                      className={cn(
                        'w-20 text-center text-xs font-bold tabular-nums px-1.5 py-0.5 rounded',
                        scorePillClasses(avg)
                      )}
                    >
                      {formatPct(avg)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{getEvalName(evalId)}</TooltipContent>
                </Tooltip>
              ) : (
                <span
                  key={evalId}
                  className="w-20 text-center text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5"
                >
                  --
                </span>
              );
            })}
          </div>

          <ChevronDown
            className={cn(
              'size-4 text-muted-foreground shrink-0 transition-transform duration-200',
              isOpen && 'rotate-180'
            )}
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="border-t bg-muted/5 px-6 py-5 space-y-5">
          {/* Metrics comparison table */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
              Metrics Comparison
            </Label>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-36 text-xs font-medium text-muted-foreground">
                      Metric
                    </TableHead>
                    {evalIds.map((evalId, idx) => (
                      <TableHead
                        key={evalId}
                        className="text-center text-xs font-semibold text-foreground"
                      >
                        {getEvalName(evalId)}
                        {idx === 0 ? ' (base)' : ''}
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
                        const scoreData = sample.scores[evalId]?.[metric];
                        if (!scoreData) {
                          return (
                            <TableCell
                              key={evalId}
                              className="text-center text-muted-foreground py-2.5"
                            >
                              --
                            </TableCell>
                          );
                        }
                        return (
                          <TableCell key={evalId} className="text-center py-2.5">
                            <div className="inline-flex items-center gap-1.5">
                              <ScorePill score={scoreData.score} className="text-xs px-1.5 py-0" />
                              {scoreData.delta != null && <DeltaChip delta={scoreData.delta} />}
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Input & Expected */}
          <ExpandableText text={sample.input} previewLines={3} label="Input" />

          {sample.expected && (
            <ExpandableText text={sample.expected} previewLines={3} label="Expected" />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface ComparisonSamplesProps {
  samples: ExperimentComparisonRow[];
  evalIds: string[];
  metricIds: string[];
  getEvalName: (id: string) => string;
}

export function ComparisonSamples({
  samples,
  evalIds,
  metricIds,
  getEvalName,
}: ComparisonSamplesProps) {
  const [expandedSample, setExpandedSample] = useState<string | null>(null);

  const handleToggle = useCallback((sampleId: string) => {
    setExpandedSample((prev) => (prev === sampleId ? null : sampleId));
  }, []);

  const columns: SamplesColumn[] = useMemo(
    () => evalIds.map((id) => ({ id, label: getEvalName(id) })),
    [evalIds, getEvalName]
  );

  if (!samples.length) {
    return (
      <p className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        No samples available.
      </p>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <SamplesHeader columns={columns} />

      <div role="list" className="divide-y">
        {samples.map((sample, idx) => (
          <SampleRow
            key={sample.sample_id}
            sample={sample}
            index={idx}
            evalIds={evalIds}
            metricIds={metricIds}
            getEvalName={getEvalName}
            isOpen={expandedSample === sample.sample_id}
            onToggle={() => handleToggle(sample.sample_id)}
          />
        ))}
      </div>
    </div>
  );
}
