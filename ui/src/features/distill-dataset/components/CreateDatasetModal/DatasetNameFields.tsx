import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DatasetNameFieldsProps {
  name: string;
  description: string;
  disabled: boolean;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  nameRequired?: boolean;
  namePlaceholder?: string;
}

export function DatasetNameFields({
  name,
  description,
  disabled,
  onNameChange,
  onDescriptionChange,
  inputRef,
  nameRequired = false,
  namePlaceholder = 'Auto-generated if empty',
}: DatasetNameFieldsProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>{nameRequired ? 'Name *' : 'Name'}</Label>
        <Input
          ref={inputRef}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={nameRequired ? 'e.g. Customer Support Q&A' : namePlaceholder}
          required={nameRequired}
          disabled={disabled}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Input
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Optional description"
          disabled={disabled}
        />
      </div>
    </div>
  );
}
