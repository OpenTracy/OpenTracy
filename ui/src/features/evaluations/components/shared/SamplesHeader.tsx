import { useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SamplesColumn {
  id: string;
  label: string;
}

interface SamplesHeaderProps {
  columns: SamplesColumn[];
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_COL_WIDTH = 56; // px – smallest comfortable width for a score badge
const MAX_COL_WIDTH = 96; // px – comfortable reading width
const OVERFLOW_BADGE_WIDTH = 40; // px – space reserved for the "+N" badge

// ---------------------------------------------------------------------------
// SamplesHeader
// ---------------------------------------------------------------------------

/**
 * Responsive header for the samples list.
 *
 * When there are many columns or the available space is limited, it:
 *  1. Shrinks column widths down to `MIN_COL_WIDTH`.
 *  2. Truncates long names with an ellipsis (full name shown in a tooltip).
 *  3. If columns still overflow, hides the excess and shows a "+N" popover
 *     listing the hidden columns.
 */
export function SamplesHeader({ columns, className }: SamplesHeaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(columns.length);

  const recalculate = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    // Available space for the score columns only (subtract fixed elements).
    // Fixed elements: # indicator (20px+gap) + Input label (flex) + chevron (16px+gap)
    // We only care about the right-side area where score badges sit.
    const availableWidth = el.clientWidth;

    if (columns.length === 0) {
      setVisibleCount(0);
      return;
    }

    // Try fitting all columns
    const idealWidth = columns.length * MIN_COL_WIDTH;
    if (idealWidth <= availableWidth) {
      setVisibleCount(columns.length);
      return;
    }

    // Calculate how many can fit (reserving space for the "+N" badge)
    const usableWidth = availableWidth - OVERFLOW_BADGE_WIDTH;
    const fits = Math.max(1, Math.floor(usableWidth / MIN_COL_WIDTH));
    setVisibleCount(Math.min(fits, columns.length));
  }, [columns]);

  useEffect(() => {
    recalculate();
    const ro = new ResizeObserver(recalculate);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [recalculate]);

  const visible = columns.slice(0, visibleCount);
  const hidden = columns.slice(visibleCount);
  const colWidth =
    columns.length > 0
      ? Math.min(
          MAX_COL_WIDTH,
          Math.max(
            MIN_COL_WIDTH,
            Math.floor((containerRef.current?.clientWidth ?? 400) / columns.length)
          )
        )
      : MAX_COL_WIDTH;

  return (
    <div
      className={cn(
        'sticky top-0 z-20 bg-background border-b flex items-center gap-4 px-6 h-10',
        className
      )}
    >
      <span className="w-5 text-right shrink-0 text-xs text-muted-foreground">#</span>
      <span className="flex-1 text-xs text-muted-foreground">Input</span>

      <div ref={containerRef} className="flex items-center gap-2 shrink-0">
        {visible.map(({ id, label }) => (
          <Tooltip key={id}>
            <TooltipTrigger asChild>
              <span
                className="text-center text-xs font-semibold truncate text-muted-foreground"
                style={{ width: colWidth, maxWidth: MAX_COL_WIDTH }}
              >
                {label}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-60 text-xs">
              {label}
            </TooltipContent>
          </Tooltip>
        ))}

        {hidden.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold tabular-nums bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                style={{ width: OVERFLOW_BADGE_WIDTH }}
              >
                +{hidden.length}
              </button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="end" className="w-48 p-2">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Hidden columns</p>
              <div className="space-y-1">
                {hidden.map(({ id, label }) => (
                  <p key={id} className="text-xs truncate" title={label}>
                    {label}
                  </p>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      <span className="w-4 shrink-0" />
    </div>
  );
}
