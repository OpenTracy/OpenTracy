import type { MetricType } from '../../types/evaluationsTypes';

export const METRIC_TYPE_INFO: Record<string, { label: string; description: string }> = {
  exact_match: {
    label: 'Exact Match',
    description: 'Compares model output character-by-character with the expected output',
  },
  contains: {
    label: 'Contains',
    description: 'Checks if the model output contains specific expected text or keywords',
  },
  semantic_sim: {
    label: 'Semantic Similarity',
    description: 'Uses embeddings to measure semantic similarity between output and expected text',
  },
  hf_similarity: {
    label: 'HF Similarity',
    description: 'Calculates semantic similarity using HuggingFace-style embeddings',
  },
  llm_judge: {
    label: 'LLM Judge',
    description: 'Uses a language model to evaluate response quality based on specified criteria',
  },
  latency: {
    label: 'Latency',
    description: 'Measures the response time of the model in seconds',
  },
  cost: {
    label: 'Cost',
    description: 'Tracks the cost per inference in USD based on token usage',
  },
  python: {
    label: 'Python Script',
    description: 'Custom evaluation logic implemented in Python',
  },
};

export const TYPE_FILTERS: { id: MetricType | 'all'; label: string }[] = [
  { id: 'all', label: 'All Types' },
  { id: 'exact_match', label: 'Exact Match' },
  { id: 'contains', label: 'Contains' },
  { id: 'semantic_sim', label: 'Semantic Sim' },
  { id: 'hf_similarity', label: 'HF Similarity' },
  { id: 'llm_judge', label: 'LLM Judge' },
  { id: 'latency', label: 'Latency' },
  { id: 'cost', label: 'Cost' },
  { id: 'python', label: 'Python' },
];
