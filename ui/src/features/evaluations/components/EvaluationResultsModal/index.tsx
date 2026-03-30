import { useState } from 'react';
import { Download, AlertCircle, BarChart3, List, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageTabs, type PageTab } from '@/components/shared/PageTabs';
import { ListStatusBadge } from '../shared/ListStatusBadge';
import type { Evaluation, EvaluationMetric } from '../../types';

import { Overview } from './Overview';
import { Samples } from './Samples';

interface EvaluationResultsModalProps {
  open: boolean;
  evaluation: Evaluation | null;
  metrics?: EvaluationMetric[];
  onClose: () => void;
}

type TabId = 'overview' | 'samples';

export function EvaluationResultsModal({
  open,
  evaluation,
  metrics = [],
  onClose,
}: EvaluationResultsModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const isFailed = evaluation?.status === 'failed';
  const results = evaluation?.results;
  const summary = results?.summary;
  const winner = results?.winner;
  const samples = results?.samples ?? [];
  const modelIds = summary?.models ? Object.keys(summary.models) : [];
  const metricIds = summary?.metrics ? Object.keys(summary.metrics) : [];
  const hasData = modelIds.length > 0;

  if (!evaluation) return null;
  if (!isFailed && (!results || !summary)) return null;

  const tabs: PageTab<TabId>[] = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 className="size-3.5" /> },
    ...(samples.length > 0
      ? [
          {
            id: 'samples' as const,
            label: `Samples (${samples.length})`,
            icon: <List className="size-3.5" />,
          },
        ]
      : []),
  ];

  const exportResults = () => {
    const data = {
      evaluation: {
        id: evaluation.id,
        name: evaluation.name,
        dataset_id: evaluation.dataset_id,
        created_at: evaluation.created_at,
        completed_at: evaluation.completed_at,
      },
      results,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evaluation-${evaluation.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] gap-0 p-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0 space-y-0.5">
          <DialogTitle className="text-lg leading-tight flex items-center gap-2">
            {evaluation.name}
            {isFailed && <ListStatusBadge status="failed" />}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {isFailed ? (
              <>
                {evaluation.models?.length ?? 0} model
                {(evaluation.models?.length ?? 0) !== 1 && 's'} · {evaluation.metrics?.length ?? 0}{' '}
                metric{(evaluation.metrics?.length ?? 0) !== 1 && 's'}
              </>
            ) : (
              <>
                {modelIds.length} model{modelIds.length !== 1 && 's'} · {metricIds.length} metric
                {metricIds.length !== 1 && 's'}
                {samples.length > 0 && ` · ${samples.length} samples`}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {isFailed ? (
          <div className="flex flex-col items-center justify-center gap-4 p-12 text-center flex-1">
            <XCircle className="size-12 text-muted-foreground" />
            <div className="space-y-2">
              <h3 className="text-base font-medium">Evaluation Failed</h3>
              {evaluation.error ? (
                <div className="space-y-3 max-w-md">
                  <p className="text-sm text-muted-foreground">{evaluation.error.message}</p>
                  <div className="rounded-md border border-border bg-muted/50 px-3 py-2 text-left">
                    <span className="text-xs font-mono text-muted-foreground">
                      {evaluation.error.code}
                    </span>
                    {evaluation.error.details &&
                      Object.keys(evaluation.error.details).length > 0 && (
                        <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap break-words">
                          {JSON.stringify(evaluation.error.details, null, 2)}
                        </pre>
                      )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  An unknown error occurred. No additional details are available.
                </p>
              )}
            </div>
          </div>
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12 text-center flex-1">
            <AlertCircle className="size-12 text-muted-foreground" />
            <div>
              <h3 className="text-base font-medium">No Results Available</h3>
              <p className="text-sm text-muted-foreground mt-1">
                The evaluation may still be processing.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="shrink-0">
              <PageTabs tabs={tabs} value={activeTab} onValueChange={setActiveTab} />
            </div>

            {activeTab === 'overview' && (
              <Overview summary={summary!} winner={winner} metrics={metrics} />
            )}

            {activeTab === 'samples' && samples.length > 0 && (
              <Samples
                samples={samples}
                modelIds={modelIds}
                metricIds={metricIds}
                metrics={metrics}
              />
            )}
          </div>
        )}
        <DialogFooter className="px-6 py-4 shrink-0">
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
          {!isFailed && (
            <Button onClick={exportResults} className="gap-1.5">
              <Download className="size-3.5" />
              Export JSON
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
