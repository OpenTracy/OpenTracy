import { useState, useEffect } from 'react';
import { Download, Loader2, Calendar, Database, Users, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AnnotationAnalytics, AnnotationQueue } from '../../types/evaluationsTypes';

interface QueueDetailDialogProps {
  open: boolean;
  onClose: () => void;
  queue: AnnotationQueue | null;
  onLoadAnalytics: (queueId: string) => Promise<AnnotationAnalytics | null>;
  onExport: (queueId: string) => void;
}

function KappaInterpretation({ value }: { value: number }) {
  if (value >= 0.81) return <span className="text-xs text-emerald-600">Almost perfect</span>;
  if (value >= 0.61) return <span className="text-xs text-emerald-600">Substantial</span>;
  if (value >= 0.41) return <span className="text-xs text-amber-600">Moderate</span>;
  if (value >= 0.21) return <span className="text-xs text-amber-600">Fair</span>;
  if (value >= 0) return <span className="text-xs text-muted-foreground">Slight</span>;
  return <span className="text-xs text-destructive">Poor</span>;
}

function DistributionBar({
  distribution,
  scaleMin,
  scaleMax,
}: {
  distribution: Record<string, number>;
  scaleMin: number;
  scaleMax: number;
}) {
  const total = Object.values(distribution).reduce((s, v) => s + v, 0);
  if (total === 0) return null;

  const scores = Array.from({ length: scaleMax - scaleMin + 1 }, (_, i) => ({
    score: scaleMin + i,
    count: distribution[String(scaleMin + i)] || 0,
  }));
  const maxCount = Math.max(...scores.map((s) => s.count));

  return (
    <div className="flex items-end gap-1 h-16">
      {scores.map(({ score, count }) => (
        <div key={score} className="flex-1 flex flex-col items-center gap-0.5">
          <span className="text-[10px] text-muted-foreground tabular-nums">{count}</span>
          <div
            className="w-full rounded-t bg-primary/80 dark:bg-primary/60 transition-all"
            style={{
              height: maxCount > 0 ? `${(count / maxCount) * 40}px` : '0px',
              minHeight: count > 0 ? '2px' : '0px',
            }}
          />
          <span className="text-[10px] text-muted-foreground tabular-nums">{score}</span>
        </div>
      ))}
    </div>
  );
}

export function QueueDetailDialog({
  open,
  onClose,
  queue,
  onLoadAnalytics,
  onExport,
}: QueueDetailDialogProps) {
  const [analytics, setAnalytics] = useState<AnnotationAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !queue) return;

    setLoading(true);
    setError(null);
    setAnalytics(null);

    onLoadAnalytics(queue.id)
      .then(setAnalytics)
      .catch((err) => setError(err.message || 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [open, queue, onLoadAnalytics]);

  if (!queue) return null;

  const criteria = queue.rubric?.criteria ?? [];
  const hasAnnotations = queue.completed_items > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0">
        <DialogHeader className="flex flex-row items-start justify-between">
          <div className="space-y-1.5">
            <DialogTitle>{queue.name}</DialogTitle>
            {queue.description && (
              <p className="text-sm text-muted-foreground font-normal">{queue.description}</p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {queue.dataset_name && (
                <span className="flex items-center gap-1">
                  <Database className="size-3" />
                  {queue.dataset_name}
                </span>
              )}
              {queue.created_at && (
                <span className="flex items-center gap-1">
                  <Calendar className="size-3" />
                  {new Date(queue.created_at).toLocaleDateString()}
                </span>
              )}
              {queue.annotators?.length > 0 && (
                <span className="flex items-center gap-1">
                  <Users className="size-3" />
                  {queue.annotators.length} annotator
                  {queue.annotators.length !== 1 && 's'}
                </span>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-6 pr-2 pt-4">
            {criteria.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Rubric Criteria
                </h4>
                <div className="space-y-2">
                  {criteria.map((c) => (
                    <div
                      key={c.id || c.name}
                      className="rounded-md bg-muted/50 dark:bg-muted/30 px-3 py-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">{c.name}</span>
                        <Badge variant="secondary" className="text-[11px]">
                          {c.scale.min}–{c.scale.max}
                        </Badge>
                      </div>
                      {c.description && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{c.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hasAnnotations && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Analytics
                </h4>

                {loading && (
                  <div className="flex justify-center py-8">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                )}

                {error && <p className="text-sm text-destructive py-4">{error}</p>}

                {analytics && !loading && (
                  <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                      <strong className="text-foreground">{analytics.total_annotated}</strong> items
                      annotated
                    </p>

                    {criteria.map((criterion) => {
                      const stats =
                        analytics.criteria[criterion.id] || analytics.criteria[criterion.name];
                      if (!stats) return null;

                      return (
                        <div
                          key={criterion.id}
                          className="rounded-lg bg-muted/50 dark:bg-muted/30 p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <h5 className="text-sm font-medium">{criterion.name}</h5>
                            {stats.mean != null && (
                              <span className="text-sm font-semibold tabular-nums">
                                avg {stats.mean}
                              </span>
                            )}
                          </div>

                          {stats.mean != null && (
                            <div className="flex gap-4 text-xs text-muted-foreground">
                              <span>
                                Median: <strong className="text-foreground">{stats.median}</strong>
                              </span>
                              <span>
                                Std Dev:{' '}
                                <strong className="text-foreground">{stats.std_dev}</strong>
                              </span>
                              <span>
                                Range:{' '}
                                <strong className="text-foreground">
                                  {stats.min}–{stats.max}
                                </strong>
                              </span>
                            </div>
                          )}

                          {stats.distribution && Object.keys(stats.distribution).length > 0 && (
                            <DistributionBar
                              distribution={stats.distribution}
                              scaleMin={criterion.scale.min}
                              scaleMax={criterion.scale.max}
                            />
                          )}
                        </div>
                      );
                    })}

                    {analytics.agreement && (
                      <div className="space-y-3">
                        <h5 className="text-sm font-medium">Inter-Annotator Agreement</h5>
                        <div className="rounded-lg bg-muted/50 dark:bg-muted/30 p-4">
                          <div className="flex gap-4 text-xs text-muted-foreground mb-4">
                            <span>
                              Compared queues:{' '}
                              <strong className="text-foreground">
                                {analytics.agreement.compared_queues?.length ?? 0}
                              </strong>
                            </span>
                            <span>
                              Overlapping samples:{' '}
                              <strong className="text-foreground">
                                {analytics.agreement.overlapping_samples}
                              </strong>
                            </span>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Criterion</TableHead>
                                <TableHead className="text-xs text-right">Agreement</TableHead>
                                <TableHead className="text-xs text-right">Cohen&apos;s κ</TableHead>
                                <TableHead className="text-xs text-right">Interpretation</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {criteria.map((criterion) => {
                                const key =
                                  criterion.id in analytics.agreement!.cohens_kappa
                                    ? criterion.id
                                    : criterion.name;
                                const kappa = analytics.agreement!.cohens_kappa[key];
                                const pct = analytics.agreement!.percent_agreement[key];
                                if (kappa == null) return null;

                                return (
                                  <TableRow key={criterion.id}>
                                    <TableCell>{criterion.name}</TableCell>
                                    <TableCell className="text-right tabular-nums">
                                      {Math.round(pct * 100)}%
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                      {kappa}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <KappaInterpretation value={kappa} />
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}

                    {!analytics.agreement && (
                      <p className="text-xs text-muted-foreground">
                        Inter-annotator agreement is available when multiple queues share the same
                        dataset.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          {hasAnnotations && (
            <Button variant="outline" size="sm" onClick={() => onExport(queue.id)}>
              <Download className="size-3.5" />
              Export
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
