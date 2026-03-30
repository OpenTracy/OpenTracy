'use client';

import { AlertTriangle } from 'lucide-react';
import { ConfirmDialog } from '@/components/Modals';

interface ConfirmCancelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  evaluationName: string;
  loading?: boolean;
}

export function ConfirmCancelModal({
  isOpen,
  onClose,
  onConfirm,
  evaluationName,
  loading = false,
}: ConfirmCancelModalProps) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      title="Cancel Evaluation"
      description={
        <>
          Are you sure you want to cancel{' '}
          <span className="font-medium text-foreground">"{evaluationName}"</span>? This will stop
          the evaluation process. Any completed samples will be preserved.
        </>
      }
      confirmText="Cancel Evaluation"
      cancelText="Keep Running"
      variant="destructive"
      icon={<AlertTriangle className="w-5 h-5 text-warning" />}
      onConfirm={onConfirm}
      onCancel={onClose}
      loading={loading}
    />
  );
}
