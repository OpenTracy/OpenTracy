import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useUser } from '@/contexts/UserContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useEvaluations, useDatasets } from '@/features/evaluations';
import { useDeployments } from '@/hooks/useDeployments';
import { useDistillation } from '@/hooks/useDistillation';
import { useFineTuning } from '@/hooks/useFineTuning';
import { useIntegrationKeys } from '@/hooks/useIntegrationKeys';
import { useCredits } from '@/hooks/useCredits';
import { useApiKeys } from '@/hooks/useApiKeys';
import { useMetrics } from '@/contexts/MetricsContext';
import { useProfileService } from '@/services/profileService';
import { useOnboarding } from '@/hooks/useOnboarding';
import { TUTORIAL_STEPS } from '@/components/Tutorial';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import {
  Item,
  ItemContent,
  ItemMedia,
  ItemTitle,
  ItemDescription,
  ItemActions,
  ItemGroup,
  ItemSeparator,
} from '@/components/ui/item';

import {
  Sparkles,
  Database,
  Beaker,
  Rocket,
  FlaskConical,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  CheckCircle2,
  Loader2,
  TrendingDown,
  TrendingUp,
  Pause,
  GraduationCap,
  Activity,
  BarChart3,
  Route,
  SplitSquareHorizontal,
  Zap,
  Clock,
  AlertTriangle,
  DollarSign,
  KeyRound,
  CreditCard,
  Layers,
  FileText,
  BookOpen,
  MessageCircle,
  ExternalLink,
  type LucideIcon,
} from 'lucide-react';

type PipelineStatus = 'collecting' | 'training' | 'evaluating' | 'deployed' | 'paused';

interface Pipeline {
  id: string;
  name: string;
  teacher: string;
  student: string;
  status: PipelineStatus;
  progress: number;
  dataPoints: number;
}

const PIPELINE_STATUS_CONFIG: Record<
  PipelineStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline'; Icon: LucideIcon; spin?: boolean }
> = {
  collecting: { label: 'Collecting', variant: 'secondary', Icon: Database },
  training: { label: 'Training', variant: 'default', Icon: Loader2, spin: true },
  evaluating: { label: 'Evaluating', variant: 'outline', Icon: FlaskConical },
  deployed: { label: 'Deployed', variant: 'secondary', Icon: CheckCircle2 },
  paused: { label: 'Paused', variant: 'outline', Icon: Pause },
};

const PIPELINE_STATUS_PRIORITY: Record<PipelineStatus, number> = {
  training: 0,
  evaluating: 1,
  collecting: 2,
  deployed: 3,
  paused: 4,
};

const WORKFLOW_STEPS = [
  {
    id: 'data',
    label: 'Data Sources',
    description: 'Connect teacher models',
    path: '/data-sources',
  },
  {
    id: 'build',
    label: 'Distill Studio',
    description: 'Create datasets & train',
    path: '/distill-jobs',
  },
  {
    id: 'ship',
    label: 'Production',
    description: 'Deploy distilled models',
    path: '/production',
  },
  {
    id: 'validate',
    label: 'Eval Lab',
    description: 'Compare & benchmark',
    path: '/distill-metrics',
  },
] as const;

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function fmtCurrency(v: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

function fmtNumber(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toString();
}

function fmtLatency(s: number) {
  if (s < 1) return `${Math.round(s * 1000)}ms`;
  return `${s.toFixed(2)}s`;
}

function normalizeCreditsValue(v: number | null | undefined): number | null {
  if (v == null || Number.isNaN(v)) return null;
  return v / 100;
}

function normalizeModelName(value: string | null | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function TrendIndicator({
  value,
  invert = false,
}: {
  value: number | null | undefined;
  invert?: boolean;
}) {
  if (value == null) return null;
  const isGood = invert ? value < 0 : value > 0;
  const Icon = value >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium',
        isGood ? 'text-foreground' : 'text-destructive'
      )}
    >
      <Icon className="size-3" />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function OverviewMetric({
  icon: Icon,
  label,
  value,
  subtitle,
  trend,
  invertTrend = false,
  accent = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  subtitle?: string;
  trend?: number | null;
  invertTrend?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        'group relative rounded-xl border p-4 transition-colors hover:bg-accent/40',
        accent ? 'bg-primary/5 border-primary/20' : 'bg-card'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-lg',
            accent ? 'bg-primary/10' : 'bg-muted'
          )}
        >
          <Icon className={cn('size-4', accent ? 'text-primary' : 'text-muted-foreground')} />
        </div>
        <TrendIndicator value={trend} invert={invertTrend} />
      </div>
      <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-foreground/80">{label}</p>
      {subtitle && <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function WorkflowStep({
  order,
  label,
  description,
  path,
}: {
  order: number;
  label: string;
  description: string;
  path: string;
}) {
  const navigate = useNavigate();
  return (
    <Button
      variant="ghost"
      className="h-auto w-full justify-between rounded-lg px-3 py-3 text-left transition-colors hover:bg-accent/40"
      onClick={() => navigate(path)}
    >
      <span className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
          {order}
        </span>
        <span className="flex-1">
          <span className="block text-xs font-semibold leading-none">{label}</span>
          <span className="mt-1 block text-[11px] text-muted-foreground leading-relaxed">
            {description}
          </span>
        </span>
      </span>
      <span className="inline-flex size-6 items-center justify-center rounded-md border">
        <ChevronRight className="size-3.5 text-muted-foreground" />
      </span>
    </Button>
  );
}

function PipelineCard({ pipeline }: { pipeline: Pipeline }) {
  const navigate = useNavigate();
  const { label, variant, Icon, spin } = PIPELINE_STATUS_CONFIG[pipeline.status];
  const showProgress = pipeline.status !== 'deployed' && pipeline.status !== 'paused';

  return (
    <Card
      className="group cursor-pointer gap-3 py-4 transition-colors hover:bg-accent/30"
      onClick={() => navigate('/distill-jobs')}
    >
      <CardHeader className="px-4 pb-0">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm truncate leading-tight">{pipeline.name}</CardTitle>
          <Badge variant={variant} className="gap-1 shrink-0 text-[11px]">
            <Icon className={cn('size-3', spin && 'animate-spin')} />
            {label}
          </Badge>
        </div>
        <CardDescription className="text-[11px] line-clamp-1">
          {normalizeModelName(pipeline.teacher, 'Teacher')} →{' '}
          {normalizeModelName(pipeline.student, 'Student')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 px-4 pt-0">
        {showProgress && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium tabular-nums">{pipeline.progress}%</span>
            </div>
            <Progress value={pipeline.progress} className="h-1.5" />
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          {fmtNumber(pipeline.dataPoints)} data points
        </p>
      </CardContent>
    </Card>
  );
}

function PipelinesSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-3 w-28" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PipelinesEmpty() {
  const navigate = useNavigate();
  return (
    <Card>
      <CardContent className="py-8">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Sparkles />
            </EmptyMedia>
            <EmptyTitle>No active pipelines</EmptyTitle>
            <EmptyDescription>
              Start your first distillation pipeline to see progress here.
            </EmptyDescription>
          </EmptyHeader>
          <Button size="sm" onClick={() => navigate('/distill-new')}>
            <Sparkles className="size-4" />
            Start Distillation
          </Button>
        </Empty>
      </CardContent>
    </Card>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
  details,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  details: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Card className="cursor-pointer transition-colors hover:bg-accent/60" onClick={onClick}>
      <CardHeader className="pb-1.5">
        <CardDescription className="flex items-center gap-1.5">
          <Icon className="size-3.5" /> {label}
        </CardDescription>
        <CardTitle className="text-xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {details}
        </div>
      </CardContent>
    </Card>
  );
}

function ChecklistRow({
  label,
  checked,
  onClick,
}: {
  label: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      className="h-auto w-full justify-start gap-3 px-0 py-1"
      onClick={onClick}
    >
      <Checkbox checked={checked} className="pointer-events-none" tabIndex={-1} />
      <span className={cn('text-sm font-normal', checked && 'text-muted-foreground line-through')}>
        {label}
      </span>
    </Button>
  );
}

function NavItem({
  icon: Icon,
  title,
  description,
  path,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  path: string;
}) {
  const navigate = useNavigate();
  return (
    <Item
      size="sm"
      className="cursor-pointer rounded-md border border-border hover:bg-accent transition-colors"
      onClick={() => navigate(path)}
    >
      <ItemMedia variant="icon">
        <Icon className="size-4" />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
        <ItemDescription>{description}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <ChevronRight className="size-4 text-muted-foreground" />
      </ItemActions>
    </Item>
  );
}

function ResourceLink({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Button
      variant="ghost"
      className="h-auto w-full justify-start gap-3 px-2 py-2"
      onClick={() => window.open(href, '_blank', 'noopener,noreferrer')}
    >
      <Icon className="size-4 text-muted-foreground shrink-0" />
      <span className="flex-1 text-left">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground font-normal">{description}</span>
      </span>
      <ExternalLink className="size-3.5 text-muted-foreground shrink-0" />
    </Button>
  );
}

function InsightItem({
  insight,
}: {
  insight: { type: string; message: string; severity: string };
}) {
  const severityClass =
    insight.severity === 'high'
      ? 'text-destructive'
      : insight.severity === 'medium'
        ? 'text-foreground'
        : 'text-muted-foreground';
  const Icon =
    insight.type === 'anomaly' ? AlertTriangle : insight.type === 'trend' ? TrendingUp : Activity;
  return (
    <div className="flex items-start gap-2 text-xs">
      <Icon className={cn('size-3.5 mt-0.5 shrink-0', severityClass)} />
      <span className="text-muted-foreground leading-relaxed">{insight.message}</span>
    </div>
  );
}

function PerformanceMetricCard({
  label,
  value,
  subtitle,
  emphasize = false,
}: {
  label: string;
  value: string;
  subtitle?: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5',
        emphasize ? 'border-primary/30 bg-primary/5' : 'bg-card'
      )}
    >
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
      {subtitle && <p className="mt-0.5 text-[10px] text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

export default function CommandCenter() {
  const navigate = useNavigate();
  const { user, accessToken } = useUser();
  useWorkspace();
  const { overviewData, analyticsData } = useMetrics();
  const { evaluations, loading: evalsLoading } = useEvaluations();
  const { deployments } = useDeployments();
  const { datasets } = useDatasets();
  const { jobs: distillJobs } = useDistillation();
  const { jobs: ftJobs } = useFineTuning();
  const { configuredProviders } = useIntegrationKeys();
  const { credits } = useCredits();
  const { apiKeys } = useApiKeys();
  const { fetchProfile } = useProfileService();

  const {
    step: tutorialStep,
    isActive: isTutorialActive,
    restart: restartTutorial,
  } = useOnboarding();

  const [searchParams, setSearchParams] = useSearchParams();
  const highlightTutorial = searchParams.get('highlight') === 'tutorial';
  const tutorialBtnRef = useRef<HTMLButtonElement>(null);
  const [creditsBalance, setCreditsBalance] = useState<number | null>(null);

  const userName = user?.email?.split('@')[0] || 'there';

  useEffect(() => {
    if (!highlightTutorial || !tutorialBtnRef.current) return;
    tutorialBtnRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = setTimeout(() => {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.delete('highlight');
          return n;
        },
        { replace: true }
      );
    }, 6_000);
    return () => clearTimeout(timer);
  }, [highlightTutorial, setSearchParams]);

  useEffect(() => {
    if (!accessToken) return;
    (async () => {
      try {
        const profile = await fetchProfile(accessToken);
        setCreditsBalance(profile.credits_balance);
      } catch {
        console.error('Failed to fetch profile data');
      }
    })();
  }, [accessToken, fetchProfile]);

  const analytics = useMemo(() => {
    const totals = analyticsData.metrics?.totals;
    const trends = analyticsData.metrics?.trends;
    const distributions = analyticsData.metrics?.distributions;
    const leaders = analyticsData.metrics?.leaders;
    const insights = analyticsData.metrics?.insights ?? [];
    return { totals, trends, distributions, leaders, insights };
  }, [analyticsData]);

  const deploymentStats = useMemo(() => {
    const all = deployments ?? [];
    const active = all.filter((d) => d.status === 'active' || d.status === 'in_service');
    const failed = all.filter((d) => d.status === 'failed');
    const starting = all.filter((d) => ['pending', 'creating', 'starting'].includes(d.status));
    return {
      total: all.length,
      active: active.length,
      failed: failed.length,
      starting: starting.length,
    };
  }, [deployments]);

  const distillStats = useMemo(() => {
    const all = distillJobs ?? [];
    const running = all.filter((j) => j.status === 'running' || j.status === 'queued');
    const completed = all.filter((j) => j.status === 'completed');
    const totalCost = all.reduce((sum, j) => sum + (j.cost_accrued ?? 0), 0);
    return { total: all.length, running: running.length, completed: completed.length, totalCost };
  }, [distillJobs]);

  const ftStats = useMemo(() => {
    const all = ftJobs ?? [];
    const running = all.filter((j) => j.status === 'running' || j.status === 'pending');
    const completed = all.filter((j) => j.status === 'completed');
    return { total: all.length, running: running.length, completed: completed.length };
  }, [ftJobs]);

  const pipelines: Pipeline[] = useMemo(() => {
    const fromEvals: Pipeline[] = (evaluations ?? []).map((e) => {
      const status: PipelineStatus =
        e.status === 'running'
          ? 'training'
          : e.status === 'queued' || e.status === 'starting'
            ? 'collecting'
            : e.status === 'completed'
              ? 'deployed'
              : 'paused';

      const progress =
        e.progress?.completed_samples && e.progress?.total_samples
          ? Math.round((e.progress.completed_samples / e.progress.total_samples) * 100)
          : e.status === 'completed'
            ? 100
            : 0;

      return {
        id: `eval-${e.id}`,
        name: e.name,
        teacher: normalizeModelName(e.models?.[0], 'GPT-4'),
        student: 'Custom Model',
        status,
        progress,
        dataPoints: e.progress?.total_samples ?? 0,
      };
    });

    const fromDistill: Pipeline[] = (distillJobs ?? []).map((j) => {
      const status: PipelineStatus =
        j.status === 'running'
          ? j.phase === 'training'
            ? 'training'
            : j.phase === 'data_generation' || j.phase === 'curation'
              ? 'collecting'
              : 'evaluating'
          : j.status === 'queued' || j.status === 'pending'
            ? 'collecting'
            : j.status === 'completed'
              ? 'deployed'
              : 'paused';

      const progress = j.progress?.overall_progress ?? (j.status === 'completed' ? 100 : 0);

      return {
        id: `distill-${j.id}`,
        name: j.name,
        teacher: normalizeModelName(j.config?.teacher_model, 'Teacher'),
        student: normalizeModelName(j.config?.student_model, 'Student'),
        status,
        progress,
        dataPoints: j.progress?.candidates_generated ?? j.config?.n_samples ?? 0,
      };
    });

    const all = [...fromEvals, ...fromDistill];
    all.sort((a, b) => PIPELINE_STATUS_PRIORITY[a.status] - PIPELINE_STATUS_PRIORITY[b.status]);
    return all.slice(0, 4);
  }, [evaluations, distillJobs]);

  const hasTeachers = (configuredProviders?.length ?? 0) > 0;
  const hasTraces = analyticsData.totalTraces > 0;
  const hasDatasets = (datasets?.length ?? 0) > 0;
  const hasDistillJobs = (distillJobs?.length ?? 0) > 0;
  const hasCompletedJobs = distillStats.completed > 0;

  const checklistItems = [
    { label: 'Connect a teacher model', checked: hasTeachers, path: '/data-sources' },
    { label: 'Test the playground', checked: hasTraces, path: '/compare' },
    { label: 'Create a dataset', checked: hasDatasets, path: '/distill-datasets' },
    { label: 'Train a distilled model', checked: hasDistillJobs, path: '/distill-new' },
    { label: 'Download your model', checked: hasCompletedJobs, path: '/distill-jobs' },
  ];
  const completedCount = checklistItems.filter((i) => i.checked).length;
  const showChecklist = completedCount < 4;
  const checklistProgress = Math.round((completedCount / checklistItems.length) * 100);
  const nextChecklistItem = checklistItems.find((item) => !item.checked);

  const handleTutorial = useCallback(async () => {
    if (isTutorialActive) {
      const s = TUTORIAL_STEPS.find((s) => s.id === tutorialStep);
      navigate(s?.route ?? '/data-sources');
    } else {
      await restartTutorial();
      navigate('/data-sources');
    }
  }, [isTutorialActive, tutorialStep, navigate, restartTutorial]);

  const externalCost = overviewData?.external?.totalCost ?? 0;
  const opentracyCost = overviewData?.opentracy?.totalCost ?? 0;
  const totalCost = externalCost + opentracyCost;
  const opentracyShare = totalCost > 0 ? (opentracyCost / totalCost) * 100 : 0;
  const savingsEstimate = externalCost * 0.7;
  const creditsValue = useMemo(() => {
    const sourceValue = credits?.credits ?? creditsBalance;
    return normalizeCreditsValue(sourceValue);
  }, [credits?.credits, creditsBalance]);
  const topModels = analytics.leaders?.top_cost_models?.slice(0, 3) ?? [];
  const slowestModels = analytics.leaders?.slowest_models_p95_latency?.slice(0, 3) ?? [];
  const totalDatasetSamples =
    datasets?.reduce((sum, item) => sum + (item.samples_count ?? 0), 0) ?? 0;

  const hasAnalytics =
    !!analytics.trends ||
    topModels.length > 0 ||
    slowestModels.length > 0 ||
    opentracyCost > 0 ||
    externalCost > 0 ||
    !!analytics.distributions;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title={`${getGreeting()}, ${userName}`}
        action={
          <Button onClick={() => navigate('/distill-new')}>
            <Sparkles className="size-4" />
            New Distillation
          </Button>
        }
      />

      <main className="space-y-6 p-4 md:p-6 xl:p-8">
        <section className="space-y-3">
          <SectionHeader
            title="Workspace Overview"
            subtitle="Health, spend and performance — at a glance."
            action={
              <Button variant="ghost" size="xs" onClick={() => navigate('/observability')}>
                Analytics <ChevronRight className="size-3.5" />
              </Button>
            }
          />

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <OverviewMetric
              icon={Activity}
              label="Total Requests"
              value={fmtNumber(analytics.totals?.request_count ?? 0)}
              subtitle={analytics.trends ? `7d trend` : 'All time'}
              trend={analytics.trends?.pct_change.requests}
            />
            <OverviewMetric
              icon={DollarSign}
              label="Total Cost"
              value={fmtCurrency(analytics.totals?.total_cost_usd ?? totalCost)}
              subtitle="Current period"
              trend={analytics.trends?.pct_change.cost_usd}
              invertTrend
            />
            <OverviewMetric
              icon={Clock}
              label="P95 Latency"
              value={analytics.totals ? fmtLatency(analytics.totals.p95_latency_s) : '—'}
              subtitle={
                analytics.totals ? `Avg ${fmtLatency(analytics.totals.avg_latency_s)}` : undefined
              }
              trend={analytics.trends?.pct_change.p95_latency_s}
              invertTrend
            />
            <OverviewMetric
              icon={CheckCircle2}
              label="Success Rate"
              value={
                analytics.totals ? `${(analytics.totals.success_rate * 100).toFixed(1)}%` : '—'
              }
              subtitle="Request reliability"
              trend={analytics.trends?.pct_change.error_rate}
              invertTrend
            />
            <OverviewMetric
              icon={TrendingDown}
              label="Est. Savings"
              value={fmtCurrency(savingsEstimate)}
              subtitle="vs direct API"
              accent
            />
            <OverviewMetric
              icon={Zap}
              label="Credits"
              value={creditsValue != null ? fmtCurrency(creditsValue) : '—'}
              subtitle="Available balance"
              accent
            />
          </div>
        </section>

        <section className="space-y-3">
          <SectionHeader title="Distillation Workflow" subtitle="Data → Build → Ship → Validate" />
          <Card className="gap-0 py-2">
            <CardContent className="grid grid-cols-1 gap-1 py-1 md:grid-cols-2 xl:grid-cols-4">
              {WORKFLOW_STEPS.map((s, index) => (
                <WorkflowStep
                  key={s.id}
                  order={index + 1}
                  label={s.label}
                  description={s.description}
                  path={s.path}
                />
              ))}
            </CardContent>
          </Card>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            <section className="space-y-3">
              <SectionHeader
                title="Active Pipelines"
                subtitle="Most relevant running and recent distillation activity"
                action={
                  <Button variant="ghost" size="xs" onClick={() => navigate('/distill-jobs')}>
                    View all <ChevronRight className="size-3.5" />
                  </Button>
                }
              />
              {evalsLoading ? (
                <PipelinesSkeleton />
              ) : pipelines.length === 0 ? (
                <PipelinesEmpty />
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-2">
                  {pipelines.map((p) => (
                    <PipelineCard key={p.id} pipeline={p} />
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <SectionHeader
                title="Platform Status"
                subtitle="Operational state of deployments, training and data assets"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatusCard
                  icon={Rocket}
                  label="Deployments"
                  value={deploymentStats.total}
                  onClick={() => navigate('/production')}
                  details={
                    <>
                      <span>{deploymentStats.active} active</span>
                      {deploymentStats.starting > 0 && (
                        <span>{deploymentStats.starting} starting</span>
                      )}
                      {deploymentStats.failed > 0 && (
                        <span className="text-destructive">{deploymentStats.failed} failed</span>
                      )}
                    </>
                  }
                />
                <StatusCard
                  icon={Beaker}
                  label="Distill Jobs"
                  value={distillStats.total}
                  onClick={() => navigate('/distill-jobs')}
                  details={
                    <>
                      {distillStats.running > 0 && <span>{distillStats.running} running</span>}
                      <span>{distillStats.completed} completed</span>
                    </>
                  }
                />
                <StatusCard
                  icon={Layers}
                  label="Fine-Tuning"
                  value={ftStats.total}
                  onClick={() => navigate('/fine-tuning')}
                  details={
                    <>
                      {ftStats.running > 0 && <span>{ftStats.running} running</span>}
                      <span>{ftStats.completed} completed</span>
                    </>
                  }
                />
                <StatusCard
                  icon={FileText}
                  label="Datasets"
                  value={datasets?.length ?? 0}
                  onClick={() => navigate('/distill-datasets')}
                  details={<span>{fmtNumber(totalDatasetSamples)} total samples</span>}
                />
              </div>
            </section>

            {hasAnalytics && (
              <section className="space-y-3">
                <SectionHeader
                  title="Analytics"
                  subtitle="Trends, model behavior and performance distributions"
                  action={
                    <Button variant="ghost" size="xs" onClick={() => navigate('/observability')}>
                      Full Dashboard <ChevronRight className="size-3.5" />
                    </Button>
                  }
                />
                <Card>
                  <Tabs defaultValue="trends">
                    <CardHeader className="pb-0">
                      <TabsList>
                        {analytics.trends && <TabsTrigger value="trends">Trends</TabsTrigger>}
                        {(topModels.length > 0 || slowestModels.length > 0) && (
                          <TabsTrigger value="models">Models</TabsTrigger>
                        )}
                        {(opentracyCost > 0 || externalCost > 0) && (
                          <TabsTrigger value="costs">Costs</TabsTrigger>
                        )}
                        {analytics.distributions && (
                          <TabsTrigger value="performance">Performance</TabsTrigger>
                        )}
                      </TabsList>
                    </CardHeader>

                    <CardContent className="pt-4">
                      {analytics.trends && (
                        <TabsContent value="trends" className="mt-0">
                          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Requests</p>
                              <p className="text-lg font-semibold tabular-nums">
                                {fmtNumber(analytics.trends.last_7d.requests)}
                              </p>
                              <TrendIndicator value={analytics.trends.pct_change.requests} />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Cost</p>
                              <p className="text-lg font-semibold tabular-nums">
                                {fmtCurrency(analytics.trends.last_7d.cost_usd)}
                              </p>
                              <TrendIndicator value={analytics.trends.pct_change.cost_usd} invert />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">P95 Latency</p>
                              <p className="text-lg font-semibold tabular-nums">
                                {fmtLatency(analytics.trends.last_7d.p95_latency_s)}
                              </p>
                              <TrendIndicator
                                value={analytics.trends.pct_change.p95_latency_s}
                                invert
                              />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Error Rate</p>
                              <p className="text-lg font-semibold tabular-nums">
                                {(analytics.trends.last_7d.error_rate * 100).toFixed(2)}%
                              </p>
                              <TrendIndicator
                                value={analytics.trends.pct_change.error_rate}
                                invert
                              />
                            </div>
                          </div>
                        </TabsContent>
                      )}

                      {(topModels.length > 0 || slowestModels.length > 0) && (
                        <TabsContent value="models" className="mt-0 space-y-6">
                          {topModels.length > 0 && (
                            <div className="space-y-2">
                              <h3 className="text-xs font-medium text-muted-foreground">
                                Top by Cost
                              </h3>
                              <ItemGroup>
                                {topModels.map((m, i) => (
                                  <Fragment key={m.model_id}>
                                    {i > 0 && <ItemSeparator />}
                                    <Item size="sm" className="px-0">
                                      <ItemContent>
                                        <ItemTitle className="text-xs font-mono">
                                          {m.model_id}
                                        </ItemTitle>
                                        <ItemDescription>
                                          {fmtNumber(m.request_count)} requests
                                        </ItemDescription>
                                      </ItemContent>
                                      <ItemActions>
                                        <Badge variant="outline" className="text-xs tabular-nums">
                                          {fmtCurrency(m.total_cost_usd)}
                                        </Badge>
                                      </ItemActions>
                                    </Item>
                                  </Fragment>
                                ))}
                              </ItemGroup>
                            </div>
                          )}

                          {slowestModels.length > 0 && (
                            <div className="space-y-2">
                              <h3 className="text-xs font-medium text-muted-foreground">
                                Slowest (P95)
                              </h3>
                              <ItemGroup>
                                {slowestModels.map((m, i) => (
                                  <Fragment key={m.model_id}>
                                    {i > 0 && <ItemSeparator />}
                                    <Item size="sm" className="px-0">
                                      <ItemContent>
                                        <ItemTitle className="text-xs font-mono">
                                          {m.model_id}
                                        </ItemTitle>
                                        <ItemDescription>
                                          {fmtNumber(m.count)} requests
                                        </ItemDescription>
                                      </ItemContent>
                                      <ItemActions>
                                        <Badge variant="outline" className="text-xs tabular-nums">
                                          {fmtLatency(m.p95_latency_s)}
                                        </Badge>
                                      </ItemActions>
                                    </Item>
                                  </Fragment>
                                ))}
                              </ItemGroup>
                            </div>
                          )}
                        </TabsContent>
                      )}

                      {(opentracyCost > 0 || externalCost > 0) && (
                        <TabsContent value="costs" className="mt-0">
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                              <div className="rounded-lg border bg-primary/5 p-3">
                                <p className="text-[11px] text-muted-foreground">
                                  OpenTracy (Optimized)
                                </p>
                                <p className="mt-1 text-base font-semibold tabular-nums">
                                  {fmtCurrency(opentracyCost)}
                                </p>
                              </div>
                              <div className="rounded-lg border bg-card p-3">
                                <p className="text-[11px] text-muted-foreground">
                                  External (Direct)
                                </p>
                                <p className="mt-1 text-base font-semibold tabular-nums">
                                  {fmtCurrency(externalCost)}
                                </p>
                              </div>
                              <div className="rounded-lg border bg-card p-3">
                                <p className="text-[11px] text-muted-foreground">Total Spend</p>
                                <p className="mt-1 text-base font-semibold tabular-nums">
                                  {fmtCurrency(totalCost)}
                                </p>
                              </div>
                            </div>

                            <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                              <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                  <span className="inline-block size-2 rounded-full bg-primary" />
                                  OpenTracy share: {opentracyShare.toFixed(1)}%
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <span className="inline-block size-2 rounded-full bg-muted-foreground/40" />
                                  External share: {(100 - opentracyShare).toFixed(1)}%
                                </span>
                              </div>
                              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                                <div
                                  className="h-full rounded-full bg-primary transition-all duration-500"
                                  style={{ width: `${Math.max(0, Math.min(100, opentracyShare))}%` }}
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs text-muted-foreground">
                              <span>Estimated savings vs external-only</span>
                              <span className="font-medium tabular-nums text-foreground">
                                {fmtCurrency(savingsEstimate)}
                              </span>
                            </div>
                          </div>
                        </TabsContent>
                      )}

                      {analytics.distributions && (
                        <TabsContent value="performance" className="mt-0 space-y-5">
                          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                            <div className="rounded-xl border bg-muted/20 p-3 space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-medium tracking-tight">
                                  Latency Distribution
                                </p>
                                <Badge variant="secondary" className="text-[10px]">
                                  Lower is better
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {(['p50', 'p90', 'p95', 'p99'] as const).map((p) => (
                                  <PerformanceMetricCard
                                    key={p}
                                    label={p.toUpperCase()}
                                    value={fmtLatency(analytics.distributions!.latency_s[p])}
                                    emphasize={p === 'p95' || p === 'p99'}
                                  />
                                ))}
                              </div>
                            </div>

                            {analytics.distributions.ttft_s.p50 > 0 && (
                              <div className="rounded-xl border bg-muted/20 p-3 space-y-3">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-medium tracking-tight">
                                    Time to First Token
                                  </p>
                                  <Badge variant="outline" className="text-[10px]">
                                    Streaming responsiveness
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  {(['p50', 'p90', 'p95', 'p99'] as const).map((p) => (
                                    <PerformanceMetricCard
                                      key={p}
                                      label={p.toUpperCase()}
                                      value={fmtLatency(analytics.distributions!.ttft_s[p])}
                                      emphasize={p === 'p95' || p === 'p99'}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="rounded-xl border bg-muted/20 p-3 space-y-3">
                            <p className="text-xs font-medium tracking-tight">
                              Token & Cost Efficiency
                            </p>
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                              <PerformanceMetricCard
                                label="Avg Input"
                                value={fmtNumber(analytics.distributions.input_tokens.mean)}
                                subtitle="tokens"
                              />
                              <PerformanceMetricCard
                                label="Avg Output"
                                value={fmtNumber(analytics.distributions.output_tokens.mean)}
                                subtitle="tokens"
                              />
                              <PerformanceMetricCard
                                label="Cost / Request"
                                value={fmtCurrency(
                                  analytics.distributions.cost_per_request_usd.mean
                                )}
                                subtitle="USD"
                                emphasize
                              />
                            </div>
                          </div>
                        </TabsContent>
                      )}
                    </CardContent>
                  </Tabs>
                </Card>

                {analytics.insights.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Insights</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {analytics.insights.slice(0, 5).map((ins, i) => (
                        <InsightItem key={i} insight={ins} />
                      ))}
                    </CardContent>
                  </Card>
                )}
              </section>
            )}
          </div>

          <div className="space-y-6 lg:col-span-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Action Center</CardTitle>
                <CardDescription className="text-xs">
                  Focus on the next highest-impact action.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Onboarding Progress</span>
                    <span className="font-medium tabular-nums">{completedCount}/5</span>
                  </div>
                  <Progress value={checklistProgress} />
                </div>

                {nextChecklistItem && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full justify-between"
                    onClick={() => navigate(nextChecklistItem.path)}
                  >
                    Next: {nextChecklistItem.label}
                    <ChevronRight className="size-4" />
                  </Button>
                )}

                {showChecklist && (
                  <div className="space-y-0.5">
                    {checklistItems.map((item) => (
                      <ChecklistRow
                        key={item.label}
                        label={item.label}
                        checked={item.checked}
                        onClick={() => navigate(item.path)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <Button
                  ref={tutorialBtnRef}
                  variant={isTutorialActive ? 'default' : 'outline'}
                  size="sm"
                  className={cn(
                    'w-full',
                    highlightTutorial &&
                      'ring-2 ring-ring ring-offset-2 ring-offset-background animate-pulse'
                  )}
                  onClick={handleTutorial}
                >
                  <GraduationCap className="size-4" />
                  {isTutorialActive ? 'Continue Walkthrough' : 'Interactive Walkthrough'}
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm">Quick Access</CardTitle>
                <CardDescription className="text-xs">
                  Navigate creation and operations without a long list.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Tabs defaultValue="build" className="space-y-3">
                  <TabsList className="w-full">
                    <TabsTrigger value="build" className="flex-1">
                      Build
                    </TabsTrigger>
                    <TabsTrigger value="operate" className="flex-1">
                      Operate
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="build" className="mt-0 space-y-1.5">
                    <NavItem
                      icon={Database}
                      title="Data Sources"
                      description={`${configuredProviders?.length ?? 0} providers`}
                      path="/data-sources"
                    />
                    <NavItem
                      icon={Beaker}
                      title="Distill Jobs"
                      description={`${distillStats.running} running`}
                      path="/distill-jobs"
                    />
                    <NavItem
                      icon={Layers}
                      title="Datasets"
                      description={`${datasets?.length ?? 0} datasets`}
                      path="/distill-datasets"
                    />
                    <NavItem
                      icon={SplitSquareHorizontal}
                      title="Compare"
                      description="Teacher vs student"
                      path="/compare"
                    />
                  </TabsContent>

                  <TabsContent value="operate" className="mt-0 space-y-1.5">
                    <NavItem
                      icon={Rocket}
                      title="Production"
                      description={`${deploymentStats.active} active`}
                      path="/production"
                    />
                    <NavItem
                      icon={BarChart3}
                      title="Observability"
                      description="Metrics & analytics"
                      path="/observability"
                    />
                    <NavItem
                      icon={Route}
                      title="Traces"
                      description={`${fmtNumber(analyticsData.totalTraces)} traces`}
                      path="/traces"
                    />
                    <NavItem
                      icon={Layers}
                      title="Fine-Tuning"
                      description={`${ftStats.total} jobs`}
                      path="/fine-tuning"
                    />
                    <NavItem
                      icon={KeyRound}
                      title="API Keys"
                      description={`${apiKeys?.length ?? 0} keys`}
                      path="/api-keys"
                    />
                    <NavItem
                      icon={CreditCard}
                      title="Billing"
                      description="Credits & plans"
                      path="/billing"
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <Card className="gap-3">
              <CardHeader className="pb-0">
                <CardTitle className="text-sm">Resources</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 pt-0">
                <ResourceLink
                  icon={BookOpen}
                  title="Documentation"
                  description="Guides & API reference"
                  href="https://docs.lunar-sys.com"
                />
                <ResourceLink
                  icon={MessageCircle}
                  title="Community"
                  description="Get help on Discord"
                  href="https://discord.gg/thyZx5GkFV"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
