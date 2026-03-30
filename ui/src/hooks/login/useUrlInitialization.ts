import { useEffect } from 'react';
import { parseUrlParams, isVerificationUrl } from '@/utils/url.utils';
import type { AuthFormData } from '@/types/auth.types';

interface UseUrlInitializationProps {
  setFormDataBulk: (data: Partial<AuthFormData>) => void;
  setNeedsConfirmation: (needs: boolean) => void;
  handleConfirmSignUp: () => void;
}

export const useUrlInitialization = ({
  setFormDataBulk,
  setNeedsConfirmation,
  handleConfirmSignUp,
}: UseUrlInitializationProps) => {
  useEffect(() => {
    const urlParams = parseUrlParams();

    if (isVerificationUrl(urlParams)) {
      setFormDataBulk({
        email: decodeURIComponent(urlParams.email!),
        confirmationCode: urlParams.code || '',
      });
      setNeedsConfirmation(true);

      if (urlParams.code) {
        setTimeout(() => {
          handleConfirmSignUp();
        }, 500);
      }
    }
  }, [setFormDataBulk, setNeedsConfirmation, handleConfirmSignUp]);
};
