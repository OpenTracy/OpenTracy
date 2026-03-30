import type { ReactNode } from 'react';
import {
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
  ItemFooter,
} from '@/components/ui/item';
import { Spinner } from '@/components/ui/spinner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const DOT = <span className="text-muted-foreground/50 text-sm leading-none">&bull;</span>;

function joinWithDots(parts: ReactNode[]) {
  return parts.flatMap((el, i) =>
    i < parts.length - 1 ? [el, <span key={`dot-${i}`}>{DOT}</span>] : [el]
  );
}

interface ItemRowProps {
  name: string;
  badge?: ReactNode;
  descriptionParts: ReactNode[];
  onClick?: () => void;
  isClickable?: boolean;
  isDimmed?: boolean;
  showSpinner?: boolean;
  actions?: ReactNode;
  extraContent?: ReactNode;
  footer?: ReactNode;
  size?: 'default' | 'sm';
  className?: string;
}
export function ItemRow({
  name,
  badge,
  descriptionParts,
  onClick,
  isClickable,
  isDimmed = false,
  showSpinner = false,
  actions,
  extraContent,
  footer,
  size = 'sm',
  className,
}: ItemRowProps) {
  const clickable = isClickable ?? !!onClick;

  return (
    <TooltipProvider delayDuration={150}>
      <Item
        variant="muted"
        size={size}
        className={cn(
          'transition-colors group',
          clickable && 'cursor-pointer hover:bg-muted',
          !clickable && 'hover:bg-muted/80',
          className
        )}
        onClick={clickable ? onClick : undefined}
      >
        <ItemContent className="gap-1">
          <ItemTitle className={cn(isDimmed && 'text-muted-foreground')}>
            {name}
            {badge}
          </ItemTitle>

          {descriptionParts.length > 0 && (
            <ItemDescription className="text-xs">
              <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                {joinWithDots(descriptionParts)}
              </span>
            </ItemDescription>
          )}
        </ItemContent>

        {showSpinner && (
          <ItemContent className="flex-none">
            <Spinner className="size-3.5 text-muted-foreground" />
          </ItemContent>
        )}

        {extraContent}

        {actions && <ItemActions onClick={(e) => e.stopPropagation()}>{actions}</ItemActions>}

        {footer && <ItemFooter>{footer}</ItemFooter>}
      </Item>
    </TooltipProvider>
  );
}
