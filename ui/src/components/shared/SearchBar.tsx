import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  resultCount?: number;
  /** Where to display the result count. Default: `'inside'` */
  resultCountPosition?: 'inside' | 'outside';
  filters?: React.ReactNode;
  className?: string;
  inputClassName?: string;
  maxWidth?: string;
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search…',
  resultCount,
  resultCountPosition = 'inside',
  filters,
  className,
  inputClassName,
  maxWidth = 'max-w-sm',
}: SearchBarProps) {
  const countLabel =
    resultCount !== undefined ? `${resultCount} result${resultCount !== 1 ? 's' : ''}` : undefined;

  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center gap-3', className)}>
      <div className={cn('relative flex-1 w-full', maxWidth)}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            'pl-9',
            resultCountPosition === 'inside' && countLabel && 'pr-24',
            inputClassName
          )}
        />
        {resultCountPosition === 'inside' && countLabel && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground tabular-nums pointer-events-none select-none">
            {countLabel}
          </span>
        )}
      </div>

      {filters && (
        <>
          <Separator orientation="vertical" className="hidden sm:block h-6 shrink-0" />
          {filters}
        </>
      )}

      {resultCountPosition === 'outside' && countLabel && (
        <Badge variant="secondary" className="ml-auto text-xs tabular-nums shrink-0">
          {countLabel}
        </Badge>
      )}
    </div>
  );
}
