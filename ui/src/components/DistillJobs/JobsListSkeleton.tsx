import { Skeleton } from '@/components/ui/skeleton';

interface JobsListSkeletonProps {
  count?: number;
}

export function JobsListSkeleton({ count = 5 }: JobsListSkeletonProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <JobCardSkeleton key={index} />
      ))}
    </div>
  );
}

function JobCardSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border border-border">
      <div className="shrink-0">
        <Skeleton className="size-5 rounded-full" />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="size-4" />
      </div>
    </div>
  );
}
