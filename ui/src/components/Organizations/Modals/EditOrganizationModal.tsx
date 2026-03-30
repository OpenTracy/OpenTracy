'use client';

import type { FormEvent } from 'react';
import { useState, useEffect } from 'react';
import { FormDialog } from '../../Modals';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Organization {
  id: string;
  name: string;
}

interface Props {
  org: Organization;
  onClose: () => void;
  onSubmit: (id: string, name: string) => void;
  loading?: boolean;
}

export default function EditOrganizationModal({ org, onClose, onSubmit, loading }: Props) {
  const [name, setName] = useState(org.name);

  useEffect(() => {
    setName(org.name);
  }, [org]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) onSubmit(org.id, name.trim());
  };

  if (!org) return null;

  return (
    <FormDialog
      isOpen={true}
      title="Edit Organization"
      submitText="Save"
      cancelText="Cancel"
      onSubmit={handleSubmit}
      onCancel={onClose}
      loading={loading}
    >
      <div className="space-y-2">
        <Label htmlFor="new-name">Organization Name</Label>
        <Input
          id="new-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter new name"
          required
          disabled={loading}
        />
      </div>
    </FormDialog>
  );
}
