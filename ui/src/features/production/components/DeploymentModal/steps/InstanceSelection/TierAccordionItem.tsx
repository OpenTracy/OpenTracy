import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { TIER_AVATAR_CLASS, type TierGroup } from '../../../../types/instanceSelection.types';
import { VariantItem } from './VariantItem';

interface TierAccordionItemProps {
  group: TierGroup;
  selectedInstanceId: string;
  onInstanceChange: (id: string) => void;
}

export function TierAccordionItem({
  group,
  selectedInstanceId,
  onInstanceChange,
}: TierAccordionItemProps) {
  const { specs } = group.primary;
  const hasSelected = group.instances.some((i) => i.id === selectedInstanceId);
  const hasRecommended = group.instances.some((i) => i.isRecommended);

  return (
    <AccordionItem
      value={group.tier}
      className={cn(
        'rounded-lg border px-4 transition-colors',
        hasSelected ? 'border-primary/30' : 'border-border'
      )}
    >
      <AccordionTrigger className="gap-3 py-3 hover:no-underline">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar size="sm">
            <AvatarFallback className={cn('text-[10px] font-bold', TIER_AVATAR_CLASS[group.tier])}>
              {group.tier}
            </AvatarFallback>
          </Avatar>

          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="text-sm font-semibold">{specs.gpu}</span>
            <Badge variant="secondary" className="text-[10px] font-medium">
              {specs.vram}
            </Badge>
            {hasRecommended && (
              <Badge variant="default" className="text-[10px]">
                Recommended
              </Badge>
            )}
            <Separator orientation="vertical" className="h-3" />
            <Badge variant="outline" className="text-[10px] font-semibold">
              {specs.modelSize}
            </Badge>
            <span className="text-xs text-muted-foreground">from {specs.spotPrice}</span>
          </div>
        </div>
      </AccordionTrigger>

      <AccordionContent className="space-y-2 pb-4">
        {group.instances.map((instance) => (
          <VariantItem
            key={instance.id}
            instance={instance}
            isSelected={selectedInstanceId === instance.id}
            onSelect={() => onInstanceChange(instance.id)}
          />
        ))}
      </AccordionContent>
    </AccordionItem>
  );
}
