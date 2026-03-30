import type { ReactNode } from 'react';
import { SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';

interface ListEmptyProps {
  /** true = no items at all; false = filters produced no results */
  isEmpty: boolean;
  /** Icon shown in the empty-state media slot */
  icon: ReactNode;
  /** Title when no items exist */
  emptyTitle: string;
  /** Description when no items exist */
  emptyDescription: string;
  /** Title when search/filter yields no results */
  noResultsTitle?: string;
  /** Description when search/filter yields no results */
  noResultsDescription?: string;
  /** CTA label for the create button (only shown when `isEmpty` and `onCreateClick` are set) */
  createLabel?: string;
  /** Callback for the create button */
  onCreateClick?: () => void;
}

export function ListEmpty({
  isEmpty,
  icon,
  emptyTitle,
  emptyDescription,
  noResultsTitle = 'No matching results',
  noResultsDescription = 'Try adjusting your search terms.',
  createLabel = 'Create',
  onCreateClick,
}: ListEmptyProps) {
  if (isEmpty) {
    return (
      <Empty className="border py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">{icon}</EmptyMedia>
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          <EmptyDescription>{emptyDescription}</EmptyDescription>
        </EmptyHeader>
        {onCreateClick && (
          <Button size="sm" onClick={onCreateClick}>
            {createLabel}
          </Button>
        )}
      </Empty>
    );
  }

  return (
    <Empty className="border py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchX />
        </EmptyMedia>
        <EmptyTitle>{noResultsTitle}</EmptyTitle>
        <EmptyDescription>{noResultsDescription}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
