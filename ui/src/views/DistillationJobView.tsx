import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  XCircle,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Calendar,
  Clock,
  Download,
  Rocket,
  TrendingUp,
  DollarSign,
  Zap,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Settings2,
  ArrowRightLeft,
  BarChart3,
  FileText,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StepTracker } from '@/components/shared/StepTracker';
import { TerminalLogs } from '@/components/shared/TerminalLogs';
import { CostBadge } from '@/components/shared/CostBadge';
import { KpiCard } from '@/components/shared/KpiCard';
import { DiffViewer } from '@/components/shared/DiffViewer';
import { useDistillation } from '@/hooks/useDistillation';

import { formatFileSize } from '@/lib/utils';
import type { DistillationJob, DistillationResults, GGUFArtifact } from '@/types/distillationTypes';
import {
  TEACHER_MODELS,
  STUDENT_MODELS,
  TARGET_DEVICES,
  QUANTIZATION_OPTIONS,
  CURATION_AGENTS,
} from '@/types/distillationTypes';
import type { CurationSample } from '@/services/distillationService';
import { useCurationSubscription } from '@/hooks/useCurationSubscription';
import { useUser } from '@/contexts/UserContext';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface LossDataPoint {
  step: number;
  training_loss?: number;
  validation_loss?: number;
}

const PIPELINE_STEPS = [
  { id: 'data_generation', label: 'Data Gen' },
  { id: 'curation', label: 'Curation' },
  { id: 'training', label: 'Training' },
  { id: 'export', label: 'Export' },
];

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  pending: { label: 'Pending', variant: 'outline' },
  queued: { label: 'Queued', variant: 'outline' },
  running: { label: 'Running', variant: 'secondary' },
  completed: { label: 'Completed', variant: 'default' },
  failed: { label: 'Failed', variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'outline' },
};

export default function DistillationJobView() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  const {
    getJob,
    cancelJob,
    getJobLogs,
    getJobCandidates,
    getJobResults,
    getJobArtifacts,
    deployJob,
  } = useDistillation();
  const { tenantId } = useUser();

  const [job, setJob] = useState<DistillationJob | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [lossHistory, setLossHistory] = useState<LossDataPoint[]>([]);
  const [curationSamples, setCurationSamples] = useState<CurationSample[]>([]);
  const [curationViewIdx, setCurationViewIdx] = useState(0);

  const [results, setResults] = useState<DistillationResults | null>(null);
  const [resultsLoaded, setResultsLoaded] = useState(false);
  const [artifacts, setArtifacts] = useState<GGUFArtifact[]>([]);
  const [deploying, setDeploying] = useState(false);
  const [configOpen, setConfigOpen] = useState(true);
  const [logsOpen, setLogsOpen] = useState(true);

  // Real-time curation subscription
  const isCurationPhase = job?.phase === 'curation' && job?.status === 'running';
  const {
    events: curationEvents,
    latestEvent,
    connected: subConnected,
  } = useCurationSubscription(tenantId ?? undefined, jobId, isCurationPhase);
  const [viewingEventIdx, setViewingEventIdx] = useState<number | null>(null);

  // Auto-track latest event
  useEffect(() => {
    if (latestEvent && viewingEventIdx === null) {
      setViewingEventIdx(curationEvents.length - 1);
    }
  }, [latestEvent, curationEvents.length, viewingEventIdx]);

  const loadJob = useCallback(async () => {
    if (!jobId) return;
    const data = await getJob(jobId);
    if (data) setJob(data);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const loadLogs = useCallback(async () => {
    if (!jobId) return;
    const data = await getJobLogs(jobId);
    if (data.length > 0) setLogs(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const loadCandidates = useCallback(async () => {
    if (!jobId) return;
    const data = await getJobCandidates(jobId);
    if (data.samples?.length > 0) setCurationSamples(data.samples);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const loadResults = useCallback(async () => {
    if (!jobId) return;
    const [resultsData, artifactsData] = await Promise.all([
      getJobResults(jobId),
      getJobArtifacts(jobId),
    ]);
    setResults(resultsData);
    setArtifacts(artifactsData);
    setResultsLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  useEffect(() => {
    loadJob();
    loadLogs();
    loadCandidates();
  }, [loadJob, loadLogs, loadCandidates]);

  useEffect(() => {
    if (job?.status === 'completed') {
      loadResults();
      setLogsOpen(false);
    }
  }, [job?.status, loadResults]);

  useEffect(() => {
    if (!job || job.phase !== 'training') return;
    const p = job.progress;
    if (p.current_step == null) return;
    if (p.training_loss == null && p.validation_loss == null) return;

    setLossHistory((prev) => {
      const last = prev[prev.length - 1];
      if (
        last &&
        last.step === p.current_step &&
        last.training_loss === p.training_loss &&
        last.validation_loss === p.validation_loss
      )
        return prev;

      const point: LossDataPoint = {
        step: p.current_step!,
        training_loss: p.training_loss,
        validation_loss: p.validation_loss,
      };

      if (last && last.step === p.current_step) {
        return [...prev.slice(0, -1), point];
      }

      return [...prev, point];
    });
  }, [
    job?.progress.current_step,
    job?.progress.training_loss,
    job?.progress.validation_loss,
    job?.phase,
  ]);

  useEffect(() => {
    if (!job || !['running', 'pending', 'queued'].includes(job.status)) return;
    const interval = setInterval(() => {
      loadJob();
      loadLogs();
      loadCandidates();
    }, 5000);
    return () => clearInterval(interval);
  }, [job?.status, loadJob, loadLogs, loadCandidates]);

  const handleCancel = async () => {
    if (!jobId) return;
    const success = await cancelJob(jobId);
    if (success) {
      toast.success('Job cancelled');
      loadJob();
    }
  };

  const handleDeploy = async () => {
    if (!jobId) return;
    setDeploying(true);
    try {
      const result = await deployJob(jobId);
      if (result) {
        if (result.already_deployed) {
          toast.info('Model already deployed');
        } else {
          toast.success('Deployment started! Your model will be ready in a few minutes.');
        }
        navigate('/deployments');
      } else {
        toast.error('Failed to start deployment');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to deploy');
    } finally {
      setDeploying(false);
    }
  };

  const getQuantLabel = (key: string) => {
    const match = key.match(/export\/([^/]+)\//);
    return match ? match[1].toUpperCase() : 'GGUF';
  };

  const triggerDownload = (url: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Download started');
  };

  // These hooks must be called before any early returns to maintain consistent hook order
  const isCompleted = job?.status === 'completed';

  const renderDownloadButton = () => {
    if (artifacts.length === 0) return null;
    if (artifacts.length === 1) {
      return (
        <Button variant="outline" size="sm" onClick={() => triggerDownload(artifacts[0].url)}>
          <Download className="size-4" />
          Download GGUF
        </Button>
      );
    }
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Download className="size-4" />
            Download GGUF
            <ChevronDown className="size-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {artifacts.map((a) => (
            <DropdownMenuItem key={a.key} onClick={() => triggerDownload(a.url)}>
              {getQuantLabel(a.key)} — {formatFileSize(a.size)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6">
        <div className="size-16 rounded-xl bg-muted flex items-center justify-center">
          <FlaskConical className="size-8 text-muted-foreground" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium">Job not found</p>
          <p className="text-sm text-muted-foreground">
            This job may have been deleted or is unavailable.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/distill-jobs')}>
          <ArrowLeft className="size-4" />
          Back to Distill Lab
        </Button>
      </div>
    );
  }

  const isTerminal = ['completed', 'failed', 'cancelled'].includes(job.status);
  const statusCfg = STATUS_CONFIG[job.status] || STATUS_CONFIG.queued;

  const teacherName =
    TEACHER_MODELS.find((m) => m.id === job.config.teacher_model)?.name || job.config.teacher_model;
  const studentModel = STUDENT_MODELS.find((m) => m.id === job.config.student_model);
  const studentName = studentModel?.name || job.config.student_model;
  const studentParams = studentModel?.params;

  const device = TARGET_DEVICES.find((d) => d.id === job.config.target_device);
  const deviceName = device
    ? `${device.name} (${device.vram})`
    : job.config.target_device || '\u2014';

  const quantOption = QUANTIZATION_OPTIONS.find((q) => q.id === job.config.quantization);
  const quantLabel = quantOption?.name || job.config.quantization?.toUpperCase() || '\u2014';

  const enabledAgents = (job.config.curation_agents || [])
    .filter((a) => a.enabled)
    .map((a) => {
      const agent = CURATION_AGENTS.find((ca) => ca.id === a.id);
      return agent?.name.replace(' Agent', '') || a.id;
    });

  const currentPhase = job.phase;
  const phaseProgress = job.progress.phase_progress;
  const overallProgress = job.progress.overall_progress;

  const formattedDate = job.created_at
    ? new Date(job.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';

  const duration = (() => {
    const start = job.started_at ? new Date(job.started_at).getTime() : 0;
    const end = job.completed_at ? new Date(job.completed_at).getTime() : 0;
    if (!start || !end) return null;
    const diffMs = end - start;
    const totalMinutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  })();

  return (
    <div className="flex flex-col h-full">
      <header className="shrink-0 border-b border-border">
        <div className="px-6 pt-4 pb-4 space-y-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink
                  href="/distill-jobs"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/distill-jobs');
                  }}
                >
                  Distill Lab
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{job.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/distill-jobs')}>
                <ArrowLeft className="size-4" />
              </Button>
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl font-semibold tracking-tight">{job.name}</h1>
                  <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <ArrowRightLeft className="size-3" />
                    {teacherName} &rarr; {studentName}
                  </span>
                  {formattedDate && (
                    <>
                      <Separator orientation="vertical" className="h-3" />
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        {formattedDate}
                      </span>
                    </>
                  )}
                  {duration && (
                    <>
                      <Separator orientation="vertical" className="h-3" />
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {duration}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CostBadge amount={job.cost_accrued} label="accrued" />
              {(job.status === 'running' || job.status === 'pending') && (
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  <XCircle className="size-4" />
                  Cancel
                </Button>
              )}
              {isCompleted && (
                <>
                  {renderDownloadButton()}
                  <Button size="sm" disabled={deploying} onClick={handleDeploy}>
                    {deploying ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Rocket className="size-4" />
                    )}
                    {deploying ? 'Deploying...' : 'Deploy'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
          {job.status === 'failed' && job.error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>{job.error.code}</AlertTitle>
              <AlertDescription>{job.error.message}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <StepTracker
              steps={PIPELINE_STEPS}
              currentStepId={isTerminal ? 'completed' : currentPhase}
              progress={phaseProgress}
            />
            {job.status === 'running' && (
              <div className="flex items-center gap-3">
                <Progress value={overallProgress} className="flex-1 h-1.5" />
                <span className="text-xs font-medium tabular-nums text-muted-foreground shrink-0">
                  {Math.round(overallProgress)}% overall
                </span>
              </div>
            )}
          </div>

          <TerminalLogs
            logs={logs}
            title="Pipeline Logs"
            collapsible
            expanded={logsOpen}
            onExpandedChange={setLogsOpen}
            maxHeight="400px"
          />

          {isCompleted && results && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <KpiCard
                  label="Quality Score"
                  value={`${((results.quality_score ?? 0) * 100).toFixed(0)}%`}
                  icon={TrendingUp}
                  subtitle={`vs ${teacherName}`}
                />
                <KpiCard
                  label="Cost Savings"
                  value={`${(results.cost_savings ?? 0).toFixed(1)}%`}
                  icon={DollarSign}
                  subtitle="cheaper per request"
                />
                <KpiCard
                  label="Speed"
                  value={`${results.speed_improvement ?? 0}x`}
                  icon={Zap}
                  subtitle="faster inference"
                />
              </div>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="size-4 text-muted-foreground" />
                      <CardTitle className="text-sm">Distillation Summary</CardTitle>
                    </div>
                  </div>
                  <CardDescription>
                    Overview of the distillation process from {teacherName} to {studentName}.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Prompts Processed</p>
                      <p className="text-lg font-semibold tabular-nums">
                        {results.sample_comparisons?.length || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Candidates Evaluated</p>
                      <p className="text-lg font-semibold tabular-nums">
                        {(results.sample_comparisons?.length || 0) * (job.config.n_samples || 1)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Training Steps</p>
                      <p className="text-lg font-semibold tabular-nums">
                        {job.config.training_steps ?? '\u2014'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Output Format</p>
                      <p className="text-lg font-semibold">{quantLabel}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-sm">Response Samples</CardTitle>
                      <CardDescription>
                        Best responses selected by the distillation pipeline for each prompt. Click
                        a row to expand and view full content.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <DiffViewer
                    comparisons={results.sample_comparisons ?? []}
                    teacherLabel={teacherName}
                    studentLabel={studentName}
                  />
                </CardContent>
              </Card>
            </>
          )}

          {isCompleted && !results && !resultsLoaded && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}

          <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings2 className="size-4 text-muted-foreground" />
                    <CardTitle className="text-sm">Configuration</CardTitle>
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-7">
                      {configOpen ? (
                        <ChevronUp className="size-4" />
                      ) : (
                        <ChevronDown className="size-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </CardHeader>
              <CollapsibleContent>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Teacher Model</p>
                      <p className="text-sm font-medium">{teacherName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Student Model</p>
                      <p className="text-sm font-medium">
                        {studentParams ? `${studentName} (${studentParams})` : studentName}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Target Device</p>
                      <p className="text-sm font-medium">{deviceName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Quantization</p>
                      <p className="text-sm font-medium">{quantLabel}</p>
                    </div>
                    {job.config.training_steps != null && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Training Steps</p>
                        <p className="text-sm font-medium">{job.config.training_steps}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Temperature</p>
                      <p className="text-sm font-medium">{job.config.temperature}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Candidates / Prompt</p>
                      <p className="text-sm font-medium">{job.config.n_samples}</p>
                    </div>
                    {enabledAgents.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Curation Agents</p>
                        <p className="text-sm font-medium">{enabledAgents.join(', ')}</p>
                      </div>
                    )}
                    {job.config.output_name && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Output Name</p>
                        <p className="text-sm font-medium">{job.config.output_name}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {job.status === 'running' && (
            <>
              {currentPhase === 'data_generation' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Data Generation</CardTitle>
                    <CardDescription>
                      The teacher model ({teacherName}) is generating {job.config.n_samples}{' '}
                      candidate responses for each prompt in your dataset.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Generating candidate responses</span>
                      <span className="font-medium tabular-nums">
                        {job.progress.candidates_generated || 0} /{' '}
                        {job.progress.candidates_total || 0}
                      </span>
                    </div>
                    <Progress value={phaseProgress} />
                  </CardContent>
                </Card>
              )}

              {currentPhase === 'curation' &&
                (() => {
                  const activeEvent =
                    viewingEventIdx !== null ? curationEvents[viewingEventIdx] : null;
                  const hasRealtime = curationEvents.length > 0;

                  return (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-sm">Live Curation</CardTitle>
                            {subConnected ? (
                              <span className="flex items-center gap-1 text-[10px] text-emerald-500">
                                <Wifi className="size-3" />
                                Live
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <WifiOff className="size-3" />
                                Connecting...
                              </span>
                            )}
                          </div>
                          {activeEvent && (
                            <span className="text-xs text-muted-foreground tabular-nums">
                              Prompt {activeEvent.promptIndex + 1}/{activeEvent.totalPrompts}
                            </span>
                          )}
                        </div>
                        <CardDescription>
                          AI judges are evaluating and ranking generated responses in real time.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <Progress value={phaseProgress} />

                        {!hasRealtime && (
                          <div className="flex items-center gap-3">
                            <Loader2 className="size-4 animate-spin text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                              Waiting for AI judge to score candidates...
                            </p>
                          </div>
                        )}

                        {activeEvent && (
                          <>
                            {/* Prompt */}
                            <Card className="bg-muted">
                              <CardContent className="py-3">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                                  Prompt
                                </p>
                                <p className="text-sm line-clamp-3">{activeEvent.promptText}</p>
                              </CardContent>
                            </Card>

                            {/* Candidate cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {activeEvent.candidates.map((candidate) => {
                                const isWinner =
                                  candidate.candidateIndex === activeEvent.selectedIndex;
                                const scorePct = Math.round(candidate.score * 100);

                                return (
                                  <Card
                                    key={candidate.candidateIndex}
                                    className={cn(
                                      isWinner && 'border-primary bg-accent ring-1 ring-primary/10'
                                    )}
                                  >
                                    <CardContent className="py-3 space-y-2">
                                      {isWinner && (
                                        <Badge variant="secondary">
                                          <Trophy className="size-3" />
                                          Selected
                                        </Badge>
                                      )}

                                      <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">
                                        {candidate.responsePreview}
                                      </p>

                                      <Separator />

                                      {/* Overall score bar */}
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs text-muted-foreground">
                                            Score
                                          </span>
                                          <Badge variant="outline" className="tabular-nums text-xs">
                                            {scorePct}%
                                          </Badge>
                                        </div>
                                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                          <div
                                            className={cn(
                                              'h-full rounded-full transition-all',
                                              isWinner ? 'bg-primary' : 'bg-muted-foreground/40'
                                            )}
                                            style={{ width: `${scorePct}%` }}
                                          />
                                        </div>

                                        {/* Sub-scores */}
                                        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                                          {[
                                            { label: 'Coherence', value: candidate.coherence },
                                            { label: 'Helpful', value: candidate.helpfulness },
                                            { label: 'Correct', value: candidate.correctness },
                                            { label: 'Format', value: candidate.format },
                                          ].map((m) => (
                                            <div
                                              key={m.label}
                                              className="flex items-center justify-between"
                                            >
                                              <span className="text-[10px] text-muted-foreground">
                                                {m.label}
                                              </span>
                                              <span className="text-[10px] tabular-nums text-muted-foreground">
                                                {m.value != null ? (m.value * 100).toFixed(0) : '-'}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                );
                              })}
                            </div>

                            {/* Navigation */}
                            <div className="flex items-center justify-center gap-3">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() =>
                                  setViewingEventIdx((prev) => Math.max(0, (prev ?? 0) - 1))
                                }
                                disabled={viewingEventIdx === 0}
                              >
                                <ChevronLeft className="size-4" />
                              </Button>
                              <span className="text-xs text-muted-foreground tabular-nums min-w-[60px] text-center">
                                {(viewingEventIdx ?? 0) + 1} / {curationEvents.length}
                              </span>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() =>
                                  setViewingEventIdx((prev) =>
                                    Math.min(curationEvents.length - 1, (prev ?? 0) + 1)
                                  )
                                }
                                disabled={viewingEventIdx === curationEvents.length - 1}
                              >
                                <ChevronRight className="size-4" />
                              </Button>
                              {viewingEventIdx !== curationEvents.length - 1 &&
                                curationEvents.length > 0 && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs ml-2"
                                    onClick={() => setViewingEventIdx(curationEvents.length - 1)}
                                  >
                                    Jump to latest
                                  </Button>
                                )}
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  );
                })()}

              {/* Curation Results (after curation completes) */}
              {currentPhase !== 'curation' &&
                curationSamples.length > 0 &&
                (() => {
                  const sample = curationSamples[curationViewIdx];
                  if (!sample) return null;
                  return (
                    <Collapsible defaultOpen={currentPhase === 'training'}>
                      <Card>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CollapsibleTrigger asChild>
                              <button className="flex items-center gap-2 text-left">
                                <CardTitle className="text-sm">Curation Results</CardTitle>
                                <Badge variant="outline" className="text-xs">
                                  {curationSamples.length} prompts
                                </Badge>
                                <ChevronDown className="size-4" />
                              </button>
                            </CollapsibleTrigger>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="size-7"
                                onClick={() => setCurationViewIdx((prev) => Math.max(0, prev - 1))}
                                disabled={curationViewIdx === 0}
                              >
                                <ChevronLeft className="size-3" />
                              </Button>
                              <span className="text-xs text-muted-foreground tabular-nums min-w-[50px] text-center">
                                {curationViewIdx + 1} / {curationSamples.length}
                              </span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="size-7"
                                onClick={() =>
                                  setCurationViewIdx((prev) =>
                                    Math.min(curationSamples.length - 1, prev + 1)
                                  )
                                }
                                disabled={curationViewIdx === curationSamples.length - 1}
                              >
                                <ChevronRight className="size-3" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CollapsibleContent>
                          <CardContent className="space-y-3 pt-0">
                            {/* Prompt */}
                            <Card className="bg-muted border-none shadow-none">
                              <CardContent className="py-3">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                                  Prompt
                                </p>
                                <p className="text-sm line-clamp-3">{sample.prompt}</p>
                              </CardContent>
                            </Card>

                            {/* Candidate cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {sample.candidates.map((c) => {
                                const scorePct = Math.round(Number(c.scores?.quality ?? 0) * 100);
                                return (
                                  <Card
                                    key={c.candidate_idx}
                                    className={cn(
                                      c.isWinner &&
                                        'border-primary bg-accent ring-1 ring-primary/10'
                                    )}
                                  >
                                    <CardContent className="py-3 space-y-2">
                                      {c.isWinner && (
                                        <Badge variant="secondary">
                                          <Trophy className="size-3" />
                                          Selected
                                        </Badge>
                                      )}
                                      <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">
                                        {c.text}
                                      </p>
                                      <Separator />
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground">
                                          Quality Score
                                        </span>
                                        <Badge variant="outline" className="tabular-nums text-xs">
                                          {scorePct}%
                                        </Badge>
                                      </div>
                                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                        <div
                                          className={cn(
                                            'h-full rounded-full transition-all',
                                            c.isWinner ? 'bg-primary' : 'bg-muted-foreground/40'
                                          )}
                                          style={{ width: `${scorePct}%` }}
                                        />
                                      </div>
                                    </CardContent>
                                  </Card>
                                );
                              })}
                            </div>
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  );
                })()}

              {currentPhase === 'training' &&
                (() => {
                  const p = job.progress;
                  const hasSteps = p.current_step != null && p.total_steps != null;
                  const stepPct = hasSteps
                    ? Math.round((p.current_step! / p.total_steps!) * 100)
                    : phaseProgress;
                  const currentEpoch =
                    hasSteps && p.total_epochs
                      ? Math.min(
                          Math.floor(p.current_step! / (p.total_steps! / p.total_epochs)) + 1,
                          p.total_epochs
                        )
                      : undefined;

                  return (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">Training</CardTitle>
                          <Badge variant="outline" className="tabular-nums">
                            {stepPct}%
                          </Badge>
                        </div>
                        <CardDescription>
                          Fine-tuning {studentName} with LoRA on curated data from {teacherName}.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        <div className="space-y-2">
                          <div className="flex items-baseline justify-between text-sm">
                            <span className="text-muted-foreground">
                              {hasSteps ? (
                                <>
                                  Step{' '}
                                  <span className="font-medium tabular-nums">{p.current_step}</span>{' '}
                                  of{' '}
                                  <span className="font-medium tabular-nums">{p.total_steps}</span>
                                </>
                              ) : (
                                'Training in progress...'
                              )}
                            </span>
                            {currentEpoch != null && p.total_epochs != null && (
                              <Badge variant="outline" className="tabular-nums text-xs">
                                Epoch {currentEpoch}/{p.total_epochs}
                              </Badge>
                            )}
                          </div>
                          <Progress value={stepPct} />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <Card className="bg-muted border-none shadow-none">
                            <CardContent className="py-3">
                              <p className="text-xs text-muted-foreground mb-0.5">Training Loss</p>
                              <p className="text-lg font-semibold tabular-nums">
                                {p.training_loss != null ? p.training_loss.toFixed(4) : '\u2014'}
                              </p>
                            </CardContent>
                          </Card>
                          <Card className="bg-muted border-none shadow-none">
                            <CardContent className="py-3">
                              <p className="text-xs text-muted-foreground mb-0.5">
                                Validation Loss
                              </p>
                              <p className="text-lg font-semibold tabular-nums">
                                {p.validation_loss != null
                                  ? p.validation_loss.toFixed(4)
                                  : '\u2014'}
                              </p>
                            </CardContent>
                          </Card>
                        </div>

                        {lossHistory.length >= 2 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-3">Loss over steps</p>
                            <ResponsiveContainer width="100%" height={200}>
                              <LineChart data={lossHistory}>
                                <CartesianGrid
                                  strokeDasharray="3 3"
                                  stroke="var(--color-border)"
                                  vertical={false}
                                />
                                <XAxis
                                  dataKey="step"
                                  tick={{
                                    fontSize: 11,
                                    fill: 'var(--color-muted-foreground)',
                                  }}
                                  axisLine={{ stroke: 'var(--color-border)' }}
                                  tickLine={false}
                                />
                                <YAxis
                                  tick={{
                                    fontSize: 11,
                                    fill: 'var(--color-muted-foreground)',
                                  }}
                                  axisLine={false}
                                  tickLine={false}
                                  width={45}
                                  domain={['auto', 'auto']}
                                />
                                <RechartsTooltip
                                  contentStyle={{
                                    backgroundColor: 'var(--color-card)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                  }}
                                  labelStyle={{
                                    color: 'var(--color-muted-foreground)',
                                  }}
                                  labelFormatter={(step) => `Step ${step}`}
                                />
                                <Legend
                                  iconSize={8}
                                  wrapperStyle={{
                                    fontSize: '12px',
                                    color: 'var(--color-muted-foreground)',
                                  }}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="training_loss"
                                  name="Train Loss"
                                  stroke="var(--color-foreground)"
                                  strokeWidth={1.5}
                                  dot={false}
                                  connectNulls
                                />
                                <Line
                                  type="monotone"
                                  dataKey="validation_loss"
                                  name="Val Loss"
                                  stroke="var(--color-muted-foreground)"
                                  strokeWidth={1.5}
                                  strokeDasharray="4 3"
                                  dot={false}
                                  connectNulls
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })()}

              {currentPhase === 'export' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Export</CardTitle>
                    <CardDescription>
                      Quantizing to {job.config.quantization.toUpperCase()} and packaging as GGUF.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Output:{' '}
                        <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                          {job.config.output_name}.gguf
                        </code>
                      </span>
                      <Badge variant="outline" className="tabular-nums">
                        {Math.round(phaseProgress)}%
                      </Badge>
                    </div>
                    <Progress value={phaseProgress} />
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {(job.status === 'queued' || job.status === 'pending') && (
            <Card>
              <CardContent className="flex items-center gap-3 py-6">
                <Loader2 className="size-5 animate-spin text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium">Waiting in queue</p>
                  <p className="text-sm text-muted-foreground">
                    Your job will start processing shortly.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
