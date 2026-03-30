import { useState, useEffect } from 'react';
import { Plus, Search, Sparkles, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '../components/shared/PageHeader';
import { useFineTuning } from '../hooks/useFineTuning';
import { FineTuningModal } from '../components/FineTuning/FineTuningModal';
import { FineTuningJobCard } from '../components/FineTuning/FineTuningJobCard';
import { Spinner } from '../components/ui/spinner';
import type { FineTuningJob } from '../types/fineTuningTypes';

export default function FineTuning() {
  const { jobs, loading, creating, error, createJob, refreshJobs, deleteJob, clearError } =
    useFineTuning();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);

  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  const handleCreateJob = async (jobData: Partial<FineTuningJob>) => {
    try {
      await createJob(jobData);
      toast.success('Training job created successfully!');
      setIsModalOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create training job');
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    setDeletingJobId(jobId);
    try {
      const success = await deleteJob(jobId);
      if (success) {
        toast.success('Training job deleted successfully!');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete training job');
    } finally {
      setDeletingJobId(null);
    }
  };

  const handleRefresh = async () => {
    await refreshJobs();
  };

  const filteredJobs = jobs.filter(
    (job) =>
      job.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.baseModel.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const runningJobsCount = jobs.filter(
    (job) => job.status === 'running' || job.status === 'pending'
  ).length;

  return (
    <div className="h-full flex flex-col bg-background">
      <PageHeader
        title="Training Jobs"
        action={
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4" />
            New Training Job
          </Button>
        }
      />

      {/* Stats & Search */}
      <div className="border-b border-border px-6 py-4 bg-background">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-foreground-secondary rounded-full"></div>
              <span className="text-sm text-foreground-secondary">
                {jobs.filter((j) => j.status === 'completed').length} Completed
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-foreground-secondary rounded-full animate-pulse"></div>
              <span className="text-sm text-foreground-secondary">{runningJobsCount} Training</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-foreground-muted rounded-full"></div>
              <span className="text-sm text-foreground-secondary">{jobs.length} Total</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleRefresh}
              disabled={loading}
              variant="ghost"
              size="sm"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </Button>

            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search training jobs..."
                className="pl-10"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        {loading && jobs.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <Spinner className="w-8 h-8" />
          </div>
        ) : jobs.length === 0 ? (
          // Empty State
          <div className="flex flex-col items-center justify-center h-64">
            <div className="w-16 h-16 bg-brand/10 rounded-2xl flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-brand" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No Training Jobs Yet</h3>
            <p className="text-sm text-foreground-muted text-center max-w-md mb-6">
              Start training your first student model. Use datasets collected from teacher models to
              create smaller, faster, and cheaper alternatives tailored to your specific use case.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-6 py-3 bg-white/10 text-foreground rounded-lg hover:bg-white/15 transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              Start Training
            </button>
          </div>
        ) : filteredJobs.length === 0 ? (
          // No Search Results
          <div className="flex flex-col items-center justify-center h-64">
            <Search className="w-12 h-12 text-foreground-muted mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Jobs Found</h3>
            <p className="text-sm text-foreground-muted">Try adjusting your search query</p>
          </div>
        ) : (
          // Jobs Grid
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredJobs.map((job) => (
              <FineTuningJobCard
                key={job.id}
                job={job}
                onDelete={handleDeleteJob}
                isDeleting={deletingJobId === job.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <FineTuningModal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleCreateJob}
          isLoading={creating}
        />
      )}
    </div>
  );
}
