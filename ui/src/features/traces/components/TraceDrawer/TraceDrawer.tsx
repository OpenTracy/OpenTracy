import { AlertCircle } from 'lucide-react';

import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';

import type { TraceItem } from '@/types/analyticsType';
import { useTraceDetails } from '@/hooks/useTraceDetails';

import { TraceDrawerHeader } from './TraceDrawerHeader';
import { OverviewTab } from './OverviewTab';
import { TimelineTab } from './TimelineTab';

function DrawerSkeleton() {
  return (
    <div className="p-4 space-y-4">
      {/* Header: icon + title/description */}
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 rounded-lg" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>
      {/* Tab bar */}
      <Skeleton className="h-8 w-48 rounded-md" />
      {/* 2×2 metrics grid */}
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-14 rounded-md" />
        <Skeleton className="h-14 rounded-md" />
        <Skeleton className="h-14 rounded-md" />
        <Skeleton className="h-14 rounded-md" />
      </div>
      {/* Info rows */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

function DrawerNotFound() {
  return (
    <Empty className="h-64">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <AlertCircle />
        </EmptyMedia>
        <EmptyTitle>Trace not found</EmptyTitle>
        <EmptyDescription>
          This trace may have been removed or is no longer available.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

interface DrawerBodyProps {
  trace: TraceItem;
}

function DrawerBody({ trace }: DrawerBodyProps) {
  const hasTimeline = !!trace.execution_timeline?.length;
  const stepCount = trace.execution_timeline?.length ?? 0;

  return (
    <>
      <TraceDrawerHeader trace={trace} />

      <Tabs
        defaultValue={hasTimeline ? 'timeline' : 'overview'}
        className="flex-1 min-h-0 flex flex-col px-4"
      >
        <TabsList className="w-full border-b border-border rounded-none bg-transparent h-auto p-0 gap-0 justify-start shrink-0">
          <TabsTrigger
            value="overview"
            className="rounded-none border-b-2 border-transparent -mb-px h-9 px-4 text-sm font-medium text-muted-foreground bg-transparent data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none hover:text-foreground transition-colors"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="timeline"
            className="rounded-none border-b-2 border-transparent -mb-px h-9 px-4 text-sm font-medium text-muted-foreground bg-transparent data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none hover:text-foreground transition-colors"
          >
            Timeline
            {stepCount > 0 && (
              <span className="ml-1.5 text-xs font-mono text-muted-foreground">{stepCount}</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex-1 min-h-0 mt-0">
          <OverviewTab trace={trace} />
        </TabsContent>

        <TabsContent value="timeline" className="flex-1 min-h-0 mt-0 flex flex-col">
          <TimelineTab trace={trace} />
        </TabsContent>
      </Tabs>
    </>
  );
}

interface TraceDrawerProps {
  traceId: string | undefined;
  open: boolean;
  onClose: () => void;
}

export function TraceDrawer({ traceId, open, onClose }: TraceDrawerProps) {
  const { trace, loading } = useTraceDetails(open ? traceId : undefined);

  return (
    <Drawer direction="right" open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="max-w-xl w-full">
        {loading ? <DrawerSkeleton /> : !trace ? <DrawerNotFound /> : <DrawerBody trace={trace} />}
      </DrawerContent>
    </Drawer>
  );
}
