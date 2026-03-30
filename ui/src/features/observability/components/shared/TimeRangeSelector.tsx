import { Calendar } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { TIME_RANGE_OPTIONS, type TimeRange } from '../../constants';

interface TimeRangeSelectorProps {
  value: number;
  onChange: (days: TimeRange) => void;
}

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Calendar className="size-3.5" />
        <span className="hidden sm:inline">Period:</span>
      </div>
      <div className="inline-flex items-center gap-0.5 rounded-lg border bg-muted/50 p-0.5">
        {TIME_RANGE_OPTIONS.map((option) => (
          <Button
            key={option}
            size="sm"
            variant={value === option ? 'default' : 'ghost'}
            className={`h-7 px-3 text-xs font-medium transition-all ${
              value === option ? 'shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => onChange(option)}
          >
            {option} days
          </Button>
        ))}
      </div>
    </div>
  );
}
