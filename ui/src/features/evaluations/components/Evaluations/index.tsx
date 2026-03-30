import { SearchBar } from '@/components/shared/SearchBar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EvaluationRow } from './EvaluationRow';
import { EvaluationsEmpty } from './EvaluationsEmpty';
import { STATUS_FILTERS } from '../../constants';
import { EvaluationsSkeleton } from './Skeleton';
import type { EvaluationStatus } from '../../types';
import { useEvaluationsPage } from '../../contexts/useEvaluationsPage';
import { useEvaluationFilters } from '../../hooks/useEvaluationFilters';

export function EvaluationsTab() {
  const {
    evaluations,
    loading,
    handleViewResults,
    setCancellingEvaluation,
    handleDeleteEvaluation,
  } = useEvaluationsPage();

  const { searchTerm, setSearchTerm, statusFilter, setStatusFilter, filtered } =
    useEvaluationFilters(evaluations);

  if (loading) return <EvaluationsSkeleton />;

  const isEmpty = evaluations.length === 0;
  const hasResults = filtered.length > 0;

  return (
    <div className="space-y-4 animate-in fade-in-50 duration-300">
      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Search evaluations…"
        resultCount={filtered.length}
        filters={
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as EvaluationStatus | 'all')}
          >
            <SelectTrigger size="sm" className="w-fit min-w-28">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((filter) => (
                <SelectItem key={filter.id} value={filter.id}>
                  {filter.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        resultCountPosition="outside"
      />

      {!hasResults ? (
        <EvaluationsEmpty isEmpty={isEmpty} />
      ) : (
        <ScrollArea className="max-h-[calc(100vh-280px)]">
          <div className="space-y-2 pr-2">
            {filtered.map((evaluation) => (
              <EvaluationRow
                key={evaluation.id}
                evaluation={evaluation}
                onViewResults={handleViewResults}
                onCancel={setCancellingEvaluation}
                onDelete={handleDeleteEvaluation}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
