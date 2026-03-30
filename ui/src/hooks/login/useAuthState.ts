import { useState } from 'react';
import type { AuthTab, ResetStep, AuthFormData } from '@/types/auth.types';
import { INITIAL_FORM_DATA } from '@/constants/auth.constants';

export const useAuthState = () => {
  const [activeTab, setActiveTab] = useState<AuthTab>('signin');
  const [resetStep, setResetStep] = useState<ResetStep>('request');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [formData, setFormData] = useState<AuthFormData>(INITIAL_FORM_DATA);

  const updateFormData = (field: keyof AuthFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError('');
    setSuccess('');
  };

  const resetFormData = () => {
    setFormData(INITIAL_FORM_DATA);
  };

  const resetAuthState = () => {
    setError('');
    setSuccess('');
    setLoading(false);
  };

  const resetToSignIn = () => {
    setActiveTab('signin');
    setResetStep('request');
    setNeedsConfirmation(false);
    resetFormData();
    resetAuthState();
  };

  const setFormDataBulk = (data: Partial<AuthFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  return {
    // State
    activeTab,
    resetStep,
    showPassword,
    loading,
    error,
    success,
    needsConfirmation,
    formData,

    // Setters
    setActiveTab,
    setResetStep,
    setShowPassword,
    setLoading,
    setError,
    setSuccess,
    setNeedsConfirmation,
    setFormData,

    // Helpers
    updateFormData,
    resetFormData,
    resetAuthState,
    resetToSignIn,
    setFormDataBulk,
  };
};
