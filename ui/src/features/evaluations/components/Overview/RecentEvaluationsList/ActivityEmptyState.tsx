import { Activity } from 'lucide-react';
import { Empty, EmptyHeader, EmptyMedia, EmptyDescription } from '@/components/ui/empty';

export function ActivityEmptyState() {
  return (
    <Empty className="flex-1 border-0 p-4">
      <EmptyHeader>
        <EmptyMedia>
          <Activity className="size-8 text-muted-foreground/20" />
        </EmptyMedia>
        <EmptyDescription>No evaluations yet</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
