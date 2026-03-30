import type { DeploymentData } from '@/types/deploymentTypes';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

type StatusMeta = {
  label: string;
  variant: BadgeVariant;
  isActive?: boolean;
  isPaused?: boolean;
  isDeletable?: boolean;
  isTransitioning?: boolean;
};

const STATUS_CONFIG: Record<DeploymentData['status'], StatusMeta> = {
  active: { label: 'Active', variant: 'secondary', isActive: true },
  in_service: { label: 'Active', variant: 'secondary', isActive: true },

  paused: { label: 'Paused', variant: 'outline', isPaused: true, isDeletable: true },

  failed: { label: 'Failed', variant: 'destructive', isDeletable: true },
  stopped: { label: 'Stopped', variant: 'destructive', isDeletable: true },
  inactive: { label: 'Inactive', variant: 'destructive' },

  pending: { label: 'Pending', variant: 'outline', isTransitioning: true },
  starting: { label: 'Starting', variant: 'outline', isTransitioning: true },
  creating: { label: 'Creating', variant: 'outline', isTransitioning: true },
  updating: { label: 'Updating', variant: 'outline', isTransitioning: true },
  pausing: { label: 'Pausing', variant: 'outline', isTransitioning: true },
  resuming: { label: 'Resuming', variant: 'outline', isTransitioning: true },
  deleting: { label: 'Deleting', variant: 'outline', isTransitioning: true },
};

export function getDeploymentStatus(status: DeploymentData['status']) {
  const meta = STATUS_CONFIG[status];

  return {
    ...meta,
    isActive: !!meta.isActive,
    isPaused: !!meta.isPaused,
    isDeletable: !!meta.isDeletable,
    isTransitioning: !!meta.isTransitioning,
  };
}
