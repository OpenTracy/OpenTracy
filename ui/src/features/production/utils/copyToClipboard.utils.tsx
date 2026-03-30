import { useState, useCallback } from 'react';

import type { UseCopyToClipboardReturn } from '../types/codeBlocks.types';

const COPY_RESET_DELAY_MS = 2000;

export function useCopyToClipboard(): UseCopyToClipboardReturn {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_RESET_DELAY_MS);
    } catch {
      // silent fail — clipboard API may be unavailable in some contexts
    }
  }, []);

  return { copied, copy };
}
