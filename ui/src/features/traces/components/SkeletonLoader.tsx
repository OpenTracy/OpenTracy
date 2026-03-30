import { Skeleton } from '@/components/ui/skeleton';

interface SkeletonProps {
  rows?: number;
  className?: string;
}

export function TableSkeletonLoader({ rows = 5, className = '' }: SkeletonProps) {
  return (
    <div className={`w-full overflow-hidden rounded-lg border ${className}`}>
      <div className="bg-muted px-4 py-3">
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20 hidden 2xl:block" />
          <Skeleton className="h-4 w-20 hidden 2xl:block" />
          <Skeleton className="h-4 w-24 hidden xl:block" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-14 hidden xl:block ml-auto" />
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-4 w-6" />
        </div>
      </div>

      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={`r-${rowIndex}`} className="flex items-center gap-4 px-4 py-3.5">
            {/* Model */}
            <div className="flex items-center gap-2.5">
              <Skeleton className="size-8 rounded-md shrink-0" />
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <Skeleton className="h-3.5 w-40 hidden 2xl:block" />
            <Skeleton className="h-3.5 w-36 hidden 2xl:block" />
            <Skeleton className="h-3.5 w-28 hidden xl:block" />
            <Skeleton className="h-3.5 w-14" />
            <Skeleton className="h-3.5 w-12 hidden xl:block ml-auto" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="size-5 rounded shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
