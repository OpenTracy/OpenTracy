'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
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
import { Input } from '@/components/ui/input';

interface AccessKeysCreatedModalProps {
  newKey: string | null;
  onClose: () => void;
}

export function AccessKeysCreatedModal({ newKey, onClose }: AccessKeysCreatedModalProps) {
  const [copied, setCopied] = useState(false);
  const [autoCopied, setAutoCopied] = useState(false);

  useEffect(() => {
    if (!newKey) return;

    const autoCopy = async () => {
      try {
        await navigator.clipboard.writeText(newKey);
        setAutoCopied(true);
      } catch {
        // Ignore clipboard errors
      }
    };
    autoCopy();
  }, [newKey]);

  useEffect(() => {
    if (!newKey) {
      setCopied(false);
      setAutoCopied(false);
    }
  }, [newKey]);

  const copy = async () => {
    if (!newKey) return;

    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard errors
    }
  };

  return (
    <Dialog open={!!newKey} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>API Key Created</DialogTitle>
          <DialogDescription>
            This is your new API key. You won&apos;t be able to see it again!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {autoCopied && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950">
              <Check className="h-4 w-4 flex-shrink-0 text-green-600 dark:text-green-400" />
              <p className="text-sm text-green-700 dark:text-green-300">
                API key copied automatically to clipboard!
              </p>
            </div>
          )}

          <div className="relative">
            <Input value={newKey || ''} readOnly className="pr-10 font-mono text-sm" />
            <button
              onClick={copy}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 transition-colors hover:bg-accent"
              title="Copy to clipboard"
              type="button"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
              ) : (
                <Copy className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button>{autoCopied ? 'Close' : 'Copy & Close'}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
