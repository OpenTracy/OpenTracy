'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
import { FormDialog } from '../../Modals';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
  loading?: boolean;
}

export default function CreateOrganizationModal({ visible, onClose, onSubmit, loading }: Props) {
  const [name, setName] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) onSubmit(name.trim());
    setName('');
  };

  return (
    <FormDialog
      isOpen={visible}
      title="Create New Organization"
      submitText="Create"
      cancelText="Cancel"
      onSubmit={handleSubmit}
      onCancel={onClose}
      loading={loading}
    >
      <div className="space-y-2">
        <Label htmlFor="org-name">Organization Name</Label>
        <Input
          id="org-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter organization name"
          required
          disabled={loading}
        />
      </div>
    </FormDialog>
  );
}
