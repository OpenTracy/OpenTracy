import { Medal } from 'lucide-react';
import { Empty, EmptyHeader, EmptyMedia, EmptyDescription } from '@/components/ui/empty';

interface LeaderboardEmptyStateProps {
  hasCompletedEvals: boolean;
}

export function LeaderboardEmptyState({ hasCompletedEvals }: LeaderboardEmptyStateProps) {
  return (
    <Empty className="flex-1 border-0 p-4">
      <EmptyHeader>
        <EmptyMedia>
          <Medal className="size-8 text-muted-foreground/80" />
        </EmptyMedia>
        <EmptyDescription>
          {hasCompletedEvals
            ? 'Completed evaluations have no score breakdown yet'
            : 'Run evaluations to see rankings'}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
