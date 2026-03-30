import { Database } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ItemRow } from '@/components/shared/ItemRow';
import { formatRelativeTime } from '../../utils';
import type { Experiment } from '../../types/evaluationsTypes';
import { ListRowActions } from '../shared/ListRowActions';
import { viewAction, deleteAction } from '../shared/listRowActionBuilders';
import { ListStatusBadge } from '../shared/ListStatusBadge';

interface ExperimentRowProps {
  experiment: Experiment;
  onClick: () => void;
  onDelete: (id: string) => void;
}

export function ExperimentRow({ experiment, onClick, onDelete }: ExperimentRowProps) {
  const { status, name, dataset_name, dataset_id, evaluation_ids, created_at, tags } = experiment;

  const isCompleted = status === 'completed';
  const isDimmed = status === 'failed';
  const isClickable = isCompleted;
  const datasetLabel = dataset_name ?? dataset_id;

  const descriptionParts = [
    datasetLabel && (
      <span key="ds" className="inline-flex items-center gap-1">
        <Database className="size-3 shrink-0" />
        {datasetLabel}
      </span>
    ),
    evaluation_ids.length > 0 && (
      <span key="e">
        {evaluation_ids.length} {evaluation_ids.length === 1 ? 'eval' : 'evals'}
      </span>
    ),
    tags && tags.length > 0 && (
      <span key="tags" className="inline-flex items-center gap-1">
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">
            {tag}
          </Badge>
        ))}
      </span>
    ),
    <span key="t" className="tabular-nums">
      {formatRelativeTime(created_at)}
    </span>,
  ].filter(Boolean);

  const actions = [
    viewAction({
      visible: isCompleted,
      onClick,
      label: 'View comparison',
    }),
    deleteAction({
      visible: status !== 'running',
      onClick: () => onDelete(experiment.id),
    }),
  ];

  return (
    <ItemRow
      name={name}
      badge={<ListStatusBadge status={status} />}
      descriptionParts={descriptionParts}
      isClickable={isClickable}
      isDimmed={isDimmed}
      showSpinner={status === 'running'}
      onClick={onClick}
      actions={<ListRowActions actions={actions} />}
    />
  );
}
