import { Skeleton } from '@/components/ui/skeleton';

function ListRowSkeleton() {
  return (
    <div className="flex items-center gap-2.5 rounded-md bg-muted py-3 px-4">
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3.5 w-56" />
      </div>
      <Skeleton className="size-8 rounded-md" />
    </div>
  );
}

interface ListSkeletonProps {
  /** Number of skeleton rows to show (default: 6) */
  rows?: number;
  /** Whether to show a create button skeleton next to the search bar */
  showCreateButton?: boolean;
  /** Whether to show filter tabs below the search bar */
  showFilters?: boolean;
}

export function ListSkeleton({
  rows = 6,
  showCreateButton = false,
  showFilters = false,
}: ListSkeletonProps) {
  return (
    <div className="space-y-4 animate-in fade-in-50 duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
          <Skeleton className="h-9 flex-1 max-w-sm" />
          {showCreateButton && <Skeleton className="h-9 w-36" />}
        </div>

        {showFilters && (
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-14" />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <ListRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
