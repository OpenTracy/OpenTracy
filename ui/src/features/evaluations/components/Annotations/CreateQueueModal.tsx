import { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Dataset, AnnotationRubric, AnnotationCriterion } from '../../types/evaluationsTypes';

interface CreateQueueDialogProps {
  open: boolean;
  onClose: () => void;
  datasets: Dataset[];
  onCreate: (data: {
    name: string;
    description?: string;
    datasetId: string;
    evaluationId?: string;
    rubric: AnnotationRubric;
  }) => void;
}

const PRESET_CRITERIA: Record<string, Omit<AnnotationCriterion, 'id'>> = {
  quality: {
    name: 'Quality',
    description: 'Overall quality of the response',
    scale: { min: 1, max: 5, labels: { 1: 'Poor', 3: 'Average', 5: 'Excellent' } },
  },
  relevance: {
    name: 'Relevance',
    description: 'How relevant the response is to the input',
    scale: { min: 1, max: 5, labels: { 1: 'Off-topic', 3: 'Partial', 5: 'Fully relevant' } },
  },
  correctness: {
    name: 'Correctness',
    description: 'Is the information factually correct?',
    scale: { min: 0, max: 1, labels: { 0: 'Incorrect', 1: 'Correct' } },
  },
};

export function CreateQueueDialog({ open, onClose, datasets, onCreate }: CreateQueueDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [datasetId, setDatasetId] = useState('');
  const [instructions, setInstructions] = useState('');
  const [criteria, setCriteria] = useState<AnnotationCriterion[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setDescription('');
    setDatasetId(datasets[0]?.id ?? '');
    setInstructions('');
    setCriteria([]);
    setError(null);
  }, [open, datasets]);

  const addPreset = (key: string) => {
    const preset = PRESET_CRITERIA[key];
    if (!preset || criteria.some((c) => c.name === preset.name)) return;
    setCriteria((prev) => [...prev, { ...preset, id: `crit-${Date.now()}-${key}` }]);
  };

  const removeCriterion = (id: string) => {
    setCriteria((prev) => prev.filter((c) => c.id !== id));
  };

  const addCustomCriterion = () => {
    setCriteria((prev) => [
      ...prev,
      { id: `crit-${Date.now()}`, name: '', description: '', scale: { min: 1, max: 5 } },
    ]);
  };

  const updateCriterion = (id: string, updates: Partial<AnnotationCriterion>) => {
    setCriteria((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const handleSubmit = () => {
    if (!name.trim()) return setError('Name is required');
    if (!datasetId) return setError('Dataset is required');
    if (criteria.length === 0) return setError('Add at least one criterion');
    if (criteria.some((c) => !c.name.trim())) return setError('All criteria must have a name');

    onCreate({
      name: name.trim(),
      description: description.trim() || undefined,
      datasetId,
      rubric: { criteria, instructions: instructions.trim() || undefined },
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Annotation Queue</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="queue-name">Name</Label>
            <Input
              id="queue-name"
              placeholder="e.g., Quality Review Q1"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="queue-description">Description</Label>
            <Textarea
              id="queue-description"
              placeholder="What should annotators focus on?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Dataset</Label>
            <Select value={datasetId} onValueChange={setDatasetId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a dataset" />
              </SelectTrigger>
              <SelectContent>
                {datasets.length === 0 && (
                  <SelectItem value="_empty" disabled>
                    No datasets available
                  </SelectItem>
                )}
                {datasets.map((ds) => (
                  <SelectItem key={ds.id} value={ds.id}>
                    {ds.name} ({ds.samples_count} samples)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label>Rubric Criteria</Label>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Quick add:</span>
              {Object.entries(PRESET_CRITERIA).map(([key, preset]) => (
                <Badge
                  key={key}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => addPreset(key)}
                >
                  {preset.name} ({preset.scale.min}–{preset.scale.max})
                </Badge>
              ))}
            </div>

            <div className="space-y-3">
              {criteria.map((criterion) => (
                <div key={criterion.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <Input
                      placeholder="Criterion name"
                      value={criterion.name}
                      onChange={(e) => updateCriterion(criterion.id, { name: e.target.value })}
                      className="h-8 text-sm"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => removeCriterion(criterion.id)}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>

                  <Input
                    placeholder="Description"
                    value={criterion.description}
                    onChange={(e) => updateCriterion(criterion.id, { description: e.target.value })}
                    className="h-8 text-xs"
                  />

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Scale:</span>
                    <Input
                      type="number"
                      value={criterion.scale.min}
                      onChange={(e) =>
                        updateCriterion(criterion.id, {
                          scale: { ...criterion.scale, min: Number(e.target.value) },
                        })
                      }
                      className="h-7 w-16 text-xs"
                    />
                    <span>to</span>
                    <Input
                      type="number"
                      value={criterion.scale.max}
                      onChange={(e) =>
                        updateCriterion(criterion.id, {
                          scale: { ...criterion.scale, max: Number(e.target.value) },
                        })
                      }
                      className="h-7 w-16 text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>

            <Button variant="outline" size="sm" onClick={addCustomCriterion}>
              <Plus className="size-3.5" />
              Add Criterion
            </Button>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="queue-instructions">Instructions for Annotators</Label>
            <Textarea
              id="queue-instructions"
              placeholder="Detailed guidelines for annotators..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Create Queue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
