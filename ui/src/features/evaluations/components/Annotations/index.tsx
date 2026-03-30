import { useState, useCallback } from 'react';
import { Plus, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAnnotations } from '../../hooks/useAnnotations';
import { useDatasets } from '../../../../hooks/useDatasets';
import { QueueCard } from './QueueCard';
import { QueueDetailDialog } from './QueueDetailDialog';
import { CreateQueueDialog } from './CreateQueueModal';
import { AnnotationInterface } from './AnnotationInterface';
import { AnnotationsSkeleton } from './Skeleton';
import type { AnnotationQueue, AnnotationRubric } from '../../types/evaluationsTypes';

export function AnnotationsTab() {
  const {
    queues,
    items,
    currentItem,
    loading,
    loadItems,
    getNextItem,
    createQueue,
    deleteQueue,
    submitAnnotation,
    skipItem,
    exportAnnotations,
    getAnalytics,
  } = useAnnotations();

  const { datasets } = useDatasets();

  const [showCreate, setShowCreate] = useState(false);
  const [activeQueue, setActiveQueue] = useState<AnnotationQueue | null>(null);
  const [detailQueue, setDetailQueue] = useState<AnnotationQueue | null>(null);

  const totalItems = queues.reduce((sum, q) => sum + q.total_items, 0);
  const completedItems = queues.reduce((sum, q) => sum + q.completed_items, 0);
  const completionPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const handleAnnotate = useCallback(
    async (queue: AnnotationQueue) => {
      setActiveQueue(queue);
      await loadItems(queue.id);
    },
    [loadItems]
  );

  const handleCreate = useCallback(
    async (data: {
      name: string;
      description?: string;
      datasetId: string;
      evaluationId?: string;
      rubric: AnnotationRubric;
    }) => {
      await createQueue(data);
      toast.success(`Queue "${data.name}" created`);
    },
    [createQueue]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteQueue(id);
      toast.success('Queue deleted');
    },
    [deleteQueue]
  );

  const handleSubmit = useCallback(
    async (itemId: string, scores: Record<string, number>, notes?: string) => {
      await submitAnnotation(itemId, scores, notes);
      toast.success('Annotation submitted');
    },
    [submitAnnotation]
  );

  const handleLoadNext = useCallback(async () => {
    if (activeQueue) await getNextItem(activeQueue.id);
  }, [activeQueue, getNextItem]);

  const handleExport = useCallback(
    async (queueId: string) => {
      try {
        await exportAnnotations(queueId, 'csv');
        toast.success('Export downloaded');
      } catch {
        toast.error('Failed to export');
      }
    },
    [exportAnnotations]
  );

  if (loading) return <AnnotationsSkeleton />;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Annotation Queues</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {queues.length} queues · {completedItems}/{totalItems} items · {completionPercent}%
              complete
            </p>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="size-4" />
            Create Queue
          </Button>
        </div>

        {queues.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center">
            <ClipboardList className="size-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">No annotation queues yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create a queue to start reviewing and scoring model outputs
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {queues.map((queue) => (
              <QueueCard
                key={queue.id}
                queue={queue}
                onAnnotate={handleAnnotate}
                onDelete={handleDelete}
                onClick={setDetailQueue}
              />
            ))}
          </div>
        )}

        <CreateQueueDialog
          open={showCreate}
          onClose={() => setShowCreate(false)}
          datasets={datasets}
          onCreate={handleCreate}
        />

        <AnnotationInterface
          open={!!activeQueue}
          onClose={() => setActiveQueue(null)}
          queue={activeQueue}
          items={items}
          currentItem={currentItem}
          onSubmit={handleSubmit}
          onSkip={skipItem}
          onLoadNext={handleLoadNext}
        />

        <QueueDetailDialog
          open={!!detailQueue}
          onClose={() => setDetailQueue(null)}
          queue={detailQueue}
          onLoadAnalytics={getAnalytics}
          onExport={handleExport}
        />
      </div>
    </TooltipProvider>
  );
}
