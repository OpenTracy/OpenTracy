import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Dataset, Evaluation } from '../../types/evaluationsTypes';

interface CreateExperimentModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string, datasetId: string, evaluationIds: string[]) => void;
  datasets: Dataset[];
  evaluations: Evaluation[];
}

export function CreateExperimentModal({
  open,
  onClose,
  onCreate,
  datasets,
  evaluations,
}: CreateExperimentModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [datasetId, setDatasetId] = useState('');
  const [selectedEvals, setSelectedEvals] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const completedEvals = evaluations.filter((e) => e.status === 'completed');

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setDatasetId(datasets[0]?.id ?? '');
      setSelectedEvals([]);
      setError(null);
    }
  }, [open, datasets]);

  const toggleEval = (evalId: string) => {
    setSelectedEvals((prev) =>
      prev.includes(evalId) ? prev.filter((id) => id !== evalId) : [...prev, evalId]
    );
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (selectedEvals.length < 2) {
      setError('Select at least 2 evaluations to compare');
      return;
    }
    onCreate(name.trim(), description.trim(), datasetId, selectedEvals);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Experiment</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="exp-name">Name</Label>
            <Input
              id="exp-name"
              placeholder="e.g., GPT-4o vs Claude comparison"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="exp-description">Description</Label>
            <Textarea
              id="exp-description"
              placeholder="Describe what this experiment compares…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Dataset</Label>
            {datasets.length > 0 ? (
              <Select value={datasetId} onValueChange={setDatasetId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a dataset" />
                </SelectTrigger>
                <SelectContent>
                  {datasets.map((ds) => (
                    <SelectItem key={ds.id} value={ds.id}>
                      {ds.name} ({ds.samples_count} samples)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground">No datasets available</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>
              Evaluations to Compare
              <span className="text-muted-foreground font-normal ml-1">(min 2)</span>
            </Label>

            {completedEvals.length > 0 ? (
              <ScrollArea className="h-48 pr-2">
                <div className="space-y-2">
                  {completedEvals.map((evaluation) => (
                    <label
                      key={evaluation.id}
                      className="flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors has-data-[state=checked]:border-ring has-data-[state=checked]:bg-muted/30"
                    >
                      <Checkbox
                        checked={selectedEvals.includes(evaluation.id)}
                        onCheckedChange={() => toggleEval(evaluation.id)}
                      />
                      <span className="text-sm">{evaluation.name}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <p className="text-sm text-muted-foreground">No completed evaluations available</p>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Create Experiment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
