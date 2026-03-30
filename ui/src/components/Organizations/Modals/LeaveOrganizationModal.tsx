'use client';

import { ConfirmDialog } from '../../Modals';

interface Props {
  orgName: string;
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function LeaveOrganizationModal({
  orgName,
  visible,
  onConfirm,
  onCancel,
  loading,
}: Props) {
  return (
    <ConfirmDialog
      isOpen={visible}
      title="Leave Organization"
      description={
        <>
          Are you sure you want to leave <strong>{orgName}</strong>? You will lose access to its
          resources.
        </>
      }
      confirmText="Leave"
      cancelText="Cancel"
      variant="destructive"
      onConfirm={onConfirm}
      onCancel={onCancel}
      loading={loading}
    />
  );
}
