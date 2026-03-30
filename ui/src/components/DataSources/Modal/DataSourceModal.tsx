import { useState, useEffect, useCallback } from 'react';
import { FormDialog } from '../../Modals';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '../../ui/field';

interface DataSourceModalProps {
  readonly name: string | null;
  readonly inputValue: string;
  readonly onChange: (value: string) => void;
  readonly onSave: () => Promise<void>;
  readonly onClose: () => void;
}

export function DataSourceModal({
  name,
  inputValue,
  onChange,
  onSave,
  onClose,
}: DataSourceModalProps) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!name) {
      // Reset when modal closes
    }
  }, [name]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave();
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormDialog
      isOpen={!!name}
      title={`Configure ${name}`}
      description="Enter your API key to connect this provider"
      submitText="Save"
      cancelText="Cancel"
      loading={loading}
      onSubmit={handleSubmit}
      onCancel={handleClose}
    >
      <Field>
        <FieldLabel htmlFor="api-key-input">API Key</FieldLabel>
        <Input
          id="api-key-input"
          type="password"
          placeholder="Enter API key..."
          value={inputValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={loading}
          required
          autoFocus
        />
      </Field>
    </FormDialog>
  );
}
