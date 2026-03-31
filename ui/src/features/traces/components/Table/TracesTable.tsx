import { TracesTableHeader } from './TracesTableHeader';
import { TracesTableRow } from './TracesTableRow';
import type { TraceItem } from '@/types/analyticsType';
import { Table, TableBody } from '@/components/ui/table';

interface TracesTableProps {
  traces: TraceItem[];
  expandedRows: Record<string, boolean>;
  onToggleExpand: (id: string, e: React.MouseEvent) => void;
  onSelectTrace: (trace: TraceItem) => void;
}

export function TracesTable({
  traces,
  expandedRows,
  onToggleExpand,
  onSelectTrace,
}: TracesTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TracesTableHeader />
        <TableBody>
          {traces.map((trace, index) => (
            <TracesTableRow
              key={trace.id}
              trace={trace}
              index={index}
              isExpanded={expandedRows[trace.id]}
              onToggleExpand={onToggleExpand}
              onSelect={onSelectTrace}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
