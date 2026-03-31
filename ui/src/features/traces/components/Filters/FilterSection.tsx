import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface FilterSectionProps {
  label: string;
  icon?: LucideIcon;
  count?: number;
  children: React.ReactNode;
}

export function FilterSection({ label, icon: Icon, count, children }: FilterSectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {Icon && <Icon className="size-3.5 text-muted-foreground" />}
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        {count !== undefined && count > 0 && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
            {count}
          </Badge>
        )}
      </div>
      {children}
    </div>
  );
}
