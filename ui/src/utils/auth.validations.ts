import type { AuthFormData } from '@/types/auth.types';
import {
  AUTH_MESSAGES,
  PASSWORD_MIN_LENGTH,
  COMMON_TLD_TYPOS,
  COMMON_DOMAIN_TYPOS,
} from '@/constants/auth.constants';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const validateEmail = (email: string): string | null => {
  if (!email) {
    return AUTH_MESSAGES.EMAIL_REQUIRED;
  }

  if (!EMAIL_REGEX.test(email)) {
    return AUTH_MESSAGES.EMAIL_INVALID;
  }

  const typoSuggestion = detectEmailTypo(email);
  if (typoSuggestion) {
    return AUTH_MESSAGES.EMAIL_TYPO(typoSuggestion);
  }

  return null;
};

export const detectEmailTypo = (email: string): string | null => {
  const lower = email.toLowerCase();

  for (const [typo, fix] of Object.entries(COMMON_DOMAIN_TYPOS)) {
    if (lower.includes(typo)) {
      return email.replace(new RegExp(typo.replace('.', '\\.'), 'i'), fix);
    }
  }

  for (const [typo, fix] of Object.entries(COMMON_TLD_TYPOS)) {
    if (lower.endsWith(typo)) {
      return email.slice(0, -typo.length) + fix;
    }
  }

  return null;
};

export interface PasswordCheck {
  label: string;
  met: boolean;
}

export const getPasswordChecks = (password: string): PasswordCheck[] => [
  {
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    met: password.length >= PASSWORD_MIN_LENGTH,
  },
  { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
  { label: 'One lowercase letter', met: /[a-z]/.test(password) },
  { label: 'One number', met: /\d/.test(password) },
  { label: 'One special character (!@#$...)', met: /[^A-Za-z0-9]/.test(password) },
];

export const validatePassword = (password: string): string | null => {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return AUTH_MESSAGES.PASSWORD_TOO_SHORT;
  }
  if (!/[A-Z]/.test(password)) {
    return AUTH_MESSAGES.PASSWORD_NEEDS_UPPERCASE;
  }
  if (!/[a-z]/.test(password)) {
    return AUTH_MESSAGES.PASSWORD_NEEDS_LOWERCASE;
  }
  if (!/\d/.test(password)) {
    return AUTH_MESSAGES.PASSWORD_NEEDS_NUMBER;
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return AUTH_MESSAGES.PASSWORD_NEEDS_SPECIAL;
  }
  return null;
};

export const validateSignUp = (formData: AuthFormData): string | null => {
  if (!formData.username?.trim()) {
    return AUTH_MESSAGES.USERNAME_REQUIRED;
  }

  const emailError = validateEmail(formData.email);
  if (emailError) {
    return emailError;
  }

  const passwordError = validatePassword(formData.password);
  if (passwordError) {
    return passwordError;
  }

  if (formData.password !== formData.confirmPassword) {
    return AUTH_MESSAGES.PASSWORD_MISMATCH;
  }

  return null;
};

export const validateSignIn = (formData: AuthFormData): string | null => {
  if (!formData.email) {
    return AUTH_MESSAGES.EMAIL_REQUIRED;
  }

  const emailError = validateEmail(formData.email);
  if (emailError) {
    return emailError;
  }

  return null;
};

export const validatePasswordReset = (formData: AuthFormData): string | null => {
  if (!formData.confirmationCode || !formData.newPassword) {
    return AUTH_MESSAGES.FILL_ALL_FIELDS;
  }

  if (formData.newPassword !== formData.confirmNewPassword) {
    return AUTH_MESSAGES.PASSWORD_MISMATCH;
  }

  const passwordError = validatePassword(formData.newPassword);
  if (passwordError) {
    return passwordError;
  }

  return null;
};

export const validateResetRequest = (email: string): string | null => {
  if (!email) {
    return AUTH_MESSAGES.EMAIL_REQUIRED;
  }

  const emailError = validateEmail(email);
  if (emailError) {
    return emailError;
  }

  return null;
};

export const validateResendCode = (email: string): string | null => {
  if (!email) {
    return AUTH_MESSAGES.EMAIL_REQUIRED_FOR_RESEND;
  }
  return null;
};
