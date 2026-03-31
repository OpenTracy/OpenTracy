import type { LucideIcon } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { FilterSection } from './FilterSection';

interface RangeSliderProps {
  label: string;
  icon?: LucideIcon;
  min: number;
  max: number;
  valueMin: number | null;
  valueMax: number | null;
  onMinChange: (value: number) => void;
  onMaxChange: (value: number) => void;
  step?: number;
  formatValue?: (value: number) => string;
}

export function RangeSlider({
  label,
  icon,
  min,
  max,
  valueMin,
  valueMax,
  onMinChange,
  onMaxChange,
  step = 1,
  formatValue = (v) => v.toString(),
}: RangeSliderProps) {
  const currentMin = valueMin ?? min;
  const currentMax = valueMax ?? max;

  const handleValueChange = (values: number[]) => {
    if (values[0] !== currentMin) onMinChange(values[0]);
    if (values[1] !== currentMax) onMaxChange(values[1]);
  };

  return (
    <FilterSection label={label} icon={icon}>
      <div className="rounded-lg border border-border px-3 py-2.5 space-y-2.5">
        <Slider
          min={min}
          max={max}
          step={step}
          value={[currentMin, currentMax]}
          onValueChange={handleValueChange}
        />
        <div className="flex justify-between">
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatValue(currentMin)}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatValue(currentMax)}
          </span>
        </div>
      </div>
    </FilterSection>
  );
}
