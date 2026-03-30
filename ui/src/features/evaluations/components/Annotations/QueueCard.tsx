import { Play, Pause, CheckCircle, Trash2, PenLine, Database, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { AnnotationQueue } from '../../types/evaluationsTypes';

const STATUS_CONFIG: Record<
  string,
  { icon: typeof Play; label: string; variant: 'default' | 'secondary' | 'outline' }
> = {
  active: { icon: Play, label: 'Active', variant: 'default' },
  paused: { icon: Pause, label: 'Paused', variant: 'secondary' },
  completed: { icon: CheckCircle, label: 'Completed', variant: 'outline' },
};

interface QueueCardProps {
  queue: AnnotationQueue;
  onAnnotate: (queue: AnnotationQueue) => void;
  onDelete: (id: string) => void;
  onClick: (queue: AnnotationQueue) => void;
}

export function QueueCard({ queue, onAnnotate, onDelete, onClick }: QueueCardProps) {
  const done = queue.completed_items + (queue.skipped_items || 0);
  const progress = queue.total_items > 0 ? (done / queue.total_items) * 100 : 0;
  const remaining = queue.total_items - done;
  const status = STATUS_CONFIG[queue.status] ?? STATUS_CONFIG.active;
  const StatusIcon = status.icon;
  const criteriaCount = queue.rubric?.criteria?.length ?? 0;

  return (
    <Card
      className="cursor-pointer transition-colors hover:border-ring/50"
      onClick={() => onClick(queue)}
    >
      <CardHeader>
        <div className="flex items-center gap-2">
          <Badge variant={status.variant}>
            <StatusIcon className="size-3" />
            {status.label}
          </Badge>
          {criteriaCount > 0 && (
            <span className="text-xs text-muted-foreground">{criteriaCount} criteria</span>
          )}
        </div>
        <CardTitle className="text-sm">{queue.name}</CardTitle>
        {queue.description && (
          <CardDescription className="line-clamp-2 text-xs">{queue.description}</CardDescription>
        )}
        <CardAction>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(queue.id);
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-2">
        {queue.dataset_name && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Database className="size-3 shrink-0" />
            {queue.dataset_name}
          </span>
        )}
        <Progress value={progress} className="h-1.5" />
        <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
          <span>
            {queue.completed_items}/{queue.total_items} annotated
          </span>
          <span>{remaining > 0 ? `${remaining} remaining` : `${Math.round(progress)}%`}</span>
        </div>
      </CardContent>

      <CardFooter className="gap-2">
        <Button
          size="sm"
          className="flex-1"
          disabled={queue.status === 'completed'}
          onClick={(e) => {
            e.stopPropagation();
            onAnnotate(queue);
          }}
        >
          <PenLine className="size-3.5" />
          Annotate
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="size-8 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onClick(queue);
              }}
            >
              <BarChart3 className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Details & Analytics</TooltipContent>
        </Tooltip>
      </CardFooter>
    </Card>
  );
}
