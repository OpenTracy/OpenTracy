import { Database } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { ItemRow } from '@/components/shared/ItemRow';
import type { Evaluation } from '../../types';
import { formatRelativeTime } from '../../utils';
import { ListRowActions } from '../shared/ListRowActions';
import { viewAction, cancelAction, deleteAction } from '../shared/listRowActionBuilders';
import { ListStatusBadge } from '../shared/ListStatusBadge';

interface EvaluationRowProps {
  evaluation: Evaluation;
  onViewResults?: (evaluation: Evaluation) => void;
  onCancel?: (evaluation: Evaluation) => void;
  onDelete?: (evaluation: Evaluation) => void;
}

export function EvaluationRow({
  evaluation,
  onViewResults,
  onCancel,
  onDelete,
}: EvaluationRowProps) {
  const { status, progress, error, dataset_name, models, metrics, name, created_at } = evaluation;

  const isActive = status === 'running' || status === 'starting';
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';
  const isQueued = status === 'queued';
  const isDimmed = status === 'cancelled';
  const isClickable = (isCompleted || isFailed) && !!onViewResults;

  const progressPercent =
    progress && progress.total_samples > 0
      ? Math.round((progress.completed_samples / progress.total_samples) * 100)
      : 0;

  const modelCount = models?.length ?? 0;
  const metricCount = metrics?.length ?? 0;

  const descriptionParts = [
    dataset_name && (
      <span key="ds" className="inline-flex items-center gap-1">
        <Database className="size-3 shrink-0" />
        {dataset_name}
      </span>
    ),
    modelCount > 0 && (
      <span key="m">
        {modelCount} {modelCount === 1 ? 'model' : 'models'}
      </span>
    ),
    metricCount > 0 && (
      <span key="mt">
        {metricCount} {metricCount === 1 ? 'metric' : 'metrics'}
      </span>
    ),
    <span key="t" className="tabular-nums">
      {formatRelativeTime(created_at)}
    </span>,
  ].filter(Boolean);

  const actions = [
    viewAction({
      visible: (isCompleted || isFailed) && !!onViewResults,
      onClick: () => onViewResults?.(evaluation),
    }),
    cancelAction({
      visible: (isActive || isQueued) && !!onCancel,
      onClick: () => onCancel?.(evaluation),
    }),
    deleteAction({
      visible: !isActive && !isQueued && !!onDelete,
      onClick: () => onDelete?.(evaluation),
    }),
  ];

  // Footer: progress bar or error message
  let footer: React.ReactNode = undefined;
  if (isActive && progress) {
    footer = (
      <div className="flex items-center gap-2 w-full">
        <Progress value={progressPercent} className="h-1 flex-1" />
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          {progress.completed_samples}/{progress.total_samples}
        </span>
      </div>
    );
  } else if (isFailed && error) {
    footer = <p className="text-xs text-destructive truncate">{error.message}</p>;
  }

  return (
    <ItemRow
      name={name}
      badge={<ListStatusBadge status={status} />}
      descriptionParts={descriptionParts}
      isClickable={isClickable}
      isDimmed={isDimmed}
      showSpinner={isQueued || status === 'starting'}
      onClick={() => onViewResults?.(evaluation)}
      actions={<ListRowActions actions={actions} />}
      footer={footer}
    />
  );
}
