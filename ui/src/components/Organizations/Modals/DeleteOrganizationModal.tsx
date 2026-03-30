'use client';

import { ConfirmDialog } from '../../Modals';

interface Props {
  orgName: string;
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function DeleteOrganizationModal({
  orgName,
  visible,
  onConfirm,
  onCancel,
  loading,
}: Props) {
  return (
    <ConfirmDialog
      isOpen={visible}
      title="Delete Organization"
      description={
        <>
          Are you sure you want to delete <strong>{orgName}</strong>? This action cannot be undone.
        </>
      }
      confirmText="Delete"
      cancelText="Cancel"
      variant="destructive"
      onConfirm={onConfirm}
      onCancel={onCancel}
      loading={loading}
    />
  );
}
