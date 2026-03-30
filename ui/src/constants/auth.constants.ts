import type { AuthFormData, AuthState } from '../types/auth.types';

export const INITIAL_FORM_DATA: AuthFormData = {
  email: '',
  password: '',
  confirmPassword: '',
  username: '',
  confirmationCode: '',
  newPassword: '',
  confirmNewPassword: '',
};

export const INITIAL_AUTH_STATE: Omit<AuthState, 'activeTab' | 'resetStep' | 'showPassword'> = {
  loading: false,
  error: '',
  success: '',
  needsConfirmation: false,
};

export const PASSWORD_MIN_LENGTH = 8;

export const AUTH_MESSAGES = {
  PASSWORD_MISMATCH: 'Passwords do not match',
  EMAIL_REQUIRED: 'Please enter your email address',
  EMAIL_INVALID: 'Please enter a valid email address',
  EMAIL_TYPO: (suggestion: string) => `Did you mean ${suggestion}?`,
  FILL_ALL_FIELDS: 'Please fill in all fields',
  USERNAME_REQUIRED: 'Please enter a username',
  PASSWORD_TOO_SHORT: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`,
  PASSWORD_NEEDS_UPPERCASE: 'Password must contain at least one uppercase letter',
  PASSWORD_NEEDS_LOWERCASE: 'Password must contain at least one lowercase letter',
  PASSWORD_NEEDS_NUMBER: 'Password must contain at least one number',
  PASSWORD_NEEDS_SPECIAL: 'Password must contain at least one special character',
  RESET_SUCCESS: 'Password reset successfully! You can now sign in with your new password.',
  CODE_SENT: 'Password reset code sent to your email',
  ACCOUNT_VERIFIED: 'Account verified successfully! Signing you in...',
  CODE_RESENT: 'Verification code resent to your email',
  EMAIL_REQUIRED_FOR_RESEND: 'Email is required to resend code',
} as const;

export const COMMON_TLD_TYPOS: Record<string, string> = {
  '.cm': '.com',
  '.con': '.com',
  '.cmo': '.com',
  '.om': '.com',
  '.comm': '.com',
  '.coom': '.com',
  '.nte': '.net',
  '.ent': '.net',
  '.nett': '.net',
  '.ogr': '.org',
  '.orgg': '.org',
  '.rog': '.org',
};

export const COMMON_DOMAIN_TYPOS: Record<string, string> = {
  'gmial.': 'gmail.',
  'gmal.': 'gmail.',
  'gmai.': 'gmail.',
  'gamil.': 'gmail.',
  'gnail.': 'gmail.',
  'gmil.': 'gmail.',
  'hotmal.': 'hotmail.',
  'hotmai.': 'hotmail.',
  'hotmial.': 'hotmail.',
  'outlok.': 'outlook.',
  'outloo.': 'outlook.',
  'outlokk.': 'outlook.',
  'yaho.': 'yahoo.',
  'yahooo.': 'yahoo.',
  'yhoo.': 'yahoo.',
};
