import { Skeleton } from '@/components/ui/skeleton';

export function BillingSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-surface border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-2">
          <Skeleton className="h-7 w-24 rounded" />
          <Skeleton className="h-4 w-64 rounded" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-6">
        <Skeleton className="h-32 w-full rounded-lg" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>

        <div className="space-y-4">
          <Skeleton className="h-6 w-32 rounded" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </main>
    </div>
  );
}
