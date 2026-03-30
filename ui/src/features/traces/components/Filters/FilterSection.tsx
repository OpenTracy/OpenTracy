import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface FilterSectionProps {
  label: string;
  icon: LucideIcon;
  badge?: number;
  children: React.ReactNode;
}

export function FilterSection({ label, icon: Icon, badge, children }: FilterSectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>
        {badge !== undefined && badge > 0 && <Badge variant="secondary">{badge}</Badge>}
      </div>
      {children}
    </div>
  );
}
