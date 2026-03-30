import { RefreshCw, BarChart3 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';

interface EmptyStateProps {
  message: string;
  onRefresh: () => void;
}

export function EmptyState({ message, onRefresh }: EmptyStateProps) {
  return (
    <Empty className="min-h-96">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <BarChart3 className="text-muted-foreground/60" />
        </EmptyMedia>
        <EmptyTitle>No data yet</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
      <Button variant="outline" onClick={onRefresh} className="gap-1.5">
        <RefreshCw className="size-3.5" />
        Refresh
      </Button>
    </Empty>
  );
}
