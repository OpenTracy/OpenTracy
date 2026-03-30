import { useState, useEffect } from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import type {
  DeploymentMetricsData,
  TimeSeriesPoint,
  EKSTimeSeriesPoint,
} from '../../types/deploymentTypes';
import { useDeploymentService } from '../../services/DeploymentService';
import { useUser } from '../../contexts/UserContext';
// import { formatLatencyMs } from "../../utils/formatUtils";
import {
  Cpu,
  HardDrive,
  Activity,
  // Clock,
  // DollarSign,
  // CheckCircle,
  // XCircle,
  RefreshCw,
  // TrendingUp,
} from 'lucide-react';

interface DeploymentMetricsChartsProps {
  deploymentId: string;
  isVisible: boolean;
}

export function DeploymentMetricsCharts({ deploymentId, isVisible }: DeploymentMetricsChartsProps) {
  const [metrics, setMetrics] = useState<DeploymentMetricsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeChart, setActiveChart] = useState<
    'cpu' | 'memory' | 'gpu' | 'gpu_memory' | 'latency' | 'invocations'
  >('cpu');

  const { getDeploymentMetrics } = useDeploymentService();
  const { accessToken } = useUser();

  const fetchMetrics = async () => {
    if (!accessToken || !deploymentId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await getDeploymentMetrics(accessToken, deploymentId);
      setMetrics(data);
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isVisible && deploymentId) {
      fetchMetrics();
    }
  }, [isVisible, deploymentId, accessToken]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatChartData = (data: (TimeSeriesPoint | EKSTimeSeriesPoint)[]) => {
    return data.map((point) => {
      // Handle both SageMaker (timestamp) and EKS (time) formats
      const timestamp = 'timestamp' in point ? point.timestamp : point.time;
      return {
        time: formatTimestamp(timestamp),
        value: point.value,
        fullTime: timestamp,
      };
    });
  };

  const getChartConfig = () => {
    // Helper to get time series data with EKS fallback
    const ts = metrics?.time_series;

    switch (activeChart) {
      case 'cpu':
        return {
          data: ts?.cpu_utilization || [],
          color: '#ededed',
          label: 'CPU Utilization',
          unit: '%',
          gradient: 'url(#cpuGradient)',
        };
      case 'memory':
        return {
          data: ts?.memory_utilization || [],
          color: '#b0b0b0',
          label: 'Memory Utilization',
          unit: '%',
          gradient: 'url(#memoryGradient)',
        };
      case 'gpu':
        // EKS/vLLM: use gpu_cache_usage as proxy for GPU utilization
        return {
          data: ts?.gpu_utilization || ts?.gpu_cache_usage || [],
          color: '#808080',
          label: 'GPU Cache',
          unit: '%',
          gradient: 'url(#gpuGradient)',
        };
      case 'gpu_memory':
        // EKS/vLLM: gpu_cache_usage represents KV cache memory usage
        return {
          data: ts?.gpu_memory_utilization || ts?.gpu_cache_usage || [],
          color: '#a0a0a0',
          label: 'GPU Memory',
          unit: '%',
          gradient: 'url(#gpuMemGradient)',
        };
      case 'latency':
        return {
          data: ts?.model_latency || [],
          color: '#909090',
          label: 'Model Latency',
          unit: 'ms',
          gradient: 'url(#latencyGradient)',
        };
      case 'invocations':
        // EKS/vLLM: use requests_running as proxy for invocations
        return {
          data: ts?.invocations || ts?.requests_running || [],
          color: '#c0c0c0',
          label: 'Requests',
          unit: '',
          gradient: 'url(#invocationsGradient)',
        };
    }
  };

  if (!isVisible) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-foreground-secondary">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading metrics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-error/5 border border-error/20 rounded-lg p-4 text-center">
        <p className="text-error-light text-sm">{error}</p>
        <button
          onClick={fetchMetrics}
          className="mt-2 text-sm text-error-light hover:text-error underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="bg-surface border border-border rounded-lg p-6 text-center">
        <Activity className="w-8 h-8 text-foreground-muted mx-auto mb-2" />
        <p className="text-foreground-secondary text-sm">No metrics available</p>
      </div>
    );
  }

  const chartConfig = getChartConfig();
  const chartData = formatChartData(chartConfig.data);

  return (
    <div className="space-y-6">
      {/* Current Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Cpu className="w-4 h-4" />}
          label="CPU"
          value={`${(metrics.latest?.cpu_utilization ?? 0).toFixed(1)}%`}
          color="blue"
          onClick={() => setActiveChart('cpu')}
          active={activeChart === 'cpu'}
        />
        <StatCard
          icon={<HardDrive className="w-4 h-4" />}
          label="Memory"
          value={`${(metrics.latest?.memory_utilization ?? 0).toFixed(1)}%`}
          color="green"
          onClick={() => setActiveChart('memory')}
          active={activeChart === 'memory'}
        />
        {/* <StatCard
          icon={<Zap className="w-4 h-4" />}
          label="GPU Cache"
          value={`${(metrics.latest?.gpu_utilization ?? metrics.latest?.gpu_cache_usage ?? 0).toFixed(1)}%`}
          color="purple"
          onClick={() => setActiveChart('gpu')}
          active={activeChart === 'gpu'}
        /> */}
        {/* <StatCard
          icon={<Activity className="w-4 h-4" />}
          label="GPU Memory"
          value={`${(metrics.latest?.gpu_memory_utilization ?? metrics.latest?.gpu_cache_usage ?? 0).toFixed(1)}%`}
          color="amber"
          onClick={() => setActiveChart("gpu_memory")}
          active={activeChart === "gpu_memory"}
        /> */}
      </div>

      {/* Inference Stats */}
      {/* <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-100">
        <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-indigo-600" />
          Inference Statistics
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">
              {metrics.inference_stats?.total_inferences ?? 0}
            </div>
            <div className="text-xs text-gray-500">Total Inferences</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              {(metrics.inference_stats?.success_rate ?? 0) >= 95 ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              <span
                className={`text-2xl font-bold ${
                  (metrics.inference_stats?.success_rate ?? 0) >= 95
                    ? "text-success-light"
                    : "text-error-light"
                }`}
              >
                {(metrics.inference_stats?.success_rate ?? 0).toFixed(1)}%
              </span>
            </div>
            <div className="text-xs text-gray-500">Success Rate</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <Clock className="w-4 h-4 text-pink-500" />
              <span className="text-2xl font-bold text-foreground">
                {formatLatencyMs(metrics.inference_stats?.avg_latency_ms ?? 0)}
              </span>
            </div>
            <div className="text-xs text-gray-500">Avg Latency</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              <span className="text-2xl font-bold text-foreground">
                ${(metrics.inference_stats?.total_cost_usd ?? 0).toFixed(4)}
              </span>
            </div>
            <div className="text-xs text-gray-500">Total Cost</div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-indigo-100 flex justify-between text-xs text-gray-600">
          <span>Successful: {metrics.inference_stats?.successful ?? 0}</span>
          <span>Failed: {metrics.inference_stats?.failed ?? 0}</span>
          <span>
            Tokens:{" "}
            {(metrics.inference_stats?.total_tokens ?? 0).toLocaleString()}
          </span>
        </div>
      </div> */}

      {/* Time Series Chart */}
      <div className="bg-surface rounded-lg border border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-foreground">{chartConfig.label} Over Time</h4>
          <div className="flex gap-1">
            <ChartTab
              label="CPU"
              active={activeChart === 'cpu'}
              onClick={() => setActiveChart('cpu')}
            />
            <ChartTab
              label="Memory"
              active={activeChart === 'memory'}
              onClick={() => setActiveChart('memory')}
            />
            {/* <ChartTab
              label="GPU"
              active={activeChart === "gpu" || activeChart === "gpu_memory"}
              onClick={() => setActiveChart("gpu")}
            /> */}
          </div>
        </div>

        {chartData.length > 0 ? (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ededed" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ededed" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="memoryGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#b0b0b0" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#b0b0b0" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gpuGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#808080" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#808080" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gpuMemGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a0a0a0" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#a0a0a0" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#909090" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#909090" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="invocationsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c0c0c0" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#c0c0c0" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10, fill: '#808080' }}
                  tickLine={false}
                  axisLine={{ stroke: '#333333' }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#808080' }}
                  tickLine={false}
                  axisLine={{ stroke: '#333333' }}
                  tickFormatter={(value) => `${value}${chartConfig.unit}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #333333',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#ededed',
                  }}
                  formatter={(value) => [
                    `${Number(value ?? 0).toFixed(2)}${chartConfig.unit}`,
                    chartConfig.label,
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={chartConfig.color}
                  strokeWidth={2}
                  fill={chartConfig.gradient}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-foreground-muted text-sm">
            No data available for this metric
          </div>
        )}
      </div>

      {/* Refresh Button */}
      <div className="flex justify-center">
        <button
          onClick={fetchMetrics}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm text-foreground-secondary hover:text-foreground hover:bg-surface-hover rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Metrics
        </button>
      </div>
    </div>
  );
}

// Helper Components
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'blue' | 'green' | 'purple' | 'amber';
  onClick: () => void;
  active: boolean;
}

function StatCard({
  icon,
  label,
  value,
  onClick,
  active,
}: Omit<StatCardProps, 'color'> & { color?: string }) {
  return (
    <button
      onClick={onClick}
      className={[
        'rounded-lg p-3 border text-left w-full transition-all duration-200',
        active
          ? 'bg-muted border-border ring-2 ring-accent/40 shadow-sm'
          : 'bg-muted/40 border-border hover:bg-muted',
      ].join(' ')}
    >
      <div className="mb-1 text-muted-foreground">{icon}</div>
      <div className="text-lg font-bold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </button>
  );
}

interface ChartTabProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function ChartTab({ label, active, onClick }: ChartTabProps) {
  return (
    <button
      onClick={onClick}
      className={[
        'px-2 py-1 text-xs rounded-md transition-colors',
        active
          ? 'bg-accent/15 text-accent font-medium border border-accent/30'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
