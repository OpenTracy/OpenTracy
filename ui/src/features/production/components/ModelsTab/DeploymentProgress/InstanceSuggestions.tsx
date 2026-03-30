import { HardDrive } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { INSTANCE_TYPES } from '@/features/production/constants/instanceTypes';

interface AlternativeInstancePickerProps {
  selectedInstanceId?: string;
  availableInstanceIds: string[];
  onSelectAlternative: (instanceId: string) => void;
}

export function InstanceSuggestions({
  selectedInstanceId,
  availableInstanceIds,
  onSelectAlternative,
}: AlternativeInstancePickerProps) {
  const alternatives = INSTANCE_TYPES.filter(
    (inst) => inst?.id && availableInstanceIds.includes(inst.id) && inst.id !== selectedInstanceId
  ).slice(0, 3);

  if (alternatives.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <HardDrive className="w-4 h-4 text-muted-foreground" />
        <p className="text-sm font-medium">Try an instance with more VRAM</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {alternatives.map((instance) => (
          <Card
            key={instance.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelectAlternative(instance.id)}
            onKeyDown={(e) => e.key === 'Enter' && onSelectAlternative(instance.id)}
            className="cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <CardContent className="p-3">
              <Badge variant="outline" className="mb-2 text-xs">
                {instance.id}
              </Badge>
              <p className="text-sm font-medium leading-tight">{instance.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{instance.specs.vram} VRAM</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
