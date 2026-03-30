import { Spinner } from '@/components/ui/spinner';
import type { DistillationStatus } from '@/types/distillationTypes';
import { STATUS_CONFIG } from '../constants';

interface JobStatusIconProps {
  status: DistillationStatus;
}

export function JobStatusIcon({ status }: JobStatusIconProps) {
  const statusConfig = STATUS_CONFIG[status];
  const Icon = statusConfig.icon;
  const isAnimated = 'animated' in statusConfig && statusConfig.animated;

  if (isAnimated) {
    return <Spinner className={statusConfig.iconColor} />;
  }

  return <Icon className={statusConfig.iconColor} />;
}
