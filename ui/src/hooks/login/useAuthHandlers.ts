import { useCallback } from 'react';
import {
  signIn,
  signUp,
  confirmSignUp,
  getCurrentUser,
  resetPassword,
  confirmResetPassword,
  signInWithRedirect,
} from 'aws-amplify/auth';
import type { AuthFormData } from '@/types/auth.types';
import {
  validateSignUp,
  validateSignIn,
  validatePasswordReset,
  validateResetRequest,
  validateResendCode,
} from '@/utils/auth.validations';
import { AUTH_MESSAGES } from '@/constants/auth.constants';
import { clearUrlParams } from '@/utils/url.utils';

interface UseAuthHandlersProps {
  formData: AuthFormData;
  setLoading: (loading: boolean) => void;
  setError: (error: string) => void;
  setSuccess: (success: string) => void;
  setNeedsConfirmation: (needs: boolean) => void;
  setResetStep: (step: 'request' | 'confirm') => void;
  setActiveTab: (tab: 'signin' | 'signup' | 'reset') => void;
  resetFormData: () => void;
  setFormDataBulk: (data: Partial<AuthFormData>) => void;
  onAuthSuccess: (user: any) => void;
}

export const useAuthHandlers = ({
  formData,
  setLoading,
  setError,
  setSuccess,
  setNeedsConfirmation,
  setResetStep,
  setActiveTab,
  setFormDataBulk,
  onAuthSuccess,
}: UseAuthHandlersProps) => {
  const handleSignIn = useCallback(async () => {
    const validationError = validateSignIn(formData);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      localStorage.clear();
      await signIn({ username: formData.email, password: formData.password });
      const user = await getCurrentUser();
      onAuthSuccess(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  }, [formData, setLoading, setError, onAuthSuccess]);

  const handleSignUp = useCallback(async () => {
    const validationError = validateSignUp(formData);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      await signUp({
        username: formData.email,
        password: formData.password,
        options: {
          userAttributes: {
            email: formData.email,
            preferred_username: formData.username,
          },
        },
      });
      setNeedsConfirmation(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  }, [formData, setLoading, setError, setNeedsConfirmation]);

  const handleConfirmSignUp = useCallback(async () => {
    setLoading(true);
    try {
      await confirmSignUp({
        username: formData.email,
        confirmationCode: formData.confirmationCode,
      });
      clearUrlParams();
      setSuccess(AUTH_MESSAGES.ACCOUNT_VERIFIED);
      setTimeout(async () => {
        await handleSignIn();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm sign up');
    } finally {
      setLoading(false);
    }
  }, [formData.email, formData.confirmationCode, setLoading, setError, setSuccess, handleSignIn]);

  const handleResetRequest = useCallback(async () => {
    const validationError = validateResetRequest(formData.email);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      await resetPassword({ username: formData.email });
      setSuccess(AUTH_MESSAGES.CODE_SENT);
      setResetStep('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset code');
    } finally {
      setLoading(false);
    }
  }, [formData.email, setLoading, setError, setSuccess, setResetStep]);

  const handleResetConfirm = useCallback(async () => {
    const validationError = validatePasswordReset(formData);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      await confirmResetPassword({
        username: formData.email,
        confirmationCode: formData.confirmationCode,
        newPassword: formData.newPassword,
      });
      setSuccess(AUTH_MESSAGES.RESET_SUCCESS);

      setTimeout(() => {
        setFormDataBulk({
          email: formData.email,
          password: '',
          confirmPassword: '',
          username: '',
          confirmationCode: '',
          newPassword: '',
          confirmNewPassword: '',
        });
        setActiveTab('signin');
        setResetStep('request');
        setSuccess('');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  }, [formData, setLoading, setError, setSuccess, setActiveTab, setResetStep, setFormDataBulk]);

  const handleAuth0SignIn = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      await signInWithRedirect({
        provider: { custom: 'auth0' },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in with GitHub');
      setLoading(false);
    }
  }, [setLoading, setError]);

  const handleResendCode = useCallback(async () => {
    const validationError = validateResendCode(formData.email);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      await signUp({
        username: formData.email,
        password: formData.password || 'temp-password',
        options: {
          userAttributes: {
            email: formData.email,
            preferred_username: formData.username || formData.email,
          },
        },
      });
      setSuccess(AUTH_MESSAGES.CODE_RESENT);
    } catch (err) {
      if (err instanceof Error && err.message.includes('already exists')) {
        setSuccess(AUTH_MESSAGES.CODE_RESENT);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to resend code');
      }
    } finally {
      setLoading(false);
    }
  }, [formData, setLoading, setError, setSuccess]);

  return {
    handleSignIn,
    handleSignUp,
    handleConfirmSignUp,
    handleResetRequest,
    handleResetConfirm,
    handleAuth0SignIn,
    handleResendCode,
  };
};
