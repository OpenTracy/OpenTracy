import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';

export function DataSourcesSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Data Sources" />
      <main className="relative max-w-6xl mx-auto px-6 py-10">
        <div className="pointer-events-none absolute -top-12 right-4 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />
        <div className="pointer-events-none absolute top-32 -left-10 h-72 w-72 rounded-full bg-foreground/5 blur-3xl" />

        {/* Hero Skeleton */}
        <Card className="relative mb-8">
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-6 w-20" />
              </div>
              <Skeleton className="h-8 w-3/4 mb-3" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-5/6" />
            </div>
            <Skeleton className="h-6 w-32 min-w-fit" />
          </CardContent>
        </Card>

        {/* Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="bg-surface">
              <CardContent className="px-6 py-4">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <Skeleton className="h-4 w-24 mb-2" />
                      <Skeleton className="h-6 w-20" />
                    </div>
                  </div>
                </div>
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
