import { Beaker } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty';

interface DistilledEmptyStateProps {
  onGoToDistillLab: () => void;
}

export function DistilledEmptyState({ onGoToDistillLab }: DistilledEmptyStateProps) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Beaker />
        </EmptyMedia>
        <div>
          <EmptyTitle>No distilled models yet</EmptyTitle>
          <EmptyDescription>
            Complete a distillation job to see your models here, ready to deploy.
          </EmptyDescription>
        </div>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onGoToDistillLab} size="lg">
          Go to Distill Lab
        </Button>
      </EmptyContent>
    </Empty>
  );
}
