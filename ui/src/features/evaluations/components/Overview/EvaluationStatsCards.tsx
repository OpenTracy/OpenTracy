import { BarChart3, Loader2, CheckCircle, Target, HeartPulse } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Evaluation, TraceIssue } from '../../types';

interface StatItemProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  tooltip: string;
  muted?: boolean;
  children?: React.ReactNode;
}

function StatItem({ label, value, subtitle, icon, tooltip, muted, children }: StatItemProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'flex items-center gap-3 px-4 py-3 min-w-0 flex-1 cursor-default',
            muted && 'opacity-40'
          )}
        >
          <div className="text-muted-foreground shrink-0">{icon}</div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground leading-none truncate">{label}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-lg font-semibold tabular-nums leading-tight">{value}</p>
              {children}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground leading-none mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="text-xs">{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}

interface EvaluationStatsCardsProps {
  evaluations: Evaluation[];
  traceIssues?: TraceIssue[];
}

export function EvaluationStatsCards({ evaluations, traceIssues }: EvaluationStatsCardsProps) {
  const total = evaluations.length;
  const running = evaluations.filter(
    (e) => e.status === 'running' || e.status === 'queued' || e.status === 'starting'
  ).length;
  const completed = evaluations.filter((e) => e.status === 'completed').length;
  const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const completedWithScores = evaluations.filter(
    (e) => e.status === 'completed' && e.results?.winner?.overall_score != null
  );
  const avgScore =
    completedWithScores.length > 0
      ? completedWithScores.reduce((sum, e) => sum + (e.results!.winner!.overall_score ?? 0), 0) /
        completedWithScores.length
      : 0;
  const avgScorePercent = avgScore * 100;

  const unresolvedIssues = traceIssues?.filter((i) => !i.resolved) ?? [];
  const highCount = unresolvedIssues.filter((i) => i.severity === 'high').length;
  const mediumCount = unresolvedIssues.filter((i) => i.severity === 'medium').length;
  const lowCount = unresolvedIssues.filter((i) => i.severity === 'low').length;
  const hasIssues = traceIssues && traceIssues.length > 0;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-wrap rounded-lg border bg-card divide-x overflow-hidden">
        <StatItem
          label="Total"
          value={total}
          icon={<BarChart3 className="size-4" />}
          tooltip="Total number of evaluations created"
          muted={total === 0}
        />

        <StatItem
          label="Running"
          value={running}
          icon={<Loader2 className={cn('size-4', running > 0 && 'animate-spin text-primary')} />}
          tooltip="Evaluations currently running, queued, or starting"
          muted={running === 0}
        >
          {running > 0 && (
            <span className="relative flex size-1.5">
              <span className="animate-ping absolute inline-flex size-full rounded-full bg-primary/50" />
              <span className="relative inline-flex rounded-full size-1.5 bg-primary" />
            </span>
          )}
        </StatItem>

        <StatItem
          label="Completed"
          value={completed}
          subtitle={total > 0 ? `${successRate}% success` : undefined}
          icon={<CheckCircle className="size-4" />}
          tooltip="Evaluations that finished successfully"
          muted={completed === 0}
        />

        <StatItem
          label="Avg Score"
          value={completedWithScores.length > 0 ? `${avgScorePercent.toFixed(1)}%` : '—'}
          subtitle={
            completedWithScores.length > 0
              ? `${completedWithScores.length} eval${completedWithScores.length !== 1 ? 's' : ''}`
              : 'no data'
          }
          icon={<Target className="size-4" />}
          tooltip="Average overall score across completed evaluations"
          muted={completedWithScores.length === 0}
        />

        {hasIssues && (
          <StatItem
            label="Health"
            value={unresolvedIssues.length}
            subtitle={
              unresolvedIssues.length === 0
                ? 'All clear'
                : `${highCount > 0 ? `${highCount} high` : ''}${highCount > 0 && mediumCount > 0 ? ', ' : ''}${mediumCount > 0 ? `${mediumCount} medium` : ''}${(highCount > 0 || mediumCount > 0) && lowCount > 0 ? ', ' : ''}${lowCount > 0 ? `${lowCount} low` : ''}`
            }
            icon={
              <HeartPulse
                className={cn(
                  'size-4',
                  highCount > 0
                    ? 'text-destructive'
                    : mediumCount > 0
                      ? 'text-muted-foreground'
                      : ''
                )}
              />
            }
            tooltip="Unresolved trace issues detected by AI monitoring"
            muted={unresolvedIssues.length === 0}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
