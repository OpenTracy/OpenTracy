import type { LucideIcon } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FilterSection } from './FilterSection';

interface CheckboxGroupProps {
  label: string;
  icon?: LucideIcon;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  formatLabel?: (value: string) => string;
  renderIcon?: (value: string) => React.ReactNode;
}

export function CheckboxGroup({
  label,
  icon,
  options,
  selected,
  onToggle,
  formatLabel = (v) => v,
  renderIcon,
}: CheckboxGroupProps) {
  if (options.length === 0) return null;

  return (
    <FilterSection label={label} icon={icon} count={selected.length}>
      <ScrollArea className="max-h-36">
        <div className="space-y-0.5">
          {options.map((option) => (
            <Label
              key={option}
              className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-normal cursor-pointer hover:bg-accent transition-colors"
            >
              <Checkbox
                checked={selected.includes(option)}
                onCheckedChange={() => onToggle(option)}
              />
              {renderIcon && <span className="shrink-0">{renderIcon(option)}</span>}
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
