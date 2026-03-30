import { useState } from 'react';
import { Eye, EyeOff, Check, X, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { getPasswordChecks, detectEmailTypo, validateEmail } from '@/utils/auth.validations';
import { cn } from '@/lib/utils';

interface AuthFormData {
  username?: string;
  email: string;
  password: string;
  confirmPassword?: string;
}

interface AuthProps {
  formData: AuthFormData;
  showPassword: boolean;
  activeTab: 'signin' | 'signup' | 'reset';
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTogglePassword: () => void;
}

export function AuthFields({
  formData,
  showPassword,
  activeTab,
  onChange,
  onTogglePassword,
}: AuthProps) {
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  if (activeTab === 'reset') return null;

  const isSignUp = activeTab === 'signup';
  const emailTypo = formData.email ? detectEmailTypo(formData.email) : null;
  const emailError = emailTouched && formData.email ? validateEmail(formData.email) : null;
  const showEmailError = emailError && !emailTypo;
  const passwordChecks = isSignUp ? getPasswordChecks(formData.password) : [];
  const allPasswordChecksMet = passwordChecks.every((c) => c.met);
  const showPasswordChecks =
    isSignUp && passwordTouched && formData.password && !allPasswordChecksMet;
  const passwordsMismatch =
    isSignUp && formData.confirmPassword && formData.password !== formData.confirmPassword;

  return (
    <>
      {isSignUp && (
        <div className="space-y-2">
          <Label htmlFor="username" className="text-xs font-medium text-foreground-secondary">
            Username
          </Label>
          <Input
            id="username"
            type="text"
            name="username"
            value={formData.username}
            onChange={onChange}
            placeholder="Enter your username"
            autoComplete="username"
            required
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email" className="text-xs font-medium text-foreground-secondary">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          name="email"
          value={formData.email}
          onChange={onChange}
          onBlur={() => setEmailTouched(true)}
          placeholder="name@company.com"
          autoComplete={isSignUp ? 'email' : 'username'}
          className={cn(showEmailError && 'border-red-500 focus-visible:ring-red-500/20')}
          required
        />
        {emailTypo && (
          <p className="text-xs text-yellow-500 flex items-center gap-1.5 mt-1">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            Did you mean <span className="font-medium">{emailTypo}</span>?
          </p>
        )}
        {showEmailError && <p className="text-xs text-red-500 mt-1">{emailError}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-xs font-medium text-foreground-secondary">
          Password
        </Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            name="password"
            value={formData.password}
            onChange={onChange}
            onBlur={() => setPasswordTouched(true)}
            placeholder="Enter your password"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            className="pr-10"
            required
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onTogglePassword}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-foreground-muted hover:text-foreground"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        {showPasswordChecks && (
          <ul className="space-y-1 mt-2">
            {passwordChecks.map((check) => (
              <li
                key={check.label}
                className={cn(
                  'flex items-center gap-1.5 text-xs transition-colors',
                  check.met ? 'text-green-500' : 'text-foreground-muted'
                )}
              >
                {check.met ? (
                  <Check className="h-3 w-3 shrink-0" />
                ) : (
                  <X className="h-3 w-3 shrink-0" />
                )}
                {check.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      {isSignUp && (
        <div className="space-y-2">
          <Label
            htmlFor="confirmPassword"
            className="text-xs font-medium text-foreground-secondary"
          >
            Confirm Password
          </Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={onChange}
              placeholder="Confirm your password"
              autoComplete="new-password"
              className={cn(
                'pr-10',
                passwordsMismatch && 'border-red-500 focus-visible:ring-red-500/20'
              )}
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onTogglePassword}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-foreground-muted hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          {passwordsMismatch && <p className="text-xs text-red-500 mt-1">Passwords do not match</p>}
        </div>
      )}
    </>
  );
}
