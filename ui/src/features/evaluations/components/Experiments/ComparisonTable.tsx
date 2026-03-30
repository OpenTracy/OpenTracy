import { useState, useMemo } from 'react';
import { Download, FlaskConical, BarChart3, List, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageTabs, type PageTab } from '@/components/shared/PageTabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { Experiment, ExperimentComparison } from '../../types/evaluationsTypes';

import { ComparisonOverview } from './ComparisonOverview';
import { ComparisonSamples } from './ComparisonSamples';

interface ComparisonTableProps {
  open: boolean;
  onClose: () => void;
  experiment: Experiment | null;
  comparison: ExperimentComparison | null;
  loading: boolean;
}

function ComparisonSkeleton() {
  return (
    <div className="flex-1 p-6 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
      </div>
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  );
}

type TabId = 'overview' | 'samples';

export function ComparisonTable({
  open,
  onClose,
  experiment,
  comparison,
  loading,
}: ComparisonTableProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const evalIds = experiment?.evaluation_ids ?? [];

  const metricIds = useMemo(() => {
    if (!comparison) return [];
    return Array.from(
      new Set(
        (comparison.samples ?? []).flatMap((s) =>
          Object.values(s.scores ?? {}).flatMap((es) => Object.keys(es))
        )
      )
    );
  }, [comparison]);

  const getEvalName = (evalId: string) =>
    comparison?.evaluation_names?.[evalId] || `${evalId.slice(0, 8)}…`;

  const hasData = !!comparison && evalIds.length > 0;

  const tabs: PageTab<TabId>[] = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 className="size-3.5" /> },
    ...(comparison && (comparison.samples?.length ?? 0) > 0
      ? [
          {
            id: 'samples' as const,
            label: `Samples (${comparison.samples?.length ?? 0})`,
            icon: <List className="size-3.5" />,
          },
        ]
      : []),
  ];

  const exportComparison = () => {
    if (!comparison || !experiment) return;
    const blob = new Blob([JSON.stringify({ experiment, comparison }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `experiment-${experiment.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!experiment) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] gap-0 p-0 flex flex-col overflow-hidden">
        <TooltipProvider>
          {/* Header */}
          <DialogHeader className="px-6 pt-6 pb-4 shrink-0 space-y-0.5">
            <div className="flex items-center gap-2">
              <FlaskConical className="size-4 text-muted-foreground shrink-0" />
              <DialogTitle className="text-lg leading-tight">{experiment.name}</DialogTitle>
            </div>
            <DialogDescription className="text-sm">
              {evalIds.length} evaluation{evalIds.length !== 1 && 's'} · {metricIds.length} metric
              {metricIds.length !== 1 && 's'}
              {comparison && ` · ${comparison.samples?.length ?? 0} samples`}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <ComparisonSkeleton />
          ) : !hasData ? (
            <div className="flex flex-col items-center justify-center gap-3 p-12 text-center flex-1">
              <AlertCircle className="size-12 text-muted-foreground" />
              <div>
                <h3 className="text-base font-medium">No Comparison Data</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  All evaluations must be completed before comparison data becomes available.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col flex-1 min-h-0">
              <div className="shrink-0">
                <PageTabs tabs={tabs} value={activeTab} onValueChange={setActiveTab} />
              </div>

              {activeTab === 'overview' && comparison && (
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <ComparisonOverview
                    evalIds={evalIds}
                    metricIds={metricIds}
                    comparison={comparison}
                    getEvalName={getEvalName}
                  />
                </div>
              )}

              {activeTab === 'samples' && comparison && (comparison.samples?.length ?? 0) > 0 && (
                <ComparisonSamples
                  samples={comparison.samples}
                  evalIds={evalIds}
                  metricIds={metricIds}
                  getEvalName={getEvalName}
                />
              )}
            </div>
          )}

          <DialogFooter className="px-6 py-4 shrink-0">
            <DialogClose asChild>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </DialogClose>
            <Button onClick={exportComparison} className="gap-1.5">
              <Download className="size-3.5" />
              Export JSON
            </Button>
          </DialogFooter>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
}
