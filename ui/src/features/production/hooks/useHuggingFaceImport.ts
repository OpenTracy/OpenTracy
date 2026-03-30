import { useState, useCallback, useRef } from 'react';
import { useUser } from '@/contexts/UserContext';
import { registerModel } from '@/features/production/api/modelRegistryService';
import type { RegisteredModel } from '@/features/production/api/modelRegistryService';

import {
  VLLM_SUPPORTED_ARCHITECTURES,
  TEXT_GENERATION_TASKS,
  MODEL_ID_PATTERN,
} from '../constants/hfModelModal.constants';
import type { ValidationState, HuggingFaceModelInfo } from '../types/hfModelModal.types';
import { INITIAL_VALIDATION } from '../types/hfModelModal.types';

const STEP_DELAY_MS = 350;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface UseHuggingFaceImportOptions {
  initialModelId?: string;
  onModelRegistered: (model: RegisteredModel) => void;
  onClose: () => void;
}

export function useHuggingFaceImport({ onModelRegistered, onClose }: UseHuggingFaceImportOptions) {
  const { accessToken } = useUser();

  const [hfModelId, setHfModelId] = useState('');
  const [hfApiKey, setHfApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsApiKey, setNeedsApiKey] = useState(false);
  const [modelInfo, setModelInfo] = useState<HuggingFaceModelInfo | null>(null);
  const [validation, setValidation] = useState<ValidationState>(INITIAL_VALIDATION);
  const [showValidation, setShowValidation] = useState(false);

  const apiKeyInputRef = useRef<HTMLInputElement>(null);

  // ---- derived state ----
  const isValidating =
    validation.modelAccess === 'validating' ||
    validation.textGeneration === 'validating' ||
    validation.vllm === 'validating';

  const allPassed =
    validation.modelAccess === 'success' &&
    validation.textGeneration === 'success' &&
    validation.vllm === 'success';

  const hasError =
    validation.modelAccess === 'error' ||
    validation.textGeneration === 'error' ||
    validation.vllm === 'error';

  const isBusy = isRegistering || isValidating;
  const canSubmit = !!hfModelId.trim() && !isBusy;

  // ---- reset helpers ----
  const resetValidation = useCallback(() => {
    setValidation(INITIAL_VALIDATION);
    setShowValidation(false);
    setError(null);
    setModelInfo(null);
    setNeedsApiKey(false);
  }, []);

  const resetAll = useCallback(() => {
    setHfModelId('');
    setHfApiKey('');
    setShowApiKey(false);
    setIsRegistering(false);
    resetValidation();
  }, [resetValidation]);

  // ---- validation ----
  const validate = useCallback(async (): Promise<boolean> => {
    const id = hfModelId.trim();
    if (!id) return false;

    if (!MODEL_ID_PATTERN.test(id)) {
      setError('Invalid model ID format. Use format: organization/model-name');
      return false;
    }

    setShowValidation(true);
    setError(null);
    setNeedsApiKey(false);
    setValidation({ ...INITIAL_VALIDATION, modelAccess: 'validating' });

    try {
      const headers: HeadersInit = {};
      if (hfApiKey.trim()) headers['Authorization'] = `Bearer ${hfApiKey.trim()}`;

      const res = await fetch(`https://huggingface.co/api/models/${id}`, { headers });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setNeedsApiKey(true);
          setShowApiKey(true);
          setValidation((p) => ({
            ...p,
            modelAccess: 'error',
            modelAccessMessage: 'Authentication required — this is a gated or private model',
          }));
          return false;
        }
        if (res.status === 404) {
          setValidation((p) => ({
            ...p,
            modelAccess: 'error',
            modelAccessMessage: 'Model not found on HuggingFace',
          }));
          return false;
        }
        throw new Error('Failed to fetch model information from HuggingFace');
      }

      const data: HuggingFaceModelInfo = await res.json();
      setModelInfo(data);

      const isGated = data.gated === true || data.gated === 'auto' || data.gated === 'manual';

      await delay(STEP_DELAY_MS);

      setValidation((p) => ({
        ...p,
        modelAccess: 'success',
        modelAccessMessage: isGated
          ? 'Access granted (gated model)'
          : data.private
            ? 'Access granted (private model)'
            : 'Public model',
        textGeneration: 'validating',
      }));

      await delay(STEP_DELAY_MS);

      const pipeline = (data.pipeline_tag ?? '').toLowerCase();
      const isTextGen = TEXT_GENERATION_TASKS.some((t: string) => t === pipeline);

      setValidation((p) => ({
        ...p,
        textGeneration: isTextGen ? 'success' : 'error',
        textGenerationMessage: isTextGen
          ? `Task: ${data.pipeline_tag}`
          : pipeline
            ? `Task "${pipeline}" is not supported for inference`
            : 'No task type specified — may not be an inference model',
        vllm: 'validating',
      }));

      await delay(STEP_DELAY_MS);

      const modelType = (data.config?.model_type ?? '').toLowerCase();
      const libraryName = (data.library_name ?? '').toLowerCase();
      const archMatch = VLLM_SUPPORTED_ARCHITECTURES.some(
        (a: string) => modelType.includes(a) || id.toLowerCase().includes(a)
      );
      const hasTransformers = libraryName === 'transformers' || !libraryName;
      const vllmOk = archMatch && hasTransformers;

      setValidation((p) => ({
        ...p,
        vllm: vllmOk ? 'success' : 'error',
        vllmMessage: vllmOk
          ? `Architecture: ${modelType || 'compatible'}`
          : `Architecture "${modelType || 'unknown'}" may not be supported by vLLM`,
      }));

      return isTextGen && vllmOk;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
      setValidation({
        modelAccess: 'error',
        textGeneration: 'error',
        vllm: 'error',
        modelAccessMessage: 'Could not connect to HuggingFace',
        textGenerationMessage: 'Could not validate',
        vllmMessage: 'Could not validate',
      });
      return false;
    }
  }, [hfModelId, hfApiKey]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      if (!accessToken) {
        setError('Authentication required');
        return;
      }
      if (!hfModelId.trim()) {
        setError('Please enter a HuggingFace model ID');
        return;
      }

      const ok = await validate();
      if (!ok) return;

      setIsRegistering(true);
      setError(null);

      try {
        const result = await registerModel(accessToken, {
          hf_model_id: hfModelId.trim(),
          hf_api_key: hfApiKey.trim() || undefined,
        });
        onModelRegistered(result.model);
        resetAll();
        onClose();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to register model';
        if (msg.includes('400') || msg.includes('access') || msg.includes('gated')) {
          setNeedsApiKey(true);
          setShowApiKey(true);
          setError(
            "Access denied. This model requires a HuggingFace API key with access permissions. Please ensure you have accepted the model's license on HuggingFace."
          );
        } else if (msg.includes('401') || msg.includes('unauthorized')) {
          setNeedsApiKey(true);
          setShowApiKey(true);
          setError('Invalid or expired API key. Please check your HuggingFace API key.');
        } else {
          setError(msg);
        }
      } finally {
        setIsRegistering(false);
      }
    },
    [accessToken, hfModelId, hfApiKey, validate, onModelRegistered, onClose, resetAll]
  );

  const handleClose = useCallback(() => {
    resetAll();
    onClose();
  }, [resetAll, onClose]);

  const handleRetryWithApiKey = useCallback(() => {
    resetValidation();
  }, [resetValidation]);

  return {
    // form fields
    hfModelId,
    setHfModelId,
    hfApiKey,
    setHfApiKey,
    showApiKey,
    setShowApiKey,
    apiKeyInputRef,

    // validation
    validation,
    showValidation,
    modelInfo,
    isValidating,
    allPassed,
    hasError,

    // registration
    isRegistering,
    error,
    needsApiKey,
    isBusy,
    canSubmit,

    // actions
    handleSubmit,
    handleClose,
    handleRetryWithApiKey,
    resetValidation,
  };
}
