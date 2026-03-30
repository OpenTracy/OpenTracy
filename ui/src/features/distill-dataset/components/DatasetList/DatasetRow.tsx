import { type MouseEvent } from 'react';
import { ChevronRight, Database, AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ItemRow } from '@/components/shared/ItemRow';
import { Spinner } from '@/components/ui/spinner';
import { formatRelativeTime } from '@/features/evaluations/utils';
import { SourceBadge } from './SourceBadge';
import type { Dataset } from '../../types';

const MIN_SAMPLES = 50;

interface DatasetRowProps {
  dataset: Dataset;
  onClick: () => void;
  onDelete: (dataset: Dataset, event: MouseEvent) => void;
  isDeleting?: boolean;
}

export function DatasetRow({ dataset, onClick, onDelete, isDeleting = false }: DatasetRowProps) {
  const missingSamples = MIN_SAMPLES - dataset.samples_count;
  const needsMoreSamples = dataset.samples_count > 0 && missingSamples > 0;
  const isEmpty = dataset.samples_count === 0;

  const descriptionParts: React.ReactNode[] = [
    <span key="samples" className="inline-flex items-center gap-1 tabular-nums">
      <Database className="size-3 shrink-0" />
      {dataset.samples_count.toLocaleString()} samples
    </span>,
    <span key="time" className="tabular-nums">
      {formatRelativeTime(dataset.updated_at)}
    </span>,
    (needsMoreSamples || isEmpty) && (
      <span key="warn" className="inline-flex items-center gap-1 text-destructive">
        <AlertTriangle className="size-3 shrink-0" />
        {isEmpty ? 'No samples yet' : `Need ${missingSamples} more`}
      </span>
    ),
  ].filter(Boolean) as React.ReactNode[];

  return (
    <ItemRow
      name={dataset.name}
      badge={<SourceBadge source={dataset.source} />}
      descriptionParts={descriptionParts}
      onClick={onClick}
      showSpinner={isDeleting}
      actions={
        <>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 opacity-0 group-hover/item:opacity-100"
            disabled={isDeleting}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(dataset, e);
            }}
            aria-label="Delete dataset"
          >
            {isDeleting ? <Spinner className="size-4" /> : <Trash2 className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            aria-label="Open dataset"
          >
            <ChevronRight className="size-4" />
          </Button>
        </>
      }
    />
  );
}
