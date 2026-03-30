import { Server, Cpu, Box } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { DeploymentWithMetrics } from '../../types';

interface DeploymentInfoProps {
  deployment: DeploymentWithMetrics;
}

interface InfoItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  badge?: { text: string; isActive?: boolean };
}

function InfoItem({ icon: Icon, label, value, badge }: InfoItemProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold">{value}</p>
          {badge && (
            <Badge
              variant="outline"
              className={cn(
                'text-[10px]',
                badge.isActive ? 'border-chart-2/30 bg-chart-2/10 text-chart-2' : ''
              )}
            >
              {badge.text}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

export function DeploymentInfo({ deployment }: DeploymentInfoProps) {
  const statusLower = deployment.status.toLowerCase();
  const isActive = statusLower === 'active' || statusLower === 'in_service';

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <InfoItem icon={Server} label="Deployment Name" value={deployment.name} />
      <InfoItem icon={Box} label="Model" value={deployment.model} />
      <InfoItem
        icon={Cpu}
        label="Instance"
        value={deployment.instance}
        badge={{ text: deployment.status, isActive }}
      />
    </div>
  );
}
