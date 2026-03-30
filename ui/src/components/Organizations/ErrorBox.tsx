import { X } from 'lucide-react';

interface Props {
  errors: (string | null | undefined)[];
  onClear: () => void;
}

export default function ErrorBox({ errors, onClear }: Props) {
  const activeError = errors.find((error) => error);

  if (!activeError) return null;

  return (
    <div className="mb-6 p-4 bg-surface border border-border rounded-xl">
      <div className="flex items-center justify-between">
        <p className="text-foreground font-medium">{activeError}</p>
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
