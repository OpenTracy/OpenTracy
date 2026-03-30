import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type StatusValue = 'all' | 'success' | 'error';

interface StatusButtonsProps {
  value: StatusValue;
  onChange: (value: StatusValue) => void;
}

const STATUS_OPTIONS: { value: StatusValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'success', label: 'Success' },
  { value: 'error', label: 'Errors' },
];

export function StatusButtons({ value, onChange }: StatusButtonsProps) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as StatusValue)}>
      <TabsList>
        {STATUS_OPTIONS.map((option) => (
          <TabsTrigger key={option.value} value={option.value} className="text-xs">
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
