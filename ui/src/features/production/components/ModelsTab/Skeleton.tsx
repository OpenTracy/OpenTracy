import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const SKELETON_CARD_COUNT = 6;

function DeploymentCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Skeleton className="h-4 w-36" />
        </CardTitle>
        <CardDescription>
          <Skeleton className="h-3.5 w-28" />
        </CardDescription>
        <CardAction>
          <Skeleton className="h-5 w-16 rounded-full" />
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-2">
        <div className="flex justify-between text-sm">
          <Skeleton className="h-3.5 w-12" />
          <Skeleton className="h-3.5 w-28" />
        </div>
        <div className="flex justify-between text-sm">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3.5 w-24" />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-6 w-24 rounded" />
        </div>
      </CardContent>

      <CardFooter>
        <div className="flex w-full items-center gap-1.5">
          <Skeleton className="h-8 flex-1 rounded-md" />
          <Skeleton className="h-8 flex-1 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </CardFooter>
    </Card>
  );
}

export function DeploymentListSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: SKELETON_CARD_COUNT }).map((_, i) => (
        <DeploymentCardSkeleton key={i} />
      ))}
    </div>
  );
}
