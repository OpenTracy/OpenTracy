import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';

import { ItemGroup } from '@/components/ui/item';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchBar } from '@/components/shared/SearchBar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDistillation } from '@/hooks/useDistillation';
import {
  JobCard,
  StatusStats,
  EmptyState,
  JobsListSkeleton,
  filterJobsBySearch,
  calculateJobStats,
} from '@/components/DistillJobs';

export default function DistillJobs() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const { jobs, loading: jobsLoading, deleteJob } = useDistillation();

  const stats = useMemo(() => calculateJobStats(jobs), [jobs]);
  const filteredJobs = useMemo(() => filterJobsBySearch(jobs, searchTerm), [jobs, searchTerm]);

  const handleCreateNew = useCallback(() => navigate('/distill-new'), [navigate]);

  const handleJobClick = useCallback(
    (jobId: string, status: string, hasResults: boolean) => {
      navigate(
        status === 'completed' && hasResults
          ? `/distill-job/${jobId}/results`
          : `/distill-job/${jobId}`
      );
    },
    [navigate]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    await deleteJob(deleteTarget);
    setDeleteTarget(null);
  }, [deleteTarget, deleteJob]);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Distill Jobs"
        action={
          <Button size="sm" onClick={handleCreateNew}>
            <Plus className="size-4" />
            New Distillation
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 space-y-6">
          <div className="flex items-center gap-3">
            <SearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search jobs…"
              resultCount={filteredJobs.length}
            />
            <StatusStats stats={stats} />
          </div>

          {jobsLoading ? (
            <JobsListSkeleton count={5} />
          ) : filteredJobs.length === 0 ? (
            <EmptyState hasSearchTerm={!!searchTerm} onCreateNew={handleCreateNew} />
          ) : (
            <ItemGroup className="flex w-full flex-col gap-3">
              {filteredJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onClick={() => handleJobClick(job.id, job.status, !!job.results)}
                  onDelete={setDeleteTarget}
                />
              ))}
            </ItemGroup>
          )}
        </div>
      </div>

      {deleteTarget && (
        <AlertDialog defaultOpen onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Job</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this distillation job and its metadata. This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleDeleteConfirm}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
