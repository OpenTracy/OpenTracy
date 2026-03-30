import { useContext } from 'react';

import { EvaluationsPageContext } from './evaluationsPageContextStore';

export function useEvaluationsPage() {
  const ctx = useContext(EvaluationsPageContext);
  if (!ctx) throw new Error('useEvaluationsPage must be used within EvaluationsPageProvider');
  return ctx;
}
