import { X } from 'lucide-react';

interface ErrorBoxProps {
  errors: (string | null | undefined)[];
  onClear: () => void;
}

export default function ErrorBox({ errors, onClear }: ErrorBoxProps) {
  const visibleErrors = errors.filter(Boolean);

  if (visibleErrors.length === 0) return null;

  return (
    <div className="mb-6 p-4 bg-surface border border-border rounded-xl">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          {visibleErrors.map((err, i) => (
            <p key={i} className="text-foreground font-medium">
              {err}
            </p>
          ))}
        </div>
        <button
          onClick={onClear}
          className="p-1 rounded-full hover:bg-surface-hover transition-colors"
        >
          <X className="w-4 h-4 text-foreground-secondary" />
        </button>
      </div>
    </div>
  );
}
