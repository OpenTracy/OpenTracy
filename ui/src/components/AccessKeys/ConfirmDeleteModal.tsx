'use client';

import { ConfirmDialog } from '../Modals';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

export function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
}: ConfirmDeleteModalProps) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      title="Delete API Key"
      description="Are you sure you want to delete this API key? This action cannot be undone."
      confirmText="Delete Key"
      cancelText="Cancel"
      variant="destructive"
      onConfirm={onConfirm}
      onCancel={onClose}
      loading={loading}
    />
  );
}
