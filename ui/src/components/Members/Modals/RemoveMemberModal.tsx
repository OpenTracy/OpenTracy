'use client';

import { ConfirmDialog } from '../../Modals';

interface Props {
  memberName: string;
  type: 'INVITE' | 'MEMBER';
  orgName: string;
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function RemoveMemberModal({
  memberName,
  type,
  orgName,
  visible,
  onConfirm,
  onCancel,
  loading,
}: Props) {
  const title = type === 'INVITE' ? 'Remove User Invite' : 'Remove Member';

  const description =
    type === 'INVITE' ? (
      <>
        Are you sure you want to remove the invite for <strong>{memberName}</strong> from{' '}
        <strong>{orgName}</strong>? This action cannot be undone.
      </>
    ) : (
      <>
        Are you sure you want to remove <strong>{memberName}</strong> from{' '}
        <strong>{orgName}</strong>? This action cannot be undone.
      </>
    );

  return (
    <ConfirmDialog
      isOpen={visible}
      title={title}
      description={description}
      confirmText="Remove"
      cancelText="Cancel"
      variant="destructive"
      onConfirm={onConfirm}
      onCancel={onCancel}
      loading={loading}
    />
  );
}
