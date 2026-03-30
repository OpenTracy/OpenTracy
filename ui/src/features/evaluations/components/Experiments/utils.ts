/** Tailwind classes for a score pill based on its 0-1 value. */
export function scorePillClasses(score: number): string {
  if (score >= 0.8)
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
  if (score >= 0.6)
    return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/25 dark:text-emerald-400';
  if (score >= 0.4) return 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300';
  if (score >= 0.2)
    return 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400';
  return 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300';
}

/** Format a 0-1 score as a percentage string (e.g. "85.0%"). */
export function formatPct(score: number): string {
  return `${(score * 100).toFixed(1)}%`;
}

/** Format a metric id into a human-readable label. */
export function formatMetric(id: string): string {
  return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
