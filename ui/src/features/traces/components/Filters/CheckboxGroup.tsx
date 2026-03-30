import type { LucideIcon } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FilterSection } from './FilterSection';

interface CheckboxGroupProps {
  label: string;
  icon: LucideIcon;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  maxHeight?: string;
  formatLabel?: (value: string) => string;
}

export function CheckboxGroup({
  label,
  icon,
  options,
  selected,
  onToggle,
  formatLabel = (v) => v,
}: CheckboxGroupProps) {
  if (options.length === 0) return null;

  return (
    <FilterSection label={label} icon={icon} badge={selected.length}>
      <ScrollArea className="max-h-32">
        <div className="space-y-0.5 rounded-md border bg-background p-1">
          {options.map((option) => (
            <Label
              key={option}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-normal cursor-pointer hover:bg-accent transition-colors"
            >
              <Checkbox
                checked={selected.includes(option)}
                onCheckedChange={() => onToggle(option)}
              />
              <span className="truncate text-foreground" title={option}>
                {formatLabel(option)}
              </span>
            </Label>
          ))}
        </div>
      </ScrollArea>
    </FilterSection>
  );
}
