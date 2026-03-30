import { ClipboardList } from 'lucide-react';
import { ListEmpty } from '../shared/ListEmpty';

interface EvaluationsEmptyProps {
  /** true = no evaluations exist at all; false = filters produced no results */
  isEmpty: boolean;
}

export function EvaluationsEmpty({ isEmpty }: EvaluationsEmptyProps) {
  return (
    <ListEmpty
      isEmpty={isEmpty}
      icon={<ClipboardList />}
      emptyTitle="No evaluations yet"
      emptyDescription="Run your first evaluation to see results here."
      noResultsTitle="No matching evaluations"
      noResultsDescription="Try adjusting your search or status filter."
    />
  );
}
