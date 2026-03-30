import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Beaker, Library, Plus, Server } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { PageTabs, type PageTab } from '@/components/shared/PageTabs';
import type { DeploymentData, DeploymentModel } from '@/types/deploymentTypes';
import type { DistillationJob } from '@/types/distillationTypes';
import { useDistillation } from '@/hooks/useDistillation';

import { useProductionModels } from './hooks/useProductionModels';
import { useDeploymentActions } from './hooks/useDeploymentActions';

import { DeploymentModal } from './components/DeploymentModal';
import { StatsBar } from './components/StatsBar';
import { DeploymentTab } from './components/ModelsTab';
import { LibraryTab } from './components/LibraryTab';
import { DistilledTab } from './components/DistilledTab';
import { DistilledDeployDialog } from './components/DistilledTab/DistilledDeployDialog';
import {
  DeployProgressDialog,
  type DeployProgressState,
} from './components/ModelsTab/DeploymentProgress/DeployProgressDialog';
import { ModelSpecsModal } from './components/LibraryTab/ModelSpecsModal';
import { AddHuggingFaceModelModal } from './components/LibraryTab/AddHuggingFaceModelModal';

type TabId = 'deployments' | 'library' | 'distilled';

const TABS: PageTab<TabId>[] = [
  { id: 'deployments', label: 'Active Models', icon: <Server /> },
  { id: 'library', label: 'Model Library', icon: <Library /> },
  { id: 'distilled', label: 'Distilled Models', icon: <Beaker /> },
];

export default function Production() {
  const [activeTab, setActiveTab] = useState<TabId>('deployments');
  const [searchTerm, setSearchTerm] = useState('');

  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [preSelectedModelId, setPreSelectedModelId] = useState<string | undefined>(undefined);

  const [isSpecsModalOpen, setIsSpecsModalOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<DeploymentModel | null>(null);

  const [isHfModalOpen, setIsHfModalOpen] = useState(false);

  // Deploy progress dialog state
  const [progressState, setProgressState] = useState<DeployProgressState>(null);
  const [isProgressOpen, setIsProgressOpen] = useState(false);

  const navigate = useNavigate();

  const models = useProductionModels();
  const actions = useDeploymentActions({ allModels: models.allModels });
  const { listDeployments } = actions;

  const distillation = useDistillation();
  const [deployingJobIds, setDeployingJobIds] = useState<Set<string>>(new Set());
  const [deployModalJobId, setDeployModalJobId] = useState<string | null>(null);
  const [enrichedJobs, setEnrichedJobs] = useState<Map<string, DistillationJob>>(new Map());
  const enrichingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    listDeployments();
  }, [listDeployments]);

  const filteredDeployments = useMemo(() => {
    if (!searchTerm) return actions.deployments;
    const query = searchTerm.toLowerCase();
    return actions.deployments.filter((deployment) => {
      const modelName =
        models.allModels.find((m) => m.id === deployment.selectedModel)?.name ??
        deployment.selectedModel;
      return modelName.toLowerCase().includes(query);
    });
  }, [actions.deployments, searchTerm, models.allModels]);

  // Distilled models: completed jobs
  const completedJobs = useMemo(
    () => distillation.jobs.filter((j) => j.status === 'completed'),
    [distillation.jobs]
  );

  // Enrich completed jobs with full config data when distilled tab is active
  useEffect(() => {
    if (activeTab !== 'distilled') return;

    const jobsToEnrich = completedJobs.filter(
      (j) =>
        !enrichedJobs.has(j.id) &&
        !enrichingRef.current.has(j.id) &&
        (!j.config.student_model || !j.config.teacher_model)
    );

    if (jobsToEnrich.length === 0) return;

    jobsToEnrich.forEach((j) => enrichingRef.current.add(j.id));

    Promise.all(
      jobsToEnrich.map(async (j) => {
        const full = await distillation.getJob(j.id);
        if (full) {
          setEnrichedJobs((prev) => new Map(prev).set(j.id, full));
        }
        enrichingRef.current.delete(j.id);
      })
    );
  }, [activeTab, completedJobs, enrichedJobs, distillation]);

  // Merge enriched data into completed jobs
  const resolvedCompletedJobs = useMemo(
    () => completedJobs.map((j) => enrichedJobs.get(j.id) ?? j),
    [completedJobs, enrichedJobs]
  );

  const filteredCompletedJobs = useMemo(() => {
    if (!searchTerm) return resolvedCompletedJobs;
    const query = searchTerm.toLowerCase();
    return resolvedCompletedJobs.filter((job) => job.name.toLowerCase().includes(query));
  }, [resolvedCompletedJobs, searchTerm]);

  const isSearchDisabled =
    activeTab === 'deployments'
      ? actions.deployments.length === 0
      : activeTab === 'library'
        ? models.allModels.length === 0
        : completedJobs.length === 0;

  const openDeployModal = (modelId?: string) => {
    setPreSelectedModelId(modelId);
    setIsDeployModalOpen(true);
  };

  const closeDeployModal = () => {
    setIsDeployModalOpen(false);
    setPreSelectedModelId(undefined);
  };

  const handleViewSpecs = (model: DeploymentModel) => {
    setSelectedModel(model);
    setIsSpecsModalOpen(true);
  };

  const handleSpecsDeploy = (modelId: string) => {
    setIsSpecsModalOpen(false);
    setSelectedModel(null);
    openDeployModal(modelId);
  };

  const handleHfRetry = (model: Parameters<typeof models.handleRetryModel>[0]) => {
    models.handleRetryModel(model);
    setIsHfModalOpen(true);
  };

  const closeProgressDialog = useCallback(() => {
    setIsProgressOpen(false);
    setProgressState(null);
  }, []);

  const handleDeploy = useCallback(
    (data: Omit<DeploymentData, 'id' | 'status' | 'createdAt'>) => {
      // Immediately show progress dialog in "creating" state
      setProgressState('creating');
      setIsProgressOpen(true);

      actions.handleCreate(data).then((ok) => {
        if (ok) {
          setProgressState('success');
          setActiveTab('deployments');
          // Auto-close is handled by DeployProgressDialog's internal timer
        } else {
          // handleCreate already shows error toast
          setProgressState('error');
        }
      });
    },
    [actions, setActiveTab]
  );

  const handleOpenDeployDialog = useCallback((jobId: string) => {
    setDeployModalJobId(jobId);
  }, []);

  const handleConfirmDeploy = useCallback(
    async (instanceType: string) => {
      const jobId = deployModalJobId;
      if (!jobId) return;
      setDeployModalJobId(null);

      setDeployingJobIds((prev) => new Set(prev).add(jobId));
      setProgressState('creating');
      setIsProgressOpen(true);

      try {
        const result = await distillation.deployJob(jobId, instanceType);
        if (result) {
          if (result.already_deployed) {
            toast.info('Model is already deployed');
            setIsProgressOpen(false);
            setProgressState(null);
          } else {
            setProgressState('success');
          }
          setActiveTab('deployments');
          listDeployments();
        } else {
          setProgressState('error');
        }
      } catch {
        setProgressState('error');
      } finally {
        setDeployingJobIds((prev) => {
          const next = new Set(prev);
          next.delete(jobId);
          return next;
        });
      }
    },
    [deployModalJobId, distillation, listDeployments]
  );

  const handleViewResults = useCallback(
    (jobId: string) => {
      navigate(`/distill-job/${jobId}/results`);
    },
    [navigate]
  );

  return (
    <div>
      <PageHeader
        title="Production"
        action={
          <Button onClick={() => openDeployModal()}>
            <Plus className="w-4 h-4" />
            New Deployment
          </Button>
        }
      />

      <PageTabs tabs={TABS} value={activeTab} onValueChange={setActiveTab} />

      <div className="max-w-6xl mx-auto px-6 py-6">
        <StatsBar
          activeTab={activeTab}
          deployments={actions.deployments}
          totalModelsCount={models.allModels.length}
          downloadingModels={models.inProgressModels}
          readyModels={models.readyModels}
          completedJobsCount={completedJobs.length}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          isSearchDisabled={isSearchDisabled}
        />

        {activeTab === 'deployments' && (
          <DeploymentTab
            deployments={actions.deployments}
            filteredDeployments={filteredDeployments}
            allModels={models.allModels}
            isLoading={actions.loading}
            deletingDeploymentIds={actions.deletingDeployments}
            pausingDeploymentIds={actions.pausingDeployments}
            resumingDeploymentIds={actions.resumingDeployments}
            searchTerm={searchTerm}
            onBrowseLibrary={() => setActiveTab('library')}
            onPause={(d) => actions.handlePause(d.id)}
            onResume={(d) => actions.handleResume(d.id)}
            onDelete={(d) => actions.handleDelete(d.id)}
          />
        )}

        {activeTab === 'library' && (
          <LibraryTab
            allModels={models.allModels}
            availableModels={models.availableModels}
            downloadingModels={models.inProgressModels}
            readyModels={models.readyModels}
            failedModels={models.failedModels}
            modelStatuses={models.modelStatuses}
            isLoadingModels={models.loadingModels}
            deletingModelIds={models.deletingModels}
            searchTerm={searchTerm}
            onAddModel={() => setIsHfModalOpen(true)}
            onViewSpecs={handleViewSpecs}
            onDeploy={openDeployModal}
            onDelete={models.handleDeleteModel}
            onRetry={handleHfRetry}
            onClearSearch={() => setSearchTerm('')}
          />
        )}

        {activeTab === 'distilled' && (
          <DistilledTab
            completedJobs={resolvedCompletedJobs}
            filteredJobs={filteredCompletedJobs}
            isLoading={distillation.loading}
            deployingJobIds={deployingJobIds}
            searchTerm={searchTerm}
            onGoToDistillLab={() => navigate('/distill-jobs')}
            onDeploy={handleOpenDeployDialog}
            onViewResults={handleViewResults}
          />
        )}
      </div>

      <DeploymentModal
        isOpen={isDeployModalOpen}
        deploymentModels={models.deployableModels}
        preSelectedModelId={preSelectedModelId}
        onClose={closeDeployModal}
        onDeploy={handleDeploy}
      />

      <DeployProgressDialog
        isOpen={isProgressOpen}
        state={progressState}
        onClose={closeProgressDialog}
      />

      <ModelSpecsModal
        isOpen={isSpecsModalOpen}
        model={selectedModel}
        onClose={() => {
          setIsSpecsModalOpen(false);
          setSelectedModel(null);
        }}
        onDeploy={handleSpecsDeploy}
      />

      <DistilledDeployDialog
        open={deployModalJobId !== null}
        onOpenChange={(open) => {
          if (!open) setDeployModalJobId(null);
        }}
        jobName={resolvedCompletedJobs.find((j) => j.id === deployModalJobId)?.name ?? ''}
        onDeploy={handleConfirmDeploy}
        isDeploying={deployModalJobId !== null && deployingJobIds.has(deployModalJobId)}
      />

      <AddHuggingFaceModelModal
        isOpen={isHfModalOpen}
        initialModelId={models.preFillHfModelId}
        onClose={() => {
          setIsHfModalOpen(false);
          models.setPreFillHfModelId(undefined);
        }}
        onModelRegistered={models.handleModelRegistered}
      />
    </div>
  );
}
