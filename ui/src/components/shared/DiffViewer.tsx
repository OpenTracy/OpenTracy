import { useState } from 'react';
import { Search, ChevronDown, ChevronRight, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { SampleComparison } from '@/types/distillationTypes';

interface DiffViewerProps {
  comparisons: SampleComparison[];
  teacherLabel?: string;
  studentLabel?: string;
  className?: string;
}

const formatScore = (score: number | null | undefined): string | null => {
  if (score == null || isNaN(score)) return null;
  return `${(score * 100).toFixed(0)}%`;
};

const truncate = (text: string | null | undefined, len = 100) =>
  !text ? '' : text.length > len ? text.slice(0, len) + '\u2026' : text;

export function DiffViewer({
  comparisons,
  teacherLabel = 'Teacher',
  studentLabel = 'Student',
  className,
}: DiffViewerProps) {
  const [search, setSearch] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(0);
  const perPage = 10;

  const filtered = (comparisons ?? []).filter(
    (c) =>
      !search ||
      (c.prompt || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.teacher_response || c.response || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.student_response || '').toLowerCase().includes(search.toLowerCase())
  );

  const paged = filtered.slice(page * perPage, (page + 1) * perPage);
  const totalPages = Math.ceil(filtered.length / perPage);

  const hasAnyStudent = comparisons.some((c) => c.student_response);

  const toggleRow = (idx: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search prompts or responses..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground tabular-nums shrink-0">
          {filtered.length} sample{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-1.5">
        {paged.map((comparison, idx) => {
          const globalIdx = page * perPage + idx;
          const isExpanded = expandedRows.has(globalIdx);
          const score = formatScore(comparison.similarity_score);
          const responseText = comparison.teacher_response || comparison.response || '';

          return (
            <div
              key={globalIdx}
              className={cn(
                'border border-border rounded-lg overflow-hidden transition-colors',
                isExpanded && 'ring-1 ring-ring'
              )}
            >
              <button
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted transition-colors"
                onClick={() => toggleRow(globalIdx)}
              >
                <span className="text-xs font-medium text-muted-foreground tabular-nums w-5 shrink-0 text-right mt-0.5">
                  {globalIdx + 1}
                </span>
                {isExpanded ? (
                  <ChevronDown className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                ) : (
                  <ChevronRight className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm font-medium truncate">{comparison.prompt}</p>
                  {!isExpanded && responseText && (
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      <MessageSquare className="size-3 inline-block mr-1 -mt-px" />
                      {truncate(responseText, 120)}
                    </p>
                  )}
                </div>
                {score && (
                  <Badge
                    variant={(comparison.similarity_score ?? 0) >= 0.85 ? 'secondary' : 'outline'}
                    className="tabular-nums shrink-0 mt-0.5"
                  >
                    {score}
                  </Badge>
                )}
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border bg-muted">
                  <div className="rounded-md border border-border bg-background p-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                      Prompt
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{comparison.prompt}</p>
                  </div>

                  <div className={cn('grid grid-cols-1 gap-3', hasAnyStudent && 'md:grid-cols-2')}>
                    <div className="rounded-md border border-border bg-background p-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                        {hasAnyStudent ? teacherLabel : 'Response'}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{responseText || 'No response'}</p>
                    </div>
                    {hasAnyStudent && (
                      <div className="rounded-md border border-border bg-background p-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                          {studentLabel}
                        </p>
                        <p className="text-sm whitespace-pre-wrap">
                          {comparison.student_response || 'No response'}
                        </p>
                      </div>
                    )}
                  </div>

                  {score && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Similarity:</span>
                      <Badge variant="outline" className="tabular-nums">
                        {((comparison.similarity_score ?? 0) * 100).toFixed(1)}%
                      </Badge>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {paged.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground border border-border rounded-lg">
            No results found
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {page * perPage + 1}&#8211;{Math.min((page + 1) * perPage, filtered.length)} of{' '}
            {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
