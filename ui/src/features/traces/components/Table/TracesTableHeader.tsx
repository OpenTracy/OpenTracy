import { TableHeader, TableRow, TableHead } from '@/components/ui/table';

export function TracesTableHeader() {
  return (
    <TableHeader className="bg-muted">
      <TableRow>
        <TableHead>Model</TableHead>
        <TableHead className="hidden 2xl:table-cell">Input</TableHead>
        <TableHead className="hidden 2xl:table-cell">Output</TableHead>
        <TableHead className="hidden xl:table-cell">Created At</TableHead>
        <TableHead>Latency</TableHead>
        <TableHead className="hidden xl:table-cell text-right">Tokens</TableHead>
        <TableHead>Status</TableHead>
        <TableHead className="w-10" />
      </TableRow>
    </TableHeader>
  );
}
