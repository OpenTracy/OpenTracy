import { Check, Copy } from 'lucide-react';

import { cn } from '@/lib/utils';

import { useCopyToClipboard } from '@/features/production/utils/copyToClipboard.utils';
import type { CodeBlockToolbarProps } from '@/features/production/types/codeBlocks.types';

export function CodeBlockToolbar({ code, language }: CodeBlockToolbarProps) {
  const { copied, copy } = useCopyToClipboard();

  return (
    <>
      {language && (
        <span className="absolute top-3 left-4 text-xs font-semibold text-muted-foreground uppercase tracking-widest select-none pointer-events-none">
          {language}
        </span>
      )}

      <button
        type="button"
        onClick={() => copy(code)}
        aria-label={copied ? 'Copied!' : 'Copy code'}
        className={cn(
          'absolute top-2.5 right-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-md',
          'text-xs font-medium transition-all',
          'bg-card border border-border text-muted-foreground z-10',
          'opacity-0 group-hover:opacity-100 focus:opacity-100',
          'hover:bg-accent hover:text-accent-foreground',
          copied && 'opacity-100 text-green-600 border-green-500/40 bg-green-500/5'
        )}
      >
        {copied ? (
          <>
            <Check className="size-3" aria-hidden="true" />
            Copied
          </>
        ) : (
          <>
            <Copy className="size-3" aria-hidden="true" />
            Copy
          </>
        )}
      </button>
    </>
  );
}
