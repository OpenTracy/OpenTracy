import { AlertTriangle } from 'lucide-react';
import { ListEmpty } from '../shared/ListEmpty';

interface ProblemsEmptyProps {
  /** true = no issues at all; false = filters produced no results */
  isEmpty: boolean;
}

export function ProblemsEmpty({ isEmpty }: ProblemsEmptyProps) {
  return (
    <ListEmpty
      isEmpty={isEmpty}
      icon={<AlertTriangle />}
      emptyTitle="No issues detected"
      emptyDescription="Run a trace scan to detect potential problems in your model outputs."
      noResultsTitle="No matching issues"
      noResultsDescription="Try adjusting your severity or type filter."
    />
  );
}
