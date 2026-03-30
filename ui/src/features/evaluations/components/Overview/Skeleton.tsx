import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export function OverviewSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in-50 duration-300">
      {/* Stats bar */}
      <div className="flex rounded-lg border bg-card divide-x overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 flex-1">
            <Skeleton className="size-4 rounded" />
            <div className="space-y-1.5">
              <Skeleton className="h-2.5 w-12" />
              <Skeleton className="h-5 w-8" />
            </div>
          </div>
        ))}
      </div>

      {/* Activity + Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Card className="lg:col-span-7">
          <CardHeader className="pb-0">
            <div className="flex items-center gap-2">
              <Skeleton className="size-4 rounded" />
              <Skeleton className="h-4 w-16" />
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="divide-y">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 px-3 py-3">
                  <Skeleton className="size-3.5 rounded-full mt-1" />
                  <div className="flex-1 space-y-1.5">
                    <div className="flex justify-between">
                      <Skeleton className="h-3.5 w-40" />
                      <Skeleton className="h-3 w-10" />
                    </div>
                    <Skeleton className="h-2.5 w-24" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Skeleton className="size-4 rounded" />
              <Skeleton className="h-4 w-28" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2">
                  <Skeleton className="w-4 h-3" />
                  <div className="flex-1 space-y-1.5">
                    <div className="flex justify-between gap-2">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-3 w-10" />
                    </div>
                    <Skeleton className="h-1 w-full rounded-full" />
                  </div>
                  <Skeleton className="w-10 h-3" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Continuous Eval */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="size-4 rounded" />
              <Skeleton className="h-4 w-36" />
            </div>
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
          <Skeleton className="h-3 w-64 mt-1" />
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-2 px-2">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-5 w-9 rounded-full" />
                <Skeleton className="h-3.5 w-10 ml-auto" />
                <Skeleton className="size-7 rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Proposals */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Skeleton className="size-4 rounded" />
            <Skeleton className="h-4 w-24" />
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-1">
          <div className="divide-y">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 py-2.5 px-1">
                <Skeleton className="size-4 rounded mt-0.5" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-44" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Suggested Actions */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="size-3.5 rounded" />
          <Skeleton className="h-3 w-28" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-3.5 flex flex-col gap-2.5">
                <Skeleton className="size-7 rounded-md" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-full" />
                </div>
                <Skeleton className="h-3 w-10" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
