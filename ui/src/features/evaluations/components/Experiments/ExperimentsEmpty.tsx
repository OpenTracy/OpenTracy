import { FlaskConical } from 'lucide-react';
import { ListEmpty } from '../shared/ListEmpty';

interface ExperimentsEmptyProps {
  /** true = no experiments exist at all; false = filters produced no results */
  isEmpty: boolean;
  onCreateClick?: () => void;
}

export function ExperimentsEmpty({ isEmpty, onCreateClick }: ExperimentsEmptyProps) {
  return (
    <ListEmpty
      isEmpty={isEmpty}
      icon={<FlaskConical />}
      emptyTitle="No experiments yet"
      emptyDescription="Create an experiment to compare evaluations side-by-side and identify the best model configuration."
      noResultsTitle="No matching experiments"
      noResultsDescription="Try adjusting your search terms."
      createLabel="Create Experiment"
      onCreateClick={onCreateClick}
    />
  );
}
