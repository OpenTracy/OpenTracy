import { useState, useEffect, useCallback } from 'react';
import { Sparkles, SkipForward, SendHorizontal } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import type { AnnotationQueue, AnnotationItem } from '../../types/evaluationsTypes';

interface AnnotationInterfaceProps {
  open: boolean;
  onClose: () => void;
  queue: AnnotationQueue | null;
  items: AnnotationItem[];
  currentItem: AnnotationItem | null;
  onSubmit: (itemId: string, scores: Record<string, number>, notes?: string) => void;
  onSkip: (itemId: string) => void;
  onLoadNext: () => void;
}

export function AnnotationInterface({
  open,
  onClose,
  queue,
  items,
  currentItem,
  onSubmit,
  onSkip,
  onLoadNext,
}: AnnotationInterfaceProps) {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [visibleReasoning, setVisibleReasoning] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!currentItem || !queue) return;

    const initial: Record<string, number> = {};
    queue.rubric.criteria.forEach((c) => {
      const aiScore = currentItem.ai_pre_scores?.[c.id]?.score;
      initial[c.id] = aiScore ?? Math.round((c.scale.min + c.scale.max) / 2);
    });
    setScores(initial);
    setNotes('');
    setVisibleReasoning({});
  }, [currentItem, queue]);

  const handleSubmit = useCallback(() => {
    if (!currentItem) return;
    onSubmit(currentItem.id, scores, notes || undefined);
    onLoadNext();
  }, [currentItem, scores, notes, onSubmit, onLoadNext]);

  const handleSkip = useCallback(() => {
    if (!currentItem) return;
    onSkip(currentItem.id);
    onLoadNext();
  }, [currentItem, onSkip, onLoadNext]);

  if (!queue) return null;

  const completedCount = items.filter((i) => i.status === 'completed').length;
  const totalCount = items.length;
  const currentIndex = currentItem
    ? items.filter((i) => i.status !== 'skipped').findIndex((i) => i.id === currentItem.id) + 1
    : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{queue.name}</DialogTitle>
            <span className="text-xs text-muted-foreground tabular-nums">
              {completedCount}/{totalCount} completed
            </span>
          </div>
          {queue.rubric.instructions && (
            <p className="text-xs text-muted-foreground mt-1">{queue.rubric.instructions}</p>
          )}
        </DialogHeader>

        {!currentItem ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm font-medium">No more items to annotate</p>
              <p className="text-xs text-muted-foreground mt-1">
                All items have been completed or skipped
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex gap-4 py-4">
            <ScrollArea className="flex-3 min-w-0">
              <div className="space-y-4 pr-4">
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Input
                  </Label>
                  <div className="rounded-lg border bg-muted p-3 mt-2">
                    <p className="text-sm whitespace-pre-wrap">{currentItem.input}</p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      Model Output
                    </Label>
                    {currentItem.model_id && (
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {currentItem.model_id}
                      </Badge>
                    )}
                  </div>
                  <div className="rounded-lg border bg-muted p-3 mt-2">
                    <p className="text-sm whitespace-pre-wrap">{currentItem.output}</p>
                  </div>
                </div>

                {currentItem.expected_output && (
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      Expected Output
                    </Label>
                    <div className="rounded-lg border bg-muted p-3 mt-2">
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {currentItem.expected_output}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <Separator orientation="vertical" />

            <ScrollArea className="flex-2 min-w-0">
              <div className="space-y-5 pl-1">
                {queue.rubric.criteria.map((criterion) => {
                  const aiPreScore = currentItem.ai_pre_scores?.[criterion.id];
                  const currentScore = scores[criterion.id] ?? criterion.scale.min;

                  return (
                    <div key={criterion.id}>
                      <div className="flex items-center justify-between mb-1">
                        <h5 className="text-sm font-medium">{criterion.name}</h5>
                        {aiPreScore && (
                          <button
                            onClick={() =>
                              setVisibleReasoning((prev) => ({
                                ...prev,
                                [criterion.id]: !prev[criterion.id],
                              }))
                            }
                            className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md border text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Sparkles className="size-3" />
                            AI: {aiPreScore.score}
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{criterion.description}</p>

                      {aiPreScore && visibleReasoning[criterion.id] && (
                        <div className="bg-muted rounded-md border p-2 mb-2">
                          <p className="text-[11px] text-muted-foreground italic">
                            {aiPreScore.reasoning}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground tabular-nums w-4 text-center">
                          {criterion.scale.min}
                        </span>
                        <Slider
                          value={[currentScore]}
                          min={criterion.scale.min}
                          max={criterion.scale.max}
                          step={1}
                          onValueChange={([val]) =>
                            setScores((prev) => ({ ...prev, [criterion.id]: val }))
                          }
                          className="flex-1"
                        />
                        <span className="text-xs text-muted-foreground tabular-nums w-4 text-center">
                          {criterion.scale.max}
                        </span>
                        <span className="text-sm font-medium tabular-nums w-6 text-center">
                          {currentScore}
                        </span>
                      </div>

                      {criterion.scale.labels && (
                        <div className="flex justify-between mt-1">
                          {Object.entries(criterion.scale.labels).map(([val, label]) => (
                            <span key={val} className="text-[10px] text-muted-foreground">
                              {label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                <div>
                  <Label htmlFor="annotation-notes" className="text-sm font-medium">
                    Notes
                  </Label>
                  <Textarea
                    id="annotation-notes"
                    placeholder="Optional notes about this annotation..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="text-sm mt-1.5"
                  />
                </div>
              </div>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          <span className="text-xs text-muted-foreground mr-auto tabular-nums">
            Item {currentIndex} of {totalCount}
          </span>
          <Button variant="outline" size="sm" onClick={handleSkip} disabled={!currentItem}>
            <SkipForward className="size-3.5" />
            Skip
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!currentItem}>
            <SendHorizontal className="size-3.5" />
            Submit & Next
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
