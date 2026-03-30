'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export interface DisplayDialogProps {
  isOpen: boolean;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  closeText?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';
  showFooter?: boolean;
  icon?: ReactNode;
}

export function DisplayDialog({
  isOpen,
  title,
  description,
  children,
  onClose,
  closeText = 'Close',
  maxWidth = 'md',
  showFooter = true,
  icon,
}: DisplayDialogProps) {
  const maxWidthClasses = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-xl',
    '2xl': 'sm:max-w-2xl',
    '4xl': 'max-w-4xl',
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={cn(maxWidthClasses[maxWidth])}>
        <DialogHeader>
          {icon && (
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-accent/10 rounded-full">{icon}</div>
              <DialogTitle>{title}</DialogTitle>
            </div>
          )}
          {!icon && <DialogTitle>{title}</DialogTitle>}
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="py-4">{children}</div>

        {showFooter && (
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {closeText}
              </Button>
            </DialogClose>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
