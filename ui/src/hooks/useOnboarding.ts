import { useCallback, useMemo } from 'react';
import { useUser } from '../contexts/UserContext';

export function useOnboarding() {
  const { profile, updateProfile, loading } = useUser();

  const step = profile?.onboarding_step ?? 0;
  const isActive = step >= 0 && step <= 5;

  const nextStep = useCallback(async () => {
    await updateProfile({ onboarding_step: step + 1 });
  }, [updateProfile, step]);

  const goToStep = useCallback(
    async (target: number) => {
      await updateProfile({ onboarding_step: target });
    },
    [updateProfile]
  );

  const skip = useCallback(async () => {
    await updateProfile({ onboarding_step: -1, is_new_user: false });
  }, [updateProfile]);

  const complete = useCallback(async () => {
    await updateProfile({ onboarding_step: 6, is_new_user: false });
  }, [updateProfile]);

  const restart = useCallback(async () => {
    await updateProfile({ onboarding_step: 1, is_new_user: true });
  }, [updateProfile]);

  return useMemo(
    () => ({ step, isActive, nextStep, goToStep, skip, complete, restart, loading }),
    [step, isActive, nextStep, goToStep, skip, complete, restart, loading]
  );
}
