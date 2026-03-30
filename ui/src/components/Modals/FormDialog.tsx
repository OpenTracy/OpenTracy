'use client';

import type { ReactNode } from 'react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface FormDialogProps {
  isOpen: boolean;
  title: string;
  description?: string;
  submitText?: string;
  cancelText?: string;
  children?: ReactNode;
  onSubmit: (e: React.FormEvent) => void | Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function FormDialog({
  isOpen,
  title,
  description,
  submitText = 'Submit',
  cancelText = 'Cancel',
  children,
  onSubmit,
  onCancel,
  loading,
}: FormDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmitClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    console.log('[FormDialog] Submit button clicked');
    if (formRef.current) {
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      formRef.current.dispatchEvent(submitEvent);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onCancel()}>
      <form ref={formRef} onSubmit={onSubmit} className="w-full">
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>

          <FieldGroup>{children}</FieldGroup>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={loading}>
                {cancelText}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={loading} onClick={handleSubmitClick}>
              {submitText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </form>
    </Dialog>
  );
}
