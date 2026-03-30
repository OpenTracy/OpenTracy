import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';

interface TutorialContextValue {
  /** Whether the current page's tutorial step action has been completed */
  completed: boolean;
  /** Set the completed state from a page */
  setCompleted: (value: boolean) => void;
  /** Custom label for the continue button */
  continueLabel: string | undefined;
  /** Set the continue label from a page */
  setContinueLabel: (label: string | undefined) => void;
  /** Custom continue handler */
  onContinue: (() => void) | undefined;
  /** Set the continue handler from a page */
  setOnContinue: (handler: (() => void) | undefined) => void;
}

const TutorialContext = createContext<TutorialContextValue>({
  completed: false,
  setCompleted: () => {},
  continueLabel: undefined,
  setContinueLabel: () => {},
  onContinue: undefined,
  setOnContinue: () => {},
});

export function TutorialProvider({ children }: { children: ReactNode }) {
  const [completed, setCompleted] = useState(false);
  const [continueLabel, setContinueLabel] = useState<string | undefined>();
  const [onContinueRef, setOnContinueRef] = useState<{ fn: (() => void) | undefined }>({
    fn: undefined,
  });
  const location = useLocation();

  // Reset context when the route changes so stale state doesn't bleed across pages
  useEffect(() => {
    setCompleted(false);
    setContinueLabel(undefined);
    setOnContinueRef({ fn: undefined });
  }, [location.pathname]);

  // Wrap setOnContinue to avoid the "function as initializer" pitfall of useState
  const setOnContinue = useCallback((handler: (() => void) | undefined) => {
    setOnContinueRef({ fn: handler });
  }, []);

  const value = useMemo(
    () => ({
      completed,
      setCompleted,
      continueLabel,
      setContinueLabel,
      onContinue: onContinueRef.fn,
      setOnContinue,
    }),
    [completed, continueLabel, onContinueRef, setOnContinue]
  );

  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
}

export function useTutorialContext() {
  return useContext(TutorialContext);
}

/**
 * Declarative hook for pages participating in the tutorial.
 * Call from a page component to tell the TutorialPanel about step completion.
 *
 * @param forStep     - The tutorial step id this page corresponds to (1–5)
 * @param completed   - Whether the user has completed the action for this step
 * @param opts.continueLabel - Custom label for the "Continue" button
 * @param opts.onContinue    - Override what happens when the user clicks "Continue"
 */
export function useTutorialStep(
  _forStep: number,
  completed: boolean,
  opts?: { continueLabel?: string; onContinue?: () => void }
) {
  const { setCompleted, setContinueLabel, setOnContinue } = useContext(TutorialContext);

  // We need access to the current onboarding step to know if this page is actually active
  // Import is avoided here; the caller can simply not call the hook if not needed,
  // or we check reactively.
  useEffect(() => {
    setCompleted(completed);
  }, [completed, setCompleted]);

  useEffect(() => {
    setContinueLabel(opts?.continueLabel);
  }, [opts?.continueLabel, setContinueLabel]);

  useEffect(() => {
    setOnContinue(opts?.onContinue);
  }, [opts?.onContinue, setOnContinue]);
}
