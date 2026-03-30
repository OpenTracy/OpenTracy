import { useMemo } from 'react';
import { Activity, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ActivityRow } from './ActivityRow';
import { ActivityEmptyState } from './ActivityEmptyState';
import type { RecentEvaluationsListProps } from './types';

const MAX_VISIBLE = 8;

export function RecentEvaluationsList({
  evaluations,
  onViewResults,
  onCancel,
  onDelete,
  onViewAll,
}: RecentEvaluationsListProps) {
  const sorted = useMemo(
    () =>
      [...evaluations]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, MAX_VISIBLE),
    [evaluations]
  );

  const runningCount = useMemo(
    () =>
      evaluations.filter(
        (e) => e.status === 'running' || e.status === 'starting' || e.status === 'queued'
      ).length,
    [evaluations]
  );

  const hasMore = evaluations.length > MAX_VISIBLE;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-muted-foreground" />
            <CardTitle>Activity</CardTitle>
          </div>
          {runningCount > 0 && (
            <Badge variant="secondary" className="text-xs gap-1.5">
              <span className="relative flex size-1.5">
                <span className="animate-ping absolute inline-flex size-full rounded-full bg-primary/50" />
                <span className="relative inline-flex rounded-full size-1.5 bg-primary" />
              </span>
              {runningCount} running
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs">
          Recent evaluation runs and their status
        </CardDescription>
      </CardHeader>

      <CardContent>
        {sorted.length === 0 ? (
          <ActivityEmptyState />
        ) : (
          <div role="list">
            {sorted.map((evaluation) => (
              <ActivityRow
                key={evaluation.id}
                evaluation={evaluation}
                onViewResults={onViewResults}
                onCancel={onCancel}
                onDelete={onDelete}
              />
            ))}
            {hasMore && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 w-full text-xs text-muted-foreground hover:text-foreground"
                onClick={onViewAll}
              >
                View all {evaluations.length} evaluations
                <ArrowRight className="size-3 ml-1" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
