'use client';

import { useState } from 'react';
import { FormDialog } from '../../Modals';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface InviteMemberModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (email: string, role: 'ADMIN' | 'MEMBER') => void;
  loading: boolean;
}

export default function InviteMemberModal({
  visible,
  onClose,
  onSubmit,
  loading,
}: InviteMemberModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      onSubmit(email.trim(), role);
      setEmail('');
      setRole('MEMBER');
    }
  };

  return (
    <FormDialog
      isOpen={visible}
      title="Send Invitation"
      description="An invitation will be created for this email address. The recipient will need to accept it to join the organization."
      submitText="Send Invitation"
      cancelText="Cancel"
      onSubmit={handleSubmit}
      onCancel={onClose}
      loading={loading}
    >
      <div className="space-y-2">
        <Label htmlFor="email-input">Email Address</Label>
        <Input
          id="email-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter email address"
          required
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="role-select">Role</Label>
        <select
          id="role-select"
          value={role}
          onChange={(e) => setRole(e.target.value as 'ADMIN' | 'MEMBER')}
          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
          disabled={loading}
        >
          <option value="MEMBER">Member</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>
    </FormDialog>
  );
}
