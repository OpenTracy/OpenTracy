import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { Dataset } from '../../../types';

interface GeneralStepProps {
  name: string;
  datasetId: string;
  datasets: Dataset[];
  onNameChange: (name: string) => void;
  onDatasetChange: (datasetId: string) => void;
}

export function GeneralStep({
  name,
  datasetId,
  datasets,
  onNameChange,
  onDatasetChange,
}: GeneralStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">General Information</h3>
        <p className="text-sm text-muted-foreground">
          Name this evaluation run and choose the dataset to evaluate against.
        </p>
      </div>

      <FieldSet>
        <FieldLegend variant="label">Configuration</FieldLegend>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="eval-name">Evaluation Name</FieldLabel>
            <Input
              id="eval-name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g. GPT-4 vs Claude on Q&A"
              autoFocus
            />
            <FieldDescription>A descriptive name to identify this evaluation run.</FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="eval-dataset">Dataset</FieldLabel>
            {datasets.length === 0 ? (
              <FieldDescription>No datasets available. Create a dataset first.</FieldDescription>
            ) : (
              <Select value={datasetId} onValueChange={onDatasetChange}>
                <SelectTrigger id="eval-dataset" className="w-full">
                  <SelectValue placeholder="Select a dataset…" />
                </SelectTrigger>
                <SelectContent>
                  {datasets.map((ds) => (
                    <SelectItem key={ds.id} value={ds.id}>
                      {ds.name} ({ds.samples_count} samples)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
        </FieldGroup>
      </FieldSet>
    </div>
  );
}
