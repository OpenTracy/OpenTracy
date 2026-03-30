import { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Zap,
  CheckCircle,
  ArrowRight,
  Loader2,
  AlertCircle,
  Info,
  Target,
  Scale,
  Gauge,
  FileCheck,
  Cpu,
  HardDrive,
  Play,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Dataset } from '../types';

interface BondEnhancementModalProps {
  open: boolean;
  dataset: Dataset | null;
  onClose: () => void;
  onEnhance: (config: BondConfig) => Promise<void>;
}

export interface BondConfig {
  datasetId: string;
  datasetName: string;
  // Curation config
  enableQualityAgent: boolean;
  enableDifficultyAgent: boolean;
  enableConsensusAgent: boolean;
  qualityThreshold: number;
  consensusThreshold: number;
  // Training config
  teacherModel: string;
  studentModel: string;
  candidatesPerInput: number;
  // Export config
  quantization: string;
  outputDatasetName: string;
}

// Curation Agents
const CURATION_AGENTS = [
  {
    id: 'quality',
    name: 'Quality Agent',
    description: 'Avalia qualidade da resposta (0.0 - 1.0) usando LLM-as-Judge',
    icon: Target,
    color: 'violet',
    details: 'Critérios: clareza, completude, precisão',
  },
  {
    id: 'difficulty',
    name: 'Difficulty Agent',
    description: 'Classifica complexidade (easy/medium/hard)',
    icon: Gauge,
    color: 'amber',
    details: 'Baseado em: tamanho, termos técnicos, estrutura',
  },
  {
    id: 'consensus',
    name: 'Consensus Agent',
    description: 'Validação cruzada (0.0 - 1.0) entre instruction/response',
    icon: Scale,
    color: 'emerald',
    details: 'Detecta alucinações e inconsistências',
  },
];

// Teacher Models
const TEACHER_MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', quality: 'highest' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI', quality: 'high' },
  { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic', quality: 'highest' },
  { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', quality: 'high' },
];

// Student Models
const STUDENT_MODELS = [
  { id: 'llama-3.2-1b', name: 'Llama 3.2 1B', params: '1B', memory: '~2GB' },
  { id: 'llama-3.2-3b', name: 'Llama 3.2 3B', params: '3B', memory: '~6GB' },
  { id: 'qwen2.5-1.5b', name: 'Qwen 2.5 1.5B', params: '1.5B', memory: '~3GB' },
];

// Quantization Options
const QUANTIZATION_OPTIONS = [
  { id: 'q2_k', name: 'Q2_K (2-bit)', size: '~550MB', quality: 2, recommended: false },
  { id: 'q4_k_m', name: 'Q4_K_M (4-bit)', size: '~770MB', quality: 4, recommended: true },
  { id: 'q6_k', name: 'Q6_K (6-bit)', size: '~1.1GB', quality: 5, recommended: false },
  { id: 'q8_0', name: 'Q8_0 (8-bit)', size: '~1.3GB', quality: 5, recommended: false },
];

// N candidates options
const N_OPTIONS = [3, 5, 8, 10];

type Step = 'curation' | 'training' | 'export' | 'processing' | 'complete';

export function BondEnhancementModal({
  open,
  dataset,
  onClose,
  onEnhance,
}: BondEnhancementModalProps) {
  const [step, setStep] = useState<Step>('curation');

  // Curation settings
  const [enableQuality, setEnableQuality] = useState(true);
  const [enableDifficulty, setEnableDifficulty] = useState(true);
  const [enableConsensus, setEnableConsensus] = useState(true);
  const [qualityThreshold, setQualityThreshold] = useState(0.7);
  const [consensusThreshold, setConsensusThreshold] = useState(0.6);

  // Training settings
  const [teacherModel, setTeacherModel] = useState('gpt-4o');
  const [studentModel, setStudentModel] = useState('llama-3.2-1b');
  const [candidatesPerInput, setCandidatesPerInput] = useState(5);

  // Export settings
  const [quantization, setQuantization] = useState('q4_k_m');
  const [outputName, setOutputName] = useState('');

  // Processing state
  const [progress, setProgress] = useState(0);
  const [currentPhase, setCurrentPhase] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset when modal opens
  useEffect(() => {
    if (open && dataset) {
      setStep('curation');
      setProgress(0);
      setCurrentPhase('');
      setError(null);
      setOutputName(`${dataset.name}-bond`);
    }
  }, [open, dataset]);

  const estimatedCost = dataset
    ? (dataset.samples_count * candidatesPerInput * 0.003).toFixed(2)
    : '0.00';

  const estimatedTime = dataset ? Math.ceil((dataset.samples_count * candidatesPerInput) / 60) : 0;

  const handleStartPipeline = async () => {
    if (!dataset) return;

    setStep('processing');
    setError(null);
    setProgress(0);

    try {
      // Simulate curation phase
      setCurrentPhase('Executando Quality Agent...');
      await simulateProgress(0, 20);

      setCurrentPhase('Executando Difficulty Agent...');
      await simulateProgress(20, 40);

      setCurrentPhase('Executando Consensus Agent...');
      await simulateProgress(40, 55);

      // Simulate training phase
      setCurrentPhase('Gerando respostas do Teacher...');
      await simulateProgress(55, 70);

      setCurrentPhase('Selecionando melhores respostas...');
      await simulateProgress(70, 80);

      setCurrentPhase('Treinando Student com LoRA...');
      await simulateProgress(80, 90);

      // Simulate export phase
      setCurrentPhase(`Exportando GGUF (${quantization})...`);
      await simulateProgress(90, 100);

      await onEnhance({
        datasetId: dataset.id,
        datasetName: dataset.name,
        enableQualityAgent: enableQuality,
        enableDifficultyAgent: enableDifficulty,
        enableConsensusAgent: enableConsensus,
        qualityThreshold,
        consensusThreshold,
        teacherModel,
        studentModel,
        candidatesPerInput,
        quantization,
        outputDatasetName: outputName,
      });

      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pipeline failed');
      setStep('curation');
    }
  };

  const simulateProgress = (from: number, to: number): Promise<void> => {
    return new Promise((resolve) => {
      const duration = 1000;
      const steps = 20;
      const increment = (to - from) / steps;
      let current = from;

      const interval = setInterval(() => {
        current += increment;
        setProgress(Math.min(current, to));

        if (current >= to) {
          clearInterval(interval);
          resolve();
        }
      }, duration / steps);
    });
  };

  const resetAndClose = () => {
    setStep('curation');
    setProgress(0);
    setCurrentPhase('');
    setError(null);
    onClose();
  };

  const getStepNumber = () => {
    switch (step) {
      case 'curation':
        return 1;
      case 'training':
        return 2;
      case 'export':
        return 3;
      default:
        return 0;
    }
  };

  if (!dataset) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && resetAndClose()}>
      <DialogContent className={cn('p-0', 'max-w-3xl')} showCloseButton={false}>
        <div className="flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">BOND Online Pipeline</h2>
                <p className="text-sm text-foreground-secondary">
                  Best-of-N Distillation para {dataset.name}
                </p>
              </div>
            </div>
            <button
              onClick={resetAndClose}
              className="p-2 text-foreground-muted hover:text-foreground-secondary hover:bg-surface-hover rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Step Indicator */}
          {step !== 'processing' && step !== 'complete' && (
            <div className="px-5 py-4 border-b border-border bg-background-secondary/50">
              <div className="flex items-center justify-between max-w-lg mx-auto">
                {['Curadoria', 'Training', 'Export'].map((label, idx) => {
                  const stepNum = idx + 1;
                  const isActive = getStepNumber() === stepNum;
                  const isCompleted = getStepNumber() > stepNum;

                  return (
                    <div key={label} className="flex items-center">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                            isCompleted
                              ? 'bg-foreground text-background'
                              : isActive
                                ? 'bg-foreground text-background'
                                : 'bg-border text-foreground-secondary'
                          }`}
                        >
                          {isCompleted ? <CheckCircle className="w-4 h-4" /> : stepNum}
                        </div>
                        <span
                          className={`text-xs mt-1 ${
                            isActive ? 'text-accent font-medium' : 'text-foreground-secondary'
                          }`}
                        >
                          {label}
                        </span>
                      </div>
                      {idx < 2 && (
                        <div
                          className={`w-16 h-0.5 mx-2 ${
                            isCompleted ? 'bg-foreground' : 'bg-border'
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5">
            {step === 'processing' ? (
              /* Processing State */
              <div className="py-12 text-center">
                <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-6">
                  <Loader2 className="w-10 h-10 text-accent animate-spin" />
                </div>

                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Executando Pipeline...
                </h3>
                <p className="text-foreground-secondary mb-6">{currentPhase}</p>

                {/* Progress Bar */}
                <div className="max-w-md mx-auto mb-4">
                  <div className="flex justify-between text-sm text-foreground-secondary mb-2">
                    <span>Progresso</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-foreground-secondary rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Pipeline Phases */}
                <div className="max-w-sm mx-auto mt-8 space-y-2">
                  {[
                    { name: 'Curadoria', range: [0, 55] },
                    { name: 'BOND Training', range: [55, 90] },
                    { name: 'Export GGUF', range: [90, 100] },
                  ].map((phase) => {
                    const isActive = progress >= phase.range[0] && progress < phase.range[1];
                    const isComplete = progress >= phase.range[1];

                    return (
                      <div key={phase.name} className="flex items-center gap-3 text-sm">
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center ${
                            isComplete
                              ? 'bg-success/10 text-success-light'
                              : isActive
                                ? 'bg-accent/10 text-accent'
                                : 'bg-background-secondary text-foreground-muted'
                          }`}
                        >
                          {isComplete ? (
                            <CheckCircle className="w-3 h-3" />
                          ) : isActive ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-current" />
                          )}
                        </div>
                        <span
                          className={
                            isActive ? 'text-foreground font-medium' : 'text-foreground-secondary'
                          }
                        >
                          {phase.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : step === 'complete' ? (
              /* Complete State */
              <div className="py-12 text-center">
                <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-10 h-10 text-success-light" />
                </div>

                <h3 className="text-xl font-semibold text-foreground mb-2">Pipeline Completo!</h3>
                <p className="text-foreground-secondary mb-6 max-w-md mx-auto">
                  Seu modelo foi treinado e exportado com sucesso. O modelo GGUF está pronto para
                  deploy.
                </p>

                <div className="max-w-sm mx-auto p-4 bg-background-secondary rounded-xl text-left space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground-secondary">Dataset</span>
                    <span className="font-medium text-foreground">{dataset.name}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground-secondary">Modelo Base</span>
                    <span className="font-medium text-foreground">
                      {STUDENT_MODELS.find((m) => m.id === studentModel)?.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground-secondary">Quantização</span>
                    <span className="font-medium text-foreground">
                      {QUANTIZATION_OPTIONS.find((q) => q.id === quantization)?.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground-secondary">Output</span>
                    <span className="font-medium text-foreground">{outputName}.gguf</span>
                  </div>
                </div>

                <button
                  onClick={resetAndClose}
                  className="mt-6 px-6 py-2.5 bg-foreground text-background font-medium rounded-lg hover:bg-foreground/90 transition-colors"
                >
                  Fechar
                </button>
              </div>
            ) : step === 'curation' ? (
              /* Curation Step */
              <div className="space-y-6">
                {/* Info Banner */}
                <div className="flex items-start gap-3 p-4 bg-accent/10 rounded-lg border border-accent/20">
                  <Info className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-accent-light">
                    <p className="font-medium mb-1">Etapa de Curadoria</p>
                    <p className="text-accent">
                      Os agentes de curadoria avaliam cada par instruction/response do dataset para
                      garantir qualidade antes do treinamento.
                    </p>
                  </div>
                </div>

                {/* Dataset Info */}
                <div className="p-4 bg-background-secondary rounded-xl">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <FileCheck className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground">{dataset.name}</h4>
                      <p className="text-sm text-foreground-secondary">
                        {dataset.samples_count.toLocaleString()} samples
                      </p>
                    </div>
                  </div>
                </div>

                {/* Curation Agents */}
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-3">Agentes de Curadoria</h4>
                  <div className="space-y-3">
                    {CURATION_AGENTS.map((agent) => {
                      const Icon = agent.icon;
                      const isEnabled =
                        agent.id === 'quality'
                          ? enableQuality
                          : agent.id === 'difficulty'
                            ? enableDifficulty
                            : enableConsensus;
                      const setEnabled =
                        agent.id === 'quality'
                          ? setEnableQuality
                          : agent.id === 'difficulty'
                            ? setEnableDifficulty
                            : setEnableConsensus;

                      return (
                        <div
                          key={agent.id}
                          className={`p-4 rounded-xl border transition-all cursor-pointer ${
                            isEnabled ? 'border-accent/20 bg-accent/10' : 'border-border bg-surface'
                          }`}
                          onClick={() => setEnabled(!isEnabled)}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                agent.color === 'violet'
                                  ? 'bg-accent/10'
                                  : agent.color === 'amber'
                                    ? 'bg-warning/10'
                                    : 'bg-success/10'
                              }`}
                            >
                              <Icon
                                className={`w-5 h-5 ${
                                  agent.color === 'violet'
                                    ? 'text-accent'
                                    : agent.color === 'amber'
                                      ? 'text-warning'
                                      : 'text-success-light'
                                }`}
                              />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <h5 className="font-medium text-foreground">{agent.name}</h5>
                                <div
                                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                    isEnabled ? 'border-foreground bg-foreground' : 'border-border'
                                  }`}
                                >
                                  {isEnabled && <CheckCircle className="w-3 h-3 text-white" />}
                                </div>
                              </div>
                              <p className="text-sm text-foreground-secondary mt-0.5">
                                {agent.description}
                              </p>
                              <p className="text-xs text-foreground-muted mt-1">{agent.details}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Thresholds */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Quality Threshold
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={qualityThreshold}
                        onChange={(e) => setQualityThreshold(parseFloat(e.target.value))}
                        className="flex-1"
                      />
                      <span className="text-sm font-medium text-foreground w-12">
                        {qualityThreshold.toFixed(1)}
                      </span>
                    </div>
                    <p className="text-xs text-foreground-secondary mt-1">
                      Mínimo score de qualidade aceito
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Consensus Threshold
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={consensusThreshold}
                        onChange={(e) => setConsensusThreshold(parseFloat(e.target.value))}
                        className="flex-1"
                      />
                      <span className="text-sm font-medium text-foreground w-12">
                        {consensusThreshold.toFixed(1)}
                      </span>
                    </div>
                    <p className="text-xs text-foreground-secondary mt-1">
                      Mínimo score de consenso aceito
                    </p>
                  </div>
                </div>
              </div>
            ) : step === 'training' ? (
              /* Training Step */
              <div className="space-y-6">
                {/* BOND Explanation */}
                <div className="flex items-start gap-3 p-4 bg-warning/10 rounded-lg border border-warning/20">
                  <Zap className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-warning">
                    <p className="font-medium mb-1">BOND Training</p>
                    <p className="text-warning">
                      O Teacher gera N respostas para cada input. O Reward Model seleciona a melhor.
                      O Student aprende a reproduzir apenas as melhores respostas.
                    </p>
                  </div>
                </div>

                {/* Teacher Model */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Teacher Model
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {TEACHER_MODELS.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => setTeacherModel(model.id)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          teacherModel === model.id
                            ? 'border-accent/20 bg-accent/10'
                            : 'border-border hover:border-border-hover'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-foreground">{model.name}</span>
                          {model.quality === 'highest' && (
                            <span className="px-1.5 py-0.5 bg-accent/10 text-accent-light text-[10px] font-medium rounded">
                              TOP
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-foreground-secondary">{model.provider}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Student Model */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Student Model (LoRA Fine-tuning)
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {STUDENT_MODELS.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => setStudentModel(model.id)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          studentModel === model.id
                            ? 'border-accent/20 bg-accent/10'
                            : 'border-border hover:border-border-hover'
                        }`}
                      >
                        <span className="font-medium text-foreground text-sm block mb-1">
                          {model.name}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-foreground-secondary">
                          <Cpu className="w-3 h-3" />
                          {model.params}
                          <HardDrive className="w-3 h-3 ml-1" />
                          {model.memory}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* N Candidates */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Candidatos por Input (N)
                  </label>
                  <div className="flex items-center gap-2">
                    {N_OPTIONS.map((n) => (
                      <button
                        key={n}
                        onClick={() => setCandidatesPerInput(n)}
                        className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${
                          candidatesPerInput === n
                            ? 'border-accent/20 bg-accent/10 text-accent-light'
                            : 'border-border text-foreground-secondary hover:border-border-hover'
                        }`}
                      >
                        N={n}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-foreground-secondary mt-2">
                    Mais candidatos = melhor qualidade, mas maior custo
                  </p>
                </div>

                {/* Cost Estimate */}
                <div className="p-4 bg-background-secondary rounded-xl">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground-secondary">Custo estimado</span>
                    <span className="font-semibold text-foreground">~${estimatedCost}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span className="text-foreground-secondary">Tempo estimado</span>
                    <span className="font-semibold text-foreground">~{estimatedTime} min</span>
                  </div>
                </div>
              </div>
            ) : step === 'export' ? (
              /* Export Step */
              <div className="space-y-6">
                {/* Info */}
                <div className="flex items-start gap-3 p-4 bg-success/10 rounded-lg border border-success/20">
                  <HardDrive className="w-5 h-5 text-success-light flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-success-light">
                    <p className="font-medium mb-1">Export GGUF</p>
                    <p className="text-success-light">
                      O modelo será quantizado e exportado em formato GGUF para deploy com vLLM ou
                      llama.cpp.
                    </p>
                  </div>
                </div>

                {/* Quantization */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-3">
                    Quantização
                  </label>
                  <div className="space-y-2">
                    {QUANTIZATION_OPTIONS.map((quant) => (
                      <button
                        key={quant.id}
                        onClick={() => setQuantization(quant.id)}
                        className={`w-full p-4 rounded-xl border text-left transition-all flex items-center justify-between ${
                          quantization === quant.id
                            ? 'border-accent/20 bg-accent/10'
                            : 'border-border hover:border-border-hover'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                              quantization === quant.id
                                ? 'border-foreground bg-foreground'
                                : 'border-border'
                            }`}
                          >
                            {quantization === quant.id && (
                              <div className="w-2 h-2 rounded-full bg-foreground" />
                            )}
                          </div>
                          <div>
                            <span className="font-medium text-foreground">{quant.name}</span>
                            {quant.recommended && (
                              <span className="ml-2 px-1.5 py-0.5 bg-success/10 text-success-light text-[10px] font-medium rounded">
                                RECOMENDADO
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-foreground-secondary">{quant.size}</span>
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <div
                                key={star}
                                className={`w-2 h-2 rounded-full ${
                                  star <= quant.quality ? 'bg-foreground-secondary' : 'bg-border'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Output Name */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Nome do Output
                  </label>
                  <input
                    type="text"
                    value={outputName}
                    onChange={(e) => setOutputName(e.target.value)}
                    placeholder="meu-modelo-bond"
                    className="w-full px-4 py-2.5 border border-border rounded-lg text-sm bg-surface text-foreground placeholder-foreground-muted hover:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-transparent"
                  />
                  <p className="text-xs text-foreground-secondary mt-1.5">
                    Arquivo final: {outputName || 'modelo'}.gguf
                  </p>
                </div>
              </div>
            ) : null}

            {/* Error */}
            {error && (
              <div className="mt-4 flex items-start gap-2 p-3 bg-error/10 rounded-lg border border-error/20">
                <AlertCircle className="w-4 h-4 text-error-light flex-shrink-0 mt-0.5" />
                <p className="text-sm text-error-light">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          {step !== 'processing' && step !== 'complete' && (
            <div className="flex items-center justify-between p-5 border-t border-border bg-background-secondary/50">
              <button
                onClick={
                  step === 'curation'
                    ? resetAndClose
                    : () => setStep(step === 'training' ? 'curation' : 'training')
                }
                className="px-4 py-2 text-sm font-medium text-foreground-secondary hover:text-foreground"
              >
                {step === 'curation' ? 'Cancelar' : 'Voltar'}
              </button>

              <button
                onClick={() => {
                  if (step === 'curation') setStep('training');
                  else if (step === 'training') setStep('export');
                  else handleStartPipeline();
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-foreground text-background font-medium rounded-lg hover:bg-foreground/90 transition-colors"
              >
                {step === 'export' ? (
                  <>
                    <Play className="w-4 h-4" />
                    Iniciar Pipeline
                  </>
                ) : (
                  <>
                    Próximo
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
