import { CheckCircle, Clock, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { DistillationStatus } from '@/types/distillationTypes';

export const STATUS_CONFIG = {
  pending: {
    icon: Clock,
    label: 'Pending',
    badgeVariant: 'outline' as const,
    iconColor: 'text-muted-foreground',
  },
  queued: {
    icon: Clock,
    label: 'Queued',
    badgeVariant: 'outline' as const,
    iconColor: 'text-muted-foreground',
  },
  running: {
    icon: Loader2,
    label: 'Running',
    badgeVariant: 'secondary' as const,
    iconColor: 'text-muted-foreground',
    animated: true,
  },
  completed: {
    icon: CheckCircle,
    label: 'Completed',
    badgeVariant: 'default' as const,
    iconColor: 'text-foreground',
  },
  failed: {
    icon: AlertCircle,
    label: 'Failed',
    badgeVariant: 'destructive' as const,
    iconColor: 'text-destructive',
  },
  cancelled: {
    icon: XCircle,
    label: 'Cancelled',
    badgeVariant: 'outline' as const,
    iconColor: 'text-muted-foreground',
  },
} as const satisfies Record<
  DistillationStatus,
  {
    icon: typeof CheckCircle;
    label: string;
    badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline';
    iconColor: string;
    animated?: boolean;
  }
>;
