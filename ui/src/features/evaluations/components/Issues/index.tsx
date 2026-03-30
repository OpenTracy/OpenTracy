import { useState, useMemo, useCallback } from 'react';
import { Loader2, Radar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchBar } from '@/components/shared/SearchBar';
import { useTraceIssues } from '../../hooks/useTraceIssues';
import { IssueSummaryCards } from './IssueSummaryCards';
import { IssueTable } from './IssueTable';
import { IssueDetailSheet } from './IssueDetailSheet';
import { ProblemsEmpty } from './ProblemsEmpty';
import { ProblemsSkeleton } from './Skeleton';
import { SEVERITY_FILTERS, TYPE_FILTERS } from './constants';
import type { TraceIssue, IssueSeverity, IssueType } from '../../types/evaluationsTypes';
import type { EvalPrefillConfig } from '../../types';

interface ProblemsTabProps {
  onRunEval?: (config: EvalPrefillConfig) => void;
}

export function ProblemsTab({ onRunEval }: ProblemsTabProps) {
  const { issues, scanning, triggerScan, resolveIssue, loading } = useTraceIssues();

  const [selectedIssue, setSelectedIssue] = useState<TraceIssue | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<IssueSeverity | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<IssueType | 'all'>('all');

  const filteredIssues = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return issues.filter((issue) => {
      if (severityFilter !== 'all' && issue.severity !== severityFilter) return false;
      if (typeFilter !== 'all' && issue.type !== typeFilter) return false;
      if (
        term &&
        !issue.title.toLowerCase().includes(term) &&
        !issue.model_id.toLowerCase().includes(term)
      ) {
        return false;
      }
      return true;
    });
  }, [issues, searchTerm, severityFilter, typeFilter]);

  const handleResolve = useCallback(
    (id: string) => {
      resolveIssue(id);
      setSelectedIssue(null);
    },
    [resolveIssue]
  );

  if (loading) return <ProblemsSkeleton />;

  const isEmpty = issues.length === 0;
  const hasResults = filteredIssues.length > 0;

  return (
    <div className="space-y-4 animate-in fade-in-50 duration-300">
      <IssueSummaryCards issues={issues} />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <SearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search issues…"
          filters={
            <>
              <Select
                value={severityFilter}
                onValueChange={(v) => setSeverityFilter(v as IssueSeverity | 'all')}
              >
                <SelectTrigger size="sm" className="w-fit min-w-28">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITY_FILTERS.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={typeFilter}
                onValueChange={(v) => setTypeFilter(v as IssueType | 'all')}
              >
                <SelectTrigger size="sm" className="w-fit min-w-28">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_FILTERS.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          }
        />

        <Button size="sm" onClick={triggerScan} disabled={scanning} className="ml-auto shrink-0">
          {scanning ? <Loader2 className="size-4 animate-spin" /> : <Radar className="size-4" />}
          {scanning ? 'Scanning…' : 'Scan Now'}
        </Button>
      </div>

      {!hasResults ? (
        <ProblemsEmpty isEmpty={isEmpty} />
      ) : (
        <IssueTable
          issues={filteredIssues}
          onViewDetails={setSelectedIssue}
          onResolve={resolveIssue}
        />
      )}

      <IssueDetailSheet
        open={!!selectedIssue}
        onClose={() => setSelectedIssue(null)}
        issue={selectedIssue}
        onResolve={handleResolve}
        onRunEval={onRunEval}
      />
    </div>
  );
}
