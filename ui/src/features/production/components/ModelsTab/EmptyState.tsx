import { Rocket } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty';

interface DeploymentEmptyStateProps {
  onBrowseLibrary: () => void;
}

export function DeploymentEmptyState({ onBrowseLibrary }: DeploymentEmptyStateProps) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Rocket />
        </EmptyMedia>
        <div>
          <EmptyTitle>No models in production</EmptyTitle>
          <EmptyDescription>
            Deploy your first model to start serving predictions at lower cost and latency.
          </EmptyDescription>
        </div>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onBrowseLibrary} size="lg">
          Browse Model Library
        </Button>
      </EmptyContent>
    </Empty>
  );
}
