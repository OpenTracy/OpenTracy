import { Skeleton } from '@/components/ui/skeleton';

export function ProblemsSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in-50 duration-300">
      {/* Summary stat bar */}
      <div className="flex rounded-lg border bg-card divide-x overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 flex-1">
            <Skeleton className="size-4 rounded" />
            <div className="space-y-1.5">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-5 w-8" />
            </div>
          </div>
        ))}
      </div>

      {/* Search bar + filters + button */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Skeleton className="h-9 flex-1 max-w-sm" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-32 rounded-md" />
          <Skeleton className="h-8 w-28 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border">
        <div className="flex items-center gap-4 px-4 h-10 bg-muted">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 flex-1 max-w-xs" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-14" />
          <Skeleton className="size-4 w-8" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-4 flex-1 max-w-xs" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-3.5 w-14" />
              <Skeleton className="h-3.5 w-10" />
              <Skeleton className="h-3.5 w-12" />
              <Skeleton className="size-8 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
