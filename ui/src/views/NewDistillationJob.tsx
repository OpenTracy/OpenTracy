import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  Database,
  Target,
  Gauge,
  Scale,
  Loader2,
  Cpu,
  HardDrive,
  Search,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Slider } from '@/components/shared/Slider';

import { useDistillation } from '@/hooks/useDistillation';
import { useDatasets } from '@/hooks/useDatasets';
import { useTutorialStep } from '@/components/Tutorial';
import {
  TEACHER_MODELS,
  STUDENT_MODELS,
  STUDENT_MODEL_FAMILIES,
  QUANTIZATION_OPTIONS,
  CURATION_AGENTS,
  type CurationAgentConfig,
  type AvailableTeacherModel,
} from '@/types/distillationTypes';

const AGENT_ICONS = {
  quality: Target,
  difficulty: Gauge,
  consensus: Scale,
} as const;

export default function NewDistillationJob() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedDatasetId = searchParams.get('dataset');

  const { createJob, estimateJob, listAvailableModels } = useDistillation();
  const tutorialStep = 0;
  const isTutorialActive = false;
  const advanceTutorial = async () => {};
  useTutorialStep(4, false);
  const { datasets } = useDatasets();
  const [teacherModels, setTeacherModels] = useState<AvailableTeacherModel[]>([]);
  const [teacherModelsLoading, setTeacherModelsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [estimate, setEstimate] = useState<{
    estimated_cost: number;
    is_sandbox: boolean;
    tier: string;
    balance: number;
    sufficient: boolean;
  } | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);

  const [jobName, setJobName] = useState('');
  const [teacherModel, setTeacherModel] = useState('');
  const [teacherSearch, setTeacherSearch] = useState('');
  const [studentModel, setStudentModel] = useState('llama-3.2-1b');
  const [studentSearch, setStudentSearch] = useState('');
  const defaultStudentFamily =
    STUDENT_MODELS.find((m) => m.id === studentModel)?.family ?? STUDENT_MODEL_FAMILIES[0];
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(
    new Set([defaultStudentFamily])
  );
  const [dataSource, setDataSource] = useState<'existing' | 'upload'>('existing');
  const [selectedDatasetId, setSelectedDatasetId] = useState(preselectedDatasetId || '');
  const [nSamples, setNSamples] = useState(5);
  const [temperature, setTemperature] = useState(0.7);
  const [quantization, setQuantization] = useState('q4_k_m');
  const [outputName, setOutputName] = useState('');

  const [agents, setAgents] = useState<CurationAgentConfig[]>([
    { id: 'quality', enabled: true, threshold: 0.7 },
    { id: 'difficulty', enabled: true },
    { id: 'consensus', enabled: true, threshold: 0.6 },
  ]);

  const toggleAgent = (agentId: CurationAgentConfig['id']) => {
    setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, enabled: !a.enabled } : a)));
  };

  const setAgentThreshold = (agentId: CurationAgentConfig['id'], threshold: number) => {
    setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, threshold } : a)));
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setTeacherModelsLoading(true);
      const models = await listAvailableModels();
      if (cancelled) return;
      if (models.length > 0) {
        setTeacherModels(models);
        if (!teacherModel) setTeacherModel(models[0].id);
      } else {
        const fallback = TEACHER_MODELS.map((m) => ({
          id: m.id,
          name: m.name,
          provider: m.provider,
          type: 'external' as const,
          available: true,
        }));
        setTeacherModels(fallback);
        if (!teacherModel) setTeacherModel(fallback[0].id);
      }
      setTeacherModelsLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredTeacherModels = useMemo(() => {
    if (!teacherSearch) return teacherModels;
    const q = teacherSearch.toLowerCase();
    return teacherModels.filter(
      (m) => m.name.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q)
    );
  }, [teacherSearch, teacherModels]);

  const studentModelGroups = useMemo(() => {
    const filtered = studentSearch
      ? STUDENT_MODELS.filter((m) => m.name.toLowerCase().includes(studentSearch.toLowerCase()))
      : STUDENT_MODELS;

    return STUDENT_MODEL_FAMILIES.map((family) => ({
      family,
      models: filtered.filter((m) => m.family === family),
    })).filter((g) => g.models.length > 0);
  }, [studentSearch]);

  const toggleFamily = (family: string) => {
    setExpandedFamilies((prev) => {
      const next = new Set(prev);
      if (next.has(family)) next.delete(family);
      else next.add(family);
      return next;
    });
  };

  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId);
  const sampleCount = selectedDataset?.samples_count || 0;

  const fetchEstimate = useCallback(async () => {
    if (!studentModel || sampleCount <= 0) {
      setEstimate(null);
      return;
    }
    setEstimateLoading(true);
    try {
      const result = await estimateJob({
        student_model: studentModel,
        num_prompts: sampleCount,
        n_samples: nSamples,
      });
      if (result) {
        setEstimate(result);
        if (!result.is_sandbox && !result.sufficient) {
          toast.error(
            `Insufficient credits. This job costs $${result.estimated_cost.toFixed(2)}, your balance is $${result.balance.toFixed(2)}.`,
            {
              action: {
                label: 'Add Credits',
                onClick: () => navigate('/billing'),
              },
            }
          );
        }
      }
    } catch {
      // keep previous estimate
    } finally {
      setEstimateLoading(false);
    }
  }, [studentModel, sampleCount, nSamples, estimateJob]);

  useEffect(() => {
    const timer = setTimeout(fetchEstimate, 500);
    return () => clearTimeout(timer);
  }, [fetchEstimate]);

  const canSubmit =
    jobName.trim() &&
    selectedDatasetId &&
    outputName.trim() &&
    !submitting &&
    (estimate === null || estimate.sufficient);

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const job = await createJob({
        name: jobName,
        config: {
          teacher_model: teacherModel,
          student_model: studentModel,
          dataset_id: selectedDatasetId,
          n_samples: nSamples,
          temperature,
          curation_agents: agents,
          quantization,
          output_name: outputName,
        },
      });

      if (job) {
        if (isTutorialActive && tutorialStep === 4) {
          await advanceTutorial();
        }
        toast.success('Distillation job created');
        navigate(`/distill-job/${job.id}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('402')) {
        toast.error('Insufficient credits. Add more credits to start this job.', {
          action: {
            label: 'Add Credits',
            onClick: () => navigate('/billing'),
          },
        });
      } else {
        toast.error('Failed to create distillation job');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full">
        <header className="shrink-0 bg-background border-b border-border">
          <div className="px-6 pt-4">
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
                  <BreadcrumbPage>New Distillation</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <div className="flex items-center gap-3 mt-4 mb-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/distill-jobs')}>
                <ArrowLeft className="size-4" />
              </Button>
              <h1 className="text-xl font-semibold tracking-tight">New Distillation</h1>
            </div>
          </div>
        </header>

        <ScrollArea className="flex-1">
          <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Job Name</CardTitle>
                <CardDescription>
                  Give your distillation job a descriptive name to identify it later.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Input
                  id="job-name"
                  placeholder="e.g. Customer Support Distillation v2"
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                  className="max-w-md"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Model Selection</CardTitle>
                <CardDescription>
                  Select a teacher model (large, high-quality) and a student model (small, fast) for
                  knowledge distillation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Teacher Model</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        placeholder="Search teacher models..."
                        value={teacherSearch}
                        onChange={(e) => setTeacherSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <ScrollArea className="h-80 rounded-md border">
                      <div className="p-2 space-y-1">
                        {teacherModelsLoading
                          ? Array.from({ length: 4 }).map((_, i) => (
                              <Skeleton key={i} className="h-14 rounded-md" />
                            ))
                          : filteredTeacherModels.map((model) => (
                              <button
                                key={model.id}
                                type="button"
                                onClick={() => setTeacherModel(model.id)}
                                className={cn(
                                  'w-full p-3 rounded-md text-left transition-colors',
                                  teacherModel === model.id
                                    ? 'bg-accent text-accent-foreground'
                                    : 'hover:bg-muted'
                                )}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium">{model.name}</span>
                                  {model.type !== 'external' && (
                                    <Badge variant="secondary">{model.type}</Badge>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {model.provider}
                                </span>
                              </button>
                            ))}
                        {!teacherModelsLoading && filteredTeacherModels.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-6">
                            No models found
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Student Model</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        placeholder="Search student models..."
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <ScrollArea className="h-80 rounded-md border">
                      <div className="p-2 space-y-0.5">
                        {studentModelGroups.map((group) => {
                          const isExpanded = expandedFamilies.has(group.family);
                          const hasSelected = group.models.some((m) => m.id === studentModel);
                          return (
                            <Collapsible
                              key={group.family}
                              open={isExpanded}
                              onOpenChange={() => toggleFamily(group.family)}
                            >
                              <CollapsibleTrigger className="w-full">
                                <div
                                  className={cn(
                                    'flex items-center justify-between w-full px-3 py-2 rounded-md text-sm transition-colors',
                                    hasSelected
                                      ? 'text-foreground font-medium'
                                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    {isExpanded ? (
                                      <ChevronDown className="size-4" />
                                    ) : (
                                      <ChevronRight className="size-4" />
                                    )}
                                    <span>{group.family}</span>
                                  </div>
                                  <Badge variant="outline">{group.models.length}</Badge>
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="pl-6 pr-1 pb-1 space-y-1">
                                  {group.models.map((model) => (
                                    <button
                                      key={model.id}
                                      type="button"
                                      onClick={() => setStudentModel(model.id)}
                                      className={cn(
                                        'w-full p-2.5 rounded-md text-left transition-colors',
                                        studentModel === model.id
                                          ? 'bg-accent text-accent-foreground'
                                          : 'hover:bg-muted'
                                      )}
                                    >
                                      <span className="text-sm font-medium block">
                                        {model.name}
                                      </span>
                                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <span className="flex items-center gap-1">
                                              <Cpu className="size-3" />
                                              {model.params}
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent>Parameters</TooltipContent>
                                        </Tooltip>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <span className="flex items-center gap-1">
                                              <HardDrive className="size-3" />
                                              {model.memory}
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent>Memory Usage</TooltipContent>
                                        </Tooltip>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          );
                        })}
                        {studentModelGroups.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-6">
                            No models found
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Training Data</CardTitle>
                <CardDescription>
                  Provide the dataset of prompts the teacher model will respond to during
                  distillation.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs
                  value={dataSource}
                  onValueChange={(v) => setDataSource(v as 'existing' | 'upload')}
                >
                  <TabsList>
                    <TabsTrigger value="existing">
                      <Database className="size-4 mr-1.5" />
                      Existing Dataset
                    </TabsTrigger>
                    <TabsTrigger value="upload">
                      <Upload className="size-4 mr-1.5" />
                      Upload .jsonl
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="existing">
                    <div className="max-w-md space-y-2">
                      <Select value={selectedDatasetId} onValueChange={setSelectedDatasetId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a dataset..." />
                        </SelectTrigger>
                        <SelectContent>
                          {datasets.map((ds) => (
                            <SelectItem key={ds.id} value={ds.id}>
                              {ds.name} ({ds.samples_count.toLocaleString()} samples)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedDataset && (
                        <p className="text-sm text-muted-foreground">
                          {selectedDataset.samples_count.toLocaleString()} prompts will be used for
                          distillation.
                        </p>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="upload">
                    <div className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-muted transition-colors">
                      <Upload className="size-8 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm font-medium mb-1">
                        Drag and drop a .jsonl file here, or click to browse
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Each line should contain an &quot;input&quot; field with the prompt text
                      </p>
                      <input type="file" accept=".jsonl,.json" className="hidden" />
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>BOND Configuration</CardTitle>
                <CardDescription>
                  Best-of-N Distillation: the teacher generates N responses per prompt, then
                  curation agents select the best one.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Slider
                    label="N Samples per Prompt"
                    value={nSamples}
                    onChange={setNSamples}
                    min={2}
                    max={16}
                    step={1}
                  />
                  <Slider
                    label="Temperature"
                    value={temperature}
                    onChange={setTemperature}
                    min={0.1}
                    max={1.0}
                    step={0.1}
                  />
                </div>

                <Separator />

                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Curation Agents</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Enable agents to automatically filter and rank generated responses.
                    </p>
                  </div>

                  {CURATION_AGENTS.map((agentDef) => {
                    const agentState = agents.find((a) => a.id === agentDef.id)!;
                    const Icon = AGENT_ICONS[agentDef.id];

                    return (
                      <Card key={agentDef.id} className={cn(!agentState.enabled && 'opacity-60')}>
                        <CardContent className="pt-4 pb-4">
                          <div className="flex items-start gap-3">
                            <div className="size-9 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
                              <Icon className="size-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center justify-between">
                                <Label
                                  htmlFor={`agent-${agentDef.id}`}
                                  className="text-sm font-medium cursor-pointer"
                                >
                                  {agentDef.name}
                                </Label>
                                <Switch
                                  id={`agent-${agentDef.id}`}
                                  checked={agentState.enabled}
                                  onCheckedChange={() => toggleAgent(agentDef.id)}
                                />
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {agentDef.description}
                              </p>
                              <p className="text-xs text-muted-foreground">{agentDef.details}</p>
                            </div>
                          </div>

                          {agentState.enabled && agentState.threshold !== undefined && (
                            <>
                              <Separator className="my-3" />
                              <div className="flex items-center gap-3 pl-12">
                                <Label className="text-xs text-muted-foreground w-16 shrink-0">
                                  Threshold
                                </Label>
                                <input
                                  type="range"
                                  min={0}
                                  max={1}
                                  step={0.1}
                                  value={agentState.threshold}
                                  onChange={(e) =>
                                    setAgentThreshold(agentDef.id, parseFloat(e.target.value))
                                  }
                                  className="flex-1 accent-primary h-1.5"
                                />
                                <Badge variant="outline" className="font-mono text-xs">
                                  {agentState.threshold.toFixed(1)}
                                </Badge>
                              </div>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Quantization</Label>
                  <RadioGroup value={quantization} onValueChange={setQuantization}>
                    {QUANTIZATION_OPTIONS.map((q) => (
                      <Label
                        key={q.id}
                        htmlFor={`quant-${q.id}`}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-md border cursor-pointer transition-colors',
                          quantization === q.id
                            ? 'bg-accent border-accent-foreground text-accent-foreground'
                            : 'hover:bg-muted'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value={q.id} id={`quant-${q.id}`} />
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{q.name}</span>
                            {q.recommended && <Badge variant="secondary">Recommended</Badge>}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{q.size}</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map((dot) => (
                                  <div
                                    key={dot}
                                    className={cn(
                                      'size-1.5 rounded-full',
                                      dot <= q.quality ? 'bg-foreground' : 'bg-border'
                                    )}
                                  />
                                ))}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>Quality: {q.quality}/5</TooltipContent>
                          </Tooltip>
                        </div>
                      </Label>
                    ))}
                  </RadioGroup>
                </div>

                <Separator />

                <div className="max-w-md space-y-2">
                  <Label htmlFor="output-name">Output Model Name</Label>
                  <Input
                    id="output-name"
                    placeholder="e.g. customer-support-llama-1b"
                    value={outputName}
                    onChange={(e) => setOutputName(e.target.value)}
                  />
                  {outputName && (
                    <p className="text-sm text-muted-foreground">
                      Output file:{' '}
                      <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                        {outputName}.gguf
                      </code>
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Separator />

            <div className="flex items-center justify-between pb-6">
              <Badge variant="outline" className="gap-1.5 py-1.5">
                Local Compute
              </Badge>

              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={() => navigate('/distill-jobs')}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={!canSubmit}>
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    'Start Distillation'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
}
