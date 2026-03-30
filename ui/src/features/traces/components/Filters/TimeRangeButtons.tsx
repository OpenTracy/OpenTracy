import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TimeRangeButtonsProps {
  value: string;
  onChange: (value: string) => void;
  options?: string[];
}

const DEFAULT_OPTIONS = ['24h', '7d', '30d', '90d', 'All'];

export function TimeRangeButtons({
  value,
  onChange,
  options = DEFAULT_OPTIONS,
}: TimeRangeButtonsProps) {
  return (
    <Tabs value={value} onValueChange={onChange}>
      <TabsList>
        {options.map((range) => (
          <TabsTrigger key={range} value={range} className="text-xs">
            {range}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
