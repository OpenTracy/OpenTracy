import { ExternalLink } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { CodeExamplesSection } from './CodeExamplesSection';
import { GettingStartedSection } from './GettingStartedSection';
import { OverviewSection } from './OverviewSection';
import type { SpecModalProps } from '@/features/production/types/specsModal.types';

const DOCS_URL = 'https://docs.puredocs.org/lunar/guides/supported-models';

export function SpecsModal({ deployment, modelId, isOpen, onClose }: SpecModalProps) {
  const apiModelId = modelId ?? deployment.selectedModel;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>How to Use Your Deployment</DialogTitle>
          <DialogDescription>
            Connect to your model via Python SDK, REST API, or JavaScript.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-8 pr-3">
            <OverviewSection apiModelId={apiModelId} />
            <CodeExamplesSection apiModelId={apiModelId} />
            <GettingStartedSection apiModelId={apiModelId} />
          </div>
        </ScrollArea>

        <DialogFooter>
          <DialogClose className={cn(buttonVariants({ variant: 'outline' }))}>Close</DialogClose>
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants())}
          >
            <ExternalLink className="size-3.5" aria-hidden="true" />
            View documentation
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
