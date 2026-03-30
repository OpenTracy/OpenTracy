import { Cpu, HardDrive, Layers, MemoryStick, Network, Server } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Item, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { cn } from '@/lib/utils';
import type { InstanceWithMeta } from '../../../../types/instanceSelection.types';

interface SpecChipProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}

function SpecChip({ icon, label, value }: SpecChipProps) {
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <div className="flex flex-col leading-none">
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-xs font-medium tabular-nums">{value}</span>
      </div>
    </div>
  );
}

interface VariantItemProps {
  instance: InstanceWithMeta;
  isSelected: boolean;
  onSelect: () => void;
}

export function VariantItem({ instance, isSelected, onSelect }: VariantItemProps) {
  const { specs } = instance;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
  }

  return (
    <Item
      variant="outline"
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className={cn(
        'cursor-pointer transition-all duration-200 select-none flex-col items-stretch gap-3',
        isSelected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'hover:border-muted-foreground/30 hover:bg-accent/50'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <ItemContent className="gap-0 min-w-0">
          <ItemTitle className={cn('text-sm', isSelected && 'text-primary font-semibold')}>
            {instance.name}
            <span className="text-[10px] text-muted-foreground font-mono font-normal ml-1">
              {instance.ec2Instance}
            </span>
          </ItemTitle>
          <ItemDescription className="text-xs">{instance.description}</ItemDescription>
        </ItemContent>

        <div className="flex items-center gap-3 shrink-0">
          {instance.isRecommended && (
            <Badge variant="default" className="text-[10px] font-medium">
              Recommended
            </Badge>
          )}
          <Badge
            variant="outline"
            className="text-sm font-semibold text-primary border-primary/30 px-2.5 py-0.5"
          >
            {specs.spotPrice}
          </Badge>
          <Checkbox
            checked={isSelected}
            onCheckedChange={onSelect}
            aria-label={`Select ${instance.name}`}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <SpecChip icon={<Layers className="size-3" />} label="GPUs" value={`${specs.gpuCount}x`} />
        <SpecChip icon={<HardDrive className="size-3" />} label="VRAM" value={specs.vram} />
        <SpecChip icon={<Cpu className="size-3" />} label="vCPUs" value={specs.vCPUs} />
        <SpecChip icon={<MemoryStick className="size-3" />} label="RAM" value={specs.ram} />
        <SpecChip icon={<Server className="size-3" />} label="Storage" value={specs.storage} />
        <SpecChip icon={<Network className="size-3" />} label="Network" value={specs.network} />
      </div>
    </Item>
  );
}
