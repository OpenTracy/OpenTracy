import type { ReactNode } from 'react';
import { useCallback } from 'react';
import { ConfirmDialog } from '../../Modals/ConfirmDialog';

interface DeleteDataSourceModalProps {
  readonly open: boolean;
  readonly title?: string;
  readonly description?: ReactNode;
  readonly confirmText?: string;
  readonly cancelText?: string;
  readonly loading?: boolean;
  readonly onConfirm: () => Promise<void>;
  readonly onCancel: () => void;
}

const DEFAULT_TITLE = 'Remove Data Source';
const DEFAULT_CONFIRM_TEXT = 'Yes, Remove';
const DEFAULT_CANCEL_TEXT = 'Cancel';

export function DeleteDataSourceModal({
  open,
  title = DEFAULT_TITLE,
  description,
  confirmText = DEFAULT_CONFIRM_TEXT,
  cancelText = DEFAULT_CANCEL_TEXT,
  loading = false,
  onConfirm,
  onCancel,
}: DeleteDataSourceModalProps) {
  const handleConfirm = useCallback(() => {
    onConfirm();
  }, [onConfirm]);

  return (
    <ConfirmDialog
      isOpen={open}
      title={title}
      description={description}
      confirmText={confirmText}
      cancelText={cancelText}
      variant="destructive"
      loading={loading}
      onConfirm={handleConfirm}
      onCancel={onCancel}
    />
  );
}
