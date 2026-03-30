import { useState, useCallback } from 'react';
import type { InferRequest, InferResponse } from '../services/inferService';
import { runInference } from '../services/inferService';
import { useUser } from '../contexts/UserContext';

interface UseInferState {
  loading: boolean;
  error: string | null;
  result: InferResponse | null;
}

interface UseInferReturn extends UseInferState {
  infer: (body: InferRequest) => Promise<InferResponse | null>;
  clear: () => void;
}

export function useInferService(): UseInferReturn {
  const { apiKey } = useUser();
  const inferKey = apiKey?.key; // pk_live_xxx...

  const [state, setState] = useState<UseInferState>({
    loading: false,
    error: null,
    result: null,
  });

  const infer = useCallback(async (body: InferRequest) => {
    setState({ loading: true, error: null, result: null });

    try {
      if (!inferKey) {
        console.warn('API key not set for inference');
        return null;
      }
      const response = await runInference(inferKey, body);
      setState({ loading: false, error: null, result: response });
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error on infer';
      setState({ loading: false, error: message, result: null });
      return null;
    }
  }, []);

  const clear = useCallback(() => {
    setState({ loading: false, error: null, result: null });
  }, []);

  return { ...state, infer, clear };
}
