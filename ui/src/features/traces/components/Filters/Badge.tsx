import { X } from 'lucide-react';
import { Badge as ShadcnBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface FilterBadgeProps {
  label: string;
  onRemove: () => void;
}

export function FilterBadge({ label, onRemove }: FilterBadgeProps) {
  return (
    <ShadcnBadge variant="secondary" className="gap-1 pr-1">
      {label}
      <Button variant="ghost" size="icon-xs" className="size-4 rounded-full" onClick={onRemove}>
        <X className="size-3" />
      </Button>
    </ShadcnBadge>
  );
}
