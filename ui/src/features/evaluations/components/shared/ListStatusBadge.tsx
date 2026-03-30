import { CheckCircle2, XCircle, Clock, Loader2, Ban, FileEdit } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// ---------------------------------------------------------------------------
// All possible statuses across Evaluations & Experiments
// ---------------------------------------------------------------------------

type ListStatus =
  | 'queued'
  | 'starting'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'draft';

type IconName = 'circle-check' | 'circle-x' | 'clock' | 'loader' | 'ban' | 'file-edit';

const ICON_MAP: Record<IconName, React.FC<{ className?: string }>> = {
  'circle-check': CheckCircle2,
  'circle-x': XCircle,
  clock: Clock,
  loader: Loader2,
  ban: Ban,
  'file-edit': FileEdit,
};

interface StatusConfig {
  label: string;
  iconName: IconName;
  badgeClass: string;
  spinner?: boolean;
}

const STATUS_CONFIG: Record<ListStatus, StatusConfig> = {
  queued: {
    label: 'Queued',
    iconName: 'clock',
    badgeClass: 'text-muted-foreground',
  },
  starting: {
    label: 'Starting',
    iconName: 'loader',
    badgeClass: 'text-muted-foreground',
    spinner: true,
  },
  running: {
    label: 'Running',
    iconName: 'loader',
    badgeClass: 'text-blue-600 dark:text-blue-400',
    spinner: true,
  },
  completed: {
    label: 'Completed',
    iconName: 'circle-check',
    badgeClass: 'text-muted-foreground',
  },
  failed: {
    label: 'Failed',
    iconName: 'circle-x',
    badgeClass: 'text-muted-foreground',
  },
  cancelled: {
    label: 'Cancelled',
    iconName: 'ban',
    badgeClass: 'text-muted-foreground',
  },
  draft: {
    label: 'Draft',
    iconName: 'file-edit',
    badgeClass: 'text-muted-foreground',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ListStatusBadgeProps {
  status: ListStatus;
  className?: string;
}

export function ListStatusBadge({ status, className }: ListStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = ICON_MAP[config.iconName];

  let iconClass = 'size-3';
  if (config.spinner) {
    iconClass += ' animate-spin';
  } else if (status === 'completed') {
    iconClass += ' fill-green-500 dark:fill-green-400 text-white dark:text-black';
  } else if (status === 'failed') {
    iconClass += ' fill-red-500 dark:fill-red-400 text-white dark:text-black';
  }

  return (
    <Badge variant="outline" className={`${config.badgeClass} px-1.5 ${className ?? ''}`}>
      <Icon className={iconClass} />
      {config.label}
    </Badge>
  );
}
