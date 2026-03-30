import { Pause } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import type { DeploymentData } from '@/types/deploymentTypes';
import { getDeploymentStatus } from '@/features/production/utils/deploymentStatusConfig';

type Props = {
  status: DeploymentData['status'];
};

export const StatusBadge = ({ status }: Props) => {
  const { label, variant, isTransitioning, isPaused } = getDeploymentStatus(status);

  return (
    <Badge variant={variant}>
      {isTransitioning && <Spinner />}
      {isPaused && <Pause />}
      {label}
    </Badge>
  );
};
