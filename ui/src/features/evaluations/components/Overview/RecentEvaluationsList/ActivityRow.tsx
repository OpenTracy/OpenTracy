import type { ReactNode } from 'react';
import { CircleX, Eye, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { StatusIcon } from './StatusIcon';
import { formatRelativeTime } from './utils';
import type { ActivityRowProps } from './types';

function ActionButton({
  tooltip,
  onClick,
  children,
}: {
  tooltip: string;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" className="rounded-full size-7" onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function ActivityRow({ evaluation, onViewResults, onCancel, onDelete }: ActivityRowProps) {
  const isActive = evaluation.status === 'running' || evaluation.status === 'starting';
  const isQueued = evaluation.status === 'queued';
  const isCompleted = evaluation.status === 'completed';
  const isFailed = evaluation.status === 'failed';
  const isDimmed = isFailed || evaluation.status === 'cancelled';

  const progress = evaluation.progress;
  const progressPercent =
    progress && progress.total_samples > 0
      ? Math.round((progress.completed_samples / progress.total_samples) * 100)
      : 0;

  const winner = evaluation.results?.winner;

  return (
    <div
      role="listitem"
      className={cn(
        'group/row flex items-center gap-2.5 py-2.5 px-3 transition-colors hover:bg-muted/40 rounded-sm',
        (isCompleted || isFailed) && 'cursor-pointer'
      )}
      onClick={() => (isCompleted || isFailed) && onViewResults(evaluation)}
    >
      <div className="shrink-0">
        <StatusIcon status={evaluation.status} />
      </div>

      <div className="flex-1 min-w-0">
        <span
          className={cn(
            'text-[13px] leading-5 truncate block',
            isDimmed ? 'text-muted-foreground' : 'font-medium'
          )}
        >
          {evaluation.name}
        </span>

        {isActive && progress && (
          <div className="flex items-center gap-2 mt-0.5">
            <Progress value={progressPercent} className="h-1 flex-1" />
            <span className="text-xs text-muted-foreground tabular-nums">
              {progress.completed_samples}/{progress.total_samples}
            </span>
          </div>
        )}

        {isQueued && <span className="text-xs text-muted-foreground">Queued</span>}

        {isCompleted && winner && (
          <span className="text-xs">
            <span className="font-medium text-chart-2 tabular-nums">
              {(winner.overall_score * 100).toFixed(1)}%
            </span>
            <span className="text-muted-foreground"> · {winner.model}</span>
          </span>
        )}

        {isFailed && evaluation.error && (
          <span className="text-xs text-muted-foreground truncate block">
            {evaluation.error.message}
          </span>
        )}
      </div>

      <div className="relative shrink-0 w-16 h-5">
        <span className="absolute inset-0 flex items-center justify-end text-xs text-muted-foreground/60 tabular-nums whitespace-nowrap transition-opacity group-hover/row:opacity-0">
          {formatRelativeTime(evaluation.created_at)}
        </span>

        <TooltipProvider delayDuration={150}>
          <div
            className="absolute inset-0 flex items-center justify-end gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            {(isCompleted || isFailed) && (
              <ActionButton
                tooltip={isFailed ? 'View error' : 'View results'}
                onClick={() => onViewResults(evaluation)}
              >
                <Eye className="size-3" />
              </ActionButton>
            )}
            {(isActive || isQueued) && (
              <ActionButton
                tooltip="Cancel"
                className="hover:text-destructive"
                onClick={() => onCancel(evaluation)}
              >
                <CircleX className="size-3" />
              </ActionButton>
            )}
            {!isActive && !isQueued && (
              <ActionButton
                tooltip="Delete"
                className="hover:text-destructive"
                onClick={() => onDelete(evaluation)}
              >
                <Trash2 className="size-3" />
              </ActionButton>
            )}
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
}
