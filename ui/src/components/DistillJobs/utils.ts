import type { DistillationJob } from '@/types/distillationTypes';

/**
 * Formats a date string as a relative time (e.g., "5m ago", "2h ago", "3d ago")
 */
export function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);

  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;

  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/**
 * Filters jobs based on search term matching name or model names
 */
export function filterJobsBySearch(jobs: DistillationJob[], searchTerm: string): DistillationJob[] {
  if (!searchTerm) return jobs;

  const lowerSearchTerm = searchTerm.toLowerCase();

  return jobs.filter(
    (job) =>
      job.name.toLowerCase().includes(lowerSearchTerm) ||
      job.config.teacher_model.toLowerCase().includes(lowerSearchTerm) ||
      job.config.student_model.toLowerCase().includes(lowerSearchTerm)
  );
}

/**
 * Calculates job statistics from a list of jobs
 */
export function calculateJobStats(jobs: DistillationJob[]) {
  return {
    total: jobs.length,
    running: jobs.filter((job) => job.status === 'running').length,
    completed: jobs.filter((job) => job.status === 'completed').length,
    queued: jobs.filter((job) => job.status === 'queued' || job.status === 'pending').length,
    failed: jobs.filter((job) => job.status === 'failed').length,
  };
}
