import { useCallback, useMemo, useReducer } from 'react';

import type { AvailableModel, CreateCustomMetricRequest } from '../../types';
import { PYTHON_METRIC_TEMPLATE } from '../../types/evaluationsTypes';

export type CustomMetricType = 'llm_judge' | 'python';

interface CustomMetricFormState {
  name: string;
  description: string;
  type: CustomMetricType;
  judgeModel: string;
  criteria: string[];
  customCriteria: string;
  promptTemplate: string;
  pythonScript: string;
  requirements: string[];
  newRequirement: string;
  error: string | null;
}

type FormField = Omit<
  CustomMetricFormState,
  'criteria' | 'requirements' | 'error' | 'judgeModel' | 'type'
>;

type FormAction =
  | { type: 'setField'; field: keyof FormField; value: string }
  | { type: 'setType'; value: CustomMetricType }
  | { type: 'setJudgeModel'; value: string }
  | { type: 'setError'; value: string | null }
  | { type: 'reset'; payload: Pick<CustomMetricFormState, 'judgeModel'> }
  | { type: 'addCriteria'; value: string }
  | { type: 'removeCriteria'; value: string }
  | { type: 'addRequirement'; value: string }
  | { type: 'removeRequirement'; value: string };

export const SUGGESTED_CRITERIA = [
  'accuracy',
  'helpfulness',
  'coherence',
  'relevance',
  'creativity',
  'conciseness',
  'professionalism',
  'technical_accuracy',
];

export const POPULAR_PACKAGES = [
  { name: 'textstat', description: 'Text readability metrics' },
  { name: 'nltk', description: 'Natural language processing' },
  { name: 'rouge-score', description: 'ROUGE summarization metrics' },
  { name: 'sacrebleu', description: 'BLEU translation metrics' },
  { name: 'sentence-transformers', description: 'Semantic similarity' },
];

const DEFAULT_CRITERIA = ['accuracy', 'helpfulness'];

const getInitialState = (judgeModel: string): CustomMetricFormState => ({
  name: '',
  description: '',
  type: 'llm_judge',
  judgeModel,
  criteria: DEFAULT_CRITERIA,
  customCriteria: '',
  promptTemplate: '',
  pythonScript: PYTHON_METRIC_TEMPLATE,
  requirements: [],
  newRequirement: '',
  error: null,
});

function reducer(state: CustomMetricFormState, action: FormAction): CustomMetricFormState {
  switch (action.type) {
    case 'setField':
      return { ...state, [action.field]: action.value };

    case 'setType':
      return { ...state, type: action.value, error: null };

    case 'setJudgeModel':
      return { ...state, judgeModel: action.value };

    case 'setError':
      return { ...state, error: action.value };

    case 'addCriteria': {
      const criterion = action.value.trim().toLowerCase();
      if (!criterion || state.criteria.includes(criterion)) {
        return { ...state, customCriteria: '' };
      }
      return {
        ...state,
        criteria: [...state.criteria, criterion],
        customCriteria: '',
      };
    }

    case 'removeCriteria':
      return {
        ...state,
        criteria: state.criteria.filter((item) => item !== action.value),
      };

    case 'addRequirement': {
      const requirement = action.value.trim().toLowerCase();
      if (!requirement || state.requirements.includes(requirement)) {
        return { ...state, newRequirement: '' };
      }

      return {
        ...state,
        requirements: [...state.requirements, requirement],
        newRequirement: '',
      };
    }

    case 'removeRequirement':
      return {
        ...state,
        requirements: state.requirements.filter((item) => item !== action.value),
      };

    case 'reset':
      return getInitialState(action.payload.judgeModel);

    default:
      return state;
  }
}

function getValidationError(state: CustomMetricFormState): string | null {
  if (!state.name.trim()) return 'Please enter a metric name';
  if (!state.description.trim()) return 'Please enter a metric description';

  if (state.type === 'llm_judge') {
    if (!state.judgeModel) return 'Please select a judge model';
    if (state.criteria.length === 0) return 'Please add at least one evaluation criterion';
  }

  if (state.type === 'python') {
    if (!state.pythonScript.trim()) return 'Please provide a Python script';
    if (!/\bdef\s+evaluate\s*\(/.test(state.pythonScript)) {
      return 'Python script must contain a function named "evaluate"';
    }
  }

  return null;
}

export function useCreateCustomMetricForm(judgeModels: AvailableModel[]) {
  const initialJudgeModel = useMemo(() => judgeModels[0]?.id ?? '', [judgeModels]);
  const [state, dispatch] = useReducer(reducer, getInitialState(initialJudgeModel));

  const setField = useCallback((field: keyof FormField, value: string) => {
    dispatch({ type: 'setField', field, value });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'reset', payload: { judgeModel: initialJudgeModel } });
  }, [initialJudgeModel]);

  const addCriteria = useCallback((value: string) => {
    dispatch({ type: 'addCriteria', value });
  }, []);

  const removeCriteria = useCallback((value: string) => {
    dispatch({ type: 'removeCriteria', value });
  }, []);

  const addRequirement = useCallback((value: string) => {
    dispatch({ type: 'addRequirement', value });
  }, []);

  const removeRequirement = useCallback((value: string) => {
    dispatch({ type: 'removeRequirement', value });
  }, []);

  const setType = useCallback((value: CustomMetricType) => {
    dispatch({ type: 'setType', value });
  }, []);

  const setJudgeModel = useCallback((value: string) => {
    dispatch({ type: 'setJudgeModel', value });
  }, []);

  const setError = useCallback((value: string | null) => {
    dispatch({ type: 'setError', value });
  }, []);

  const buildPayload = useCallback((): CreateCustomMetricRequest | null => {
    const validationError = getValidationError(state);

    if (validationError) {
      setError(validationError);
      return null;
    }

    return {
      name: state.name.trim(),
      description: state.description.trim(),
      type: state.type,
      config: {
        judge_model: state.type === 'llm_judge' ? state.judgeModel : undefined,
        criteria: state.type === 'llm_judge' ? state.criteria : undefined,
        prompt_template: state.promptTemplate.trim() || undefined,
      },
      python_script: state.type === 'python' ? state.pythonScript : undefined,
      requirements:
        state.type === 'python' && state.requirements.length > 0 ? state.requirements : undefined,
    };
  }, [setError, state]);

  return {
    state,
    setField,
    setType,
    setJudgeModel,
    setError,
    reset,
    addCriteria,
    removeCriteria,
    addRequirement,
    removeRequirement,
    buildPayload,
  };
}
