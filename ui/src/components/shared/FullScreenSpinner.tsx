import { Spinner } from '@/components/ui/spinner';

export function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Spinner className="size-10 text-brand" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
