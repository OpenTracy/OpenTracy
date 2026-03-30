import { Check } from 'lucide-react';

interface SuccessOverlayProps {
  name: string;
}

export function SuccessOverlay({ name }: SuccessOverlayProps) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 rounded-lg bg-background/80 backdrop-blur-sm pointer-events-none animate-in fade-in duration-200">
      <div className="flex size-16 items-center justify-center rounded-full border bg-secondary">
        <Check className="size-8 text-chart-2" strokeWidth={2.5} />
      </div>
      <div className="text-center space-y-1">
        <p className="font-semibold">Dataset created</p>
        <p className="text-sm text-muted-foreground">&quot;{name}&quot;</p>
      </div>
    </div>
  );
}
