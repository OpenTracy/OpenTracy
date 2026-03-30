import { Ruler } from 'lucide-react';
import { ListEmpty } from '../shared/ListEmpty';

interface MetricsEmptyProps {
  isEmpty: boolean;
  onCreateClick?: () => void;
}

export function MetricsEmpty({ isEmpty, onCreateClick }: MetricsEmptyProps) {
  return (
    <ListEmpty
      isEmpty={isEmpty}
      icon={<Ruler />}
      emptyTitle="No metrics yet"
      emptyDescription="Create a custom metric to evaluate your models."
      noResultsTitle="No matching metrics"
      noResultsDescription="Try adjusting your search or type filter."
      createLabel="Create Metric"
      onCreateClick={onCreateClick}
    />
  );
}
