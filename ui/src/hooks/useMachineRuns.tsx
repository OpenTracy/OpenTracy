import { useState, useEffect, useCallback } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import type {
  MachineRun,
  MachineRunsParams,
  DeploymentMetricsParams,
} from '../services/machineRunsService';
import { useMachineRunsService } from '../services/machineRunsService';

// Tipos para as métricas calculadas
interface MachineRunsMetrics {
  totalRuns: number;
  successRate: number;
  latencyP50: number;
  latencyP95: number;
  ttftP50: number;
  avgThroughput: number;
  topErrorCode: {
    code: string;
    percentage: number;
  } | null;
  avgGpuUtil: number;
  gpuUtilP95: number;
  avgGpuMemory: number;
  totalCost: number;
}

// Tipos para os dados de gráficos
interface TimeSeriesPoint {
  timestamp: string;
  value: number;
}

interface HistogramBucket {
  bucket: string;
  count: number;
}

interface ModelMetric {
  model: string;
  value: number;
}

interface ScatterPoint {
  tokens_out: number;
  latency_ms: number;
  model: string;
}

// Tipo para os filtros
type MachineRunsFilters = MachineRunsParams;

// Tipo para o estado do hook
interface MachineRunsState {
  loading: boolean;
  error: string | null;
  runs: MachineRun[];
  metrics: MachineRunsMetrics;
  runsPerTime: TimeSeriesPoint[];
  latencyOverTime: {
    p50: TimeSeriesPoint[];
    p95: TimeSeriesPoint[];
  };
  ttftOverTime: TimeSeriesPoint[];
  latencyDistribution: HistogramBucket[];
  topModelsByVolume: ModelMetric[];
  topModelsByErrorRate: ModelMetric[];
  tokensVsLatency: ScatterPoint[];
  availableMachines: string[];
  availableProviders: string[];
  availableModels: string[];
}

// Função auxiliar para calcular percentis
function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// Função para agrupar dados por intervalo de tempo
function groupByTimeInterval(runs: MachineRun[], intervalMinutes: number): TimeSeriesPoint[] {
  if (runs.length === 0) return [];

  const timeMap = new Map<string, number>();

  runs.forEach((run) => {
    const date = new Date(run.timestamp);
    // Arredondar para o intervalo mais próximo
    date.setMinutes(Math.floor(date.getMinutes() / intervalMinutes) * intervalMinutes);
    date.setSeconds(0);
    date.setMilliseconds(0);

    const timeKey = date.toISOString();
    timeMap.set(timeKey, (timeMap.get(timeKey) || 0) + 1);
  });

  return Array.from(timeMap.entries())
    .map(([timestamp, value]) => ({ timestamp, value }))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

// Função para criar buckets de histograma
function createHistogramBuckets(values: number[], bucketCount: number = 10): HistogramBucket[] {
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const bucketSize = range / bucketCount;

  const buckets = new Map<string, number>();

  for (let i = 0; i < bucketCount; i++) {
    const lowerBound = min + i * bucketSize;
    const upperBound = lowerBound + bucketSize;
    buckets.set(`${Math.round(lowerBound)}-${Math.round(upperBound)}`, 0);
  }

  values.forEach((value) => {
    const bucketIndex = Math.min(bucketCount - 1, Math.floor((value - min) / bucketSize));
    const lowerBound = min + bucketIndex * bucketSize;
    const upperBound = lowerBound + bucketSize;
    const key = `${Math.round(lowerBound)}-${Math.round(upperBound)}`;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  });

  return Array.from(buckets.entries()).map(([bucket, count]) => ({ bucket, count }));
}

// Função para gerar dados de mock
function generateMockData(count: number = 50): MachineRun[] {
  const providers = ['openai', 'anthropic', 'bedrock', 'mistral', 'google'];
  const models = [
    'gpt-4o',
    'claude-3-sonnet',
    'claude-3-opus',
    'meta.llama3-70b-instruct',
    'mistral-large',
    'gemini-pro',
  ];
  const machineIds = ['router-a-01', 'router-b-02', 'router-c-03', 'router-d-04'];
  const errorCodes = [
    null,
    'rate_limit_exceeded',
    'context_length_exceeded',
    'invalid_request',
    null,
    null,
    null,
    null,
    null,
    null,
  ];

  const now = new Date();
  const runs: MachineRun[] = [];

  for (let i = 0; i < count; i++) {
    const timestamp = new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000);
    const provider = providers[Math.floor(Math.random() * providers.length)];
    const model = models[Math.floor(Math.random() * models.length)];
    const machine_id = machineIds[Math.floor(Math.random() * machineIds.length)];
    const stream = Math.random() > 0.5;
    const tokens_in = Math.floor(Math.random() * 1000) + 100;
    const tokens_out = Math.floor(Math.random() * 1000) + 50;
    const latency_ms = Math.floor(Math.random() * 5000) + 200;
    const ttft_ms = Math.floor(Math.random() * 500) + 50;
    const tps = tokens_out / (latency_ms / 1000);
    const error_code = errorCodes[Math.floor(Math.random() * errorCodes.length)];
    const success = error_code === null;
    const gpu_util = Math.random() * 0.9 + 0.1;
    const gpu_mem_gb = Math.random() * 40 + 10;
    const cpu_pct = Math.random() * 80 + 20;
    const ram_gb = Math.random() * 30 + 10;
    const cost_usd = tokens_in * 0.000001 + tokens_out * 0.000002;

    runs.push({
      timestamp: timestamp.toISOString(),
      machine_id,
      provider,
      model,
      stream,
      latency_ms,
      ttft_ms,
      tokens_in,
      tokens_out,
      tps,
      success,
      error_code,
      gpu_util,
      gpu_mem_gb,
      cpu_pct,
      ram_gb,
      cost_usd,
    });
  }

  // Ordenar por timestamp (mais recente primeiro)
  runs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return runs;
}

export interface UseMachineRunsOptions {
  initialFilters?: Partial<MachineRunsFilters>;
  useMock?: boolean;
  useRealApi?: boolean;
  deploymentId?: string;
}

export function useMachineRuns(options: UseMachineRunsOptions = {}) {
  const {
    initialFilters,
    useMock = false,
    useRealApi = true,
    deploymentId = 'aceb047d-d48c-50fb-a311-9ee64584d7e9', // ID de deployment padrão
  } = options;

  const { getMachineRuns, getDeploymentMetrics, convertDeploymentMetricsToMachineRuns } =
    useMachineRunsService();
  const [state, setState] = useState<MachineRunsState>({
    loading: true,
    error: null,
    runs: [],
    metrics: {
      totalRuns: 0,
      successRate: 0,
      latencyP50: 0,
      latencyP95: 0,
      ttftP50: 0,
      avgThroughput: 0,
      topErrorCode: null,
      avgGpuUtil: 0,
      gpuUtilP95: 0,
      avgGpuMemory: 0,
      totalCost: 0,
    },
    runsPerTime: [],
    latencyOverTime: {
      p50: [],
      p95: [],
    },
    ttftOverTime: [],
    latencyDistribution: [],
    topModelsByVolume: [],
    topModelsByErrorRate: [],
    tokensVsLatency: [],
    availableMachines: [],
    availableProviders: [],
    availableModels: [],
  });

  // Estado para os filtros
  const [filters, setFilters] = useState<MachineRunsFilters>({
    from: initialFilters?.from || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24 horas atrás
    to: initialFilters?.to || new Date().toISOString(),
    machine_id: initialFilters?.machine_id,
    provider: initialFilters?.provider,
    model: initialFilters?.model,
    stream: initialFilters?.stream,
  });

  // Função para atualizar os filtros
  const updateFilters = useCallback((newFilters: Partial<MachineRunsFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  // Função para processar os dados e calcular métricas
  const processData = useCallback((runs: MachineRun[]): Partial<MachineRunsState> => {
    if (runs.length === 0) {
      return {
        metrics: {
          totalRuns: 0,
          successRate: 0,
          latencyP50: 0,
          latencyP95: 0,
          ttftP50: 0,
          avgThroughput: 0,
          topErrorCode: null,
          avgGpuUtil: 0,
          gpuUtilP95: 0,
          avgGpuMemory: 0,
          totalCost: 0,
        },
        runsPerTime: [],
        latencyOverTime: { p50: [], p95: [] },
        ttftOverTime: [],
        latencyDistribution: [],
        topModelsByVolume: [],
        topModelsByErrorRate: [],
        tokensVsLatency: [],
      };
    }

    // Calcular métricas básicas
    const totalRuns = runs.length;
    const successfulRuns = runs.filter((run) => run.success);
    const successRate = (successfulRuns.length / totalRuns) * 100;

    // Latência e TTFT
    const latencies = runs.map((run) => run.latency_ms);
    const ttfts = runs.map((run) => run.ttft_ms);

    const latencyP50 = calculatePercentile(latencies, 50);
    const latencyP95 = calculatePercentile(latencies, 95);
    const ttftP50 = calculatePercentile(ttfts, 50);

    // Throughput
    const totalTokensOut = runs.reduce((sum, run) => sum + run.tokens_out, 0);
    const totalDurationSeconds = runs.reduce((sum, run) => sum + run.latency_ms / 1000, 0);
    const avgThroughput = totalDurationSeconds > 0 ? totalTokensOut / totalDurationSeconds : 0;

    // Códigos de erro
    const errorCounts = new Map<string, number>();
    runs
      .filter((run) => !run.success && run.error_code)
      .forEach((run) => {
        const code = run.error_code || 'unknown';
        errorCounts.set(code, (errorCounts.get(code) || 0) + 1);
      });

    let topErrorCode = null;
    if (errorCounts.size > 0) {
      const sortedErrors = Array.from(errorCounts.entries()).sort((a, b) => b[1] - a[1]);

      if (sortedErrors.length > 0) {
        const [code, count] = sortedErrors[0];
        topErrorCode = {
          code,
          percentage: (count / totalRuns) * 100,
        };
      }
    }

    // Métricas de GPU
    const gpuUtils = runs.filter((run) => run.gpu_util !== undefined).map((run) => run.gpu_util);
    const gpuMems = runs.filter((run) => run.gpu_mem_gb !== undefined).map((run) => run.gpu_mem_gb);

    const avgGpuUtil =
      gpuUtils.length > 0 ? gpuUtils.reduce((sum, val) => sum + val, 0) / gpuUtils.length : 0;

    const gpuUtilP95 = calculatePercentile(gpuUtils, 95);

    const avgGpuMemory =
      gpuMems.length > 0 ? gpuMems.reduce((sum, val) => sum + val, 0) / gpuMems.length : 0;

    // Custo total
    const totalCost = runs.reduce((sum, run) => sum + (run.cost_usd || 0), 0);

    // Séries temporais
    const runsPerTime = groupByTimeInterval(runs, 15); // 15 minutos de intervalo

    // Latência ao longo do tempo (p50 e p95)
    const timeGroups = new Map<string, number[]>();
    runs.forEach((run) => {
      const date = new Date(run.timestamp);
      date.setMinutes(Math.floor(date.getMinutes() / 15) * 15);
      date.setSeconds(0);
      date.setMilliseconds(0);

      const timeKey = date.toISOString();
      if (!timeGroups.has(timeKey)) {
        timeGroups.set(timeKey, []);
      }
      timeGroups.get(timeKey)?.push(run.latency_ms);
    });

    const latencyP50OverTime: TimeSeriesPoint[] = [];
    const latencyP95OverTime: TimeSeriesPoint[] = [];

    timeGroups.forEach((latencies, timestamp) => {
      latencyP50OverTime.push({
        timestamp,
        value: calculatePercentile(latencies, 50),
      });

      latencyP95OverTime.push({
        timestamp,
        value: calculatePercentile(latencies, 95),
      });
    });

    // Ordenar por timestamp
    latencyP50OverTime.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    latencyP95OverTime.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // TTFT ao longo do tempo
    const ttftGroups = new Map<string, number[]>();
    runs.forEach((run) => {
      const date = new Date(run.timestamp);
      date.setMinutes(Math.floor(date.getMinutes() / 15) * 15);
      date.setSeconds(0);
      date.setMilliseconds(0);

      const timeKey = date.toISOString();
      if (!ttftGroups.has(timeKey)) {
        ttftGroups.set(timeKey, []);
      }
      ttftGroups.get(timeKey)?.push(run.ttft_ms);
    });

    const ttftOverTime: TimeSeriesPoint[] = [];
    ttftGroups.forEach((ttfts, timestamp) => {
      ttftOverTime.push({
        timestamp,
        value: calculatePercentile(ttfts, 50), // p50 para TTFT
      });
    });

    ttftOverTime.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Histograma de latência
    const latencyDistribution = createHistogramBuckets(latencies);

    // Top 5 modelos por volume
    const modelCounts = new Map<string, number>();
    runs.forEach((run) => {
      modelCounts.set(run.model, (modelCounts.get(run.model) || 0) + 1);
    });

    const topModelsByVolume = Array.from(modelCounts.entries())
      .map(([model, value]) => ({ model, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Top 5 modelos por taxa de erro
    const modelErrorRates = new Map<string, { total: number; errors: number }>();
    runs.forEach((run) => {
      if (!modelErrorRates.has(run.model)) {
        modelErrorRates.set(run.model, { total: 0, errors: 0 });
      }

      const stats = modelErrorRates.get(run.model)!;
      stats.total += 1;
      if (!run.success) {
        stats.errors += 1;
      }
    });

    const topModelsByErrorRate = Array.from(modelErrorRates.entries())
      .map(([model, { total, errors }]) => ({
        model,
        value: total > 0 ? (errors / total) * 100 : 0,
      }))
      .filter((item) => item.value > 0) // Apenas modelos com erros
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Scatter plot: tokens_out vs latência
    const tokensVsLatency = runs.map((run) => ({
      tokens_out: run.tokens_out,
      latency_ms: run.latency_ms,
      model: run.model,
    }));

    // Listas de valores disponíveis para filtros
    const availableMachines = [...new Set(runs.map((run) => run.machine_id))];
    const availableProviders = [...new Set(runs.map((run) => run.provider))];
    const availableModels = [...new Set(runs.map((run) => run.model))];

    return {
      metrics: {
        totalRuns,
        successRate,
        latencyP50,
        latencyP95,
        ttftP50,
        avgThroughput,
        topErrorCode,
        avgGpuUtil,
        gpuUtilP95,
        avgGpuMemory,
        totalCost,
      },
      runsPerTime,
      latencyOverTime: {
        p50: latencyP50OverTime,
        p95: latencyP95OverTime,
      },
      ttftOverTime,
      latencyDistribution,
      topModelsByVolume,
      topModelsByErrorRate,
      tokensVsLatency,
      availableMachines,
      availableProviders,
      availableModels,
    };
  }, []);

  // Efeito para carregar os dados
  useEffect(() => {
    const fetchData = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      // Se estiver usando mock, gerar dados de mock
      if (useMock) {
        setTimeout(() => {
          const mockRuns = generateMockData(100);

          // Aplicar filtros aos dados de mock
          let filteredRuns = [...mockRuns];

          if (filters.machine_id) {
            filteredRuns = filteredRuns.filter((run) => run.machine_id === filters.machine_id);
          }

          if (filters.provider) {
            filteredRuns = filteredRuns.filter((run) => run.provider === filters.provider);
          }

          if (filters.model) {
            filteredRuns = filteredRuns.filter((run) => run.model === filters.model);
          }

          if (filters.stream !== undefined) {
            filteredRuns = filteredRuns.filter((run) => run.stream === filters.stream);
          }

          // Filtrar por intervalo de data
          if (filters.from && filters.to) {
            const fromDate = new Date(filters.from).getTime();
            const toDate = new Date(filters.to).getTime();

            filteredRuns = filteredRuns.filter((run) => {
              const runDate = new Date(run.timestamp).getTime();
              return runDate >= fromDate && runDate <= toDate;
            });
          }

          const processedData = processData(filteredRuns);

          setState((prev) => ({
            ...prev,
            loading: false,
            runs: filteredRuns,
            ...processedData,
          }));
        }, 1000); // Simular delay de rede

        return;
      }

      try {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString() || '';

        // Se estiver usando a API real de métricas de deployments
        if (useRealApi && deploymentId) {
          // Parâmetros para a API de métricas de deployments
          const metricsParams: DeploymentMetricsParams = {
            deployment_id: deploymentId,
            type: 'invocation',
            minutes: 60, // Últimos 60 minutos
            period: 300, // Período de 5 minutos
          };

          // Obter métricas de deployment
          const metricsResult = await getDeploymentMetrics(token, metricsParams);

          // Converter para o formato de machine runs
          const machineRunsResult = convertDeploymentMetricsToMachineRuns(metricsResult);

          // Processar os dados
          const processedData = processData(machineRunsResult.runs);

          setState((prev) => ({
            ...prev,
            loading: false,
            runs: machineRunsResult.runs,
            ...processedData,
          }));
        }
        // Se não estiver usando a API real, usar a API original de machine runs
        else {
          const result = await getMachineRuns(token, filters);
          const processedData = processData(result.runs);

          setState((prev) => ({
            ...prev,
            loading: false,
            runs: result.runs,
            ...processedData,
          }));
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch data',
        }));
      }
    };

    fetchData();
  }, [
    filters,
    getMachineRuns,
    getDeploymentMetrics,
    convertDeploymentMetricsToMachineRuns,
    processData,
    useMock,
    useRealApi,
    deploymentId,
  ]);

  // Função para formatar datas para exibição
  const formatDate = useCallback((isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleString();
  }, []);

  // Função para formatar números com separador de milhares
  const formatNumber = useCallback((num: number): string => {
    return num.toLocaleString();
  }, []);

  // Função para formatar percentuais
  const formatPercent = useCallback((num: number): string => {
    return `${num.toFixed(1)}%`;
  }, []);

  // Função para formatar valores monetários
  const formatCurrency = useCallback((num: number): string => {
    return `$${num.toFixed(4)}`;
  }, []);

  return {
    ...state,
    filters,
    updateFilters,
    formatDate,
    formatNumber,
    formatPercent,
    formatCurrency,
  };
}
