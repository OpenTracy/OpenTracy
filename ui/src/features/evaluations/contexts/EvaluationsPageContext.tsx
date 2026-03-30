import type { ReactNode } from 'react';

import { EvaluationsPageContext, useEvaluationsPageValue } from './evaluationsPageContextStore';

export function EvaluationsPageProvider({ children }: { children: ReactNode }) {
  const value = useEvaluationsPageValue();
  return (
    <EvaluationsPageContext.Provider value={value}>{children}</EvaluationsPageContext.Provider>
  );
}
