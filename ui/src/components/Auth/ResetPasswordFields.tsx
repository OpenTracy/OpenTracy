import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface ResetPasswordFormData {
  email: string;
  confirmationCode?: string;
  newPassword?: string;
  confirmNewPassword?: string;
}

interface Props {
  formData: ResetPasswordFormData;
  showPassword: boolean;
  resetStep: 'request' | 'confirm';
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTogglePassword: () => void;
}

export function ResetPasswordFields({
  formData,
  showPassword,
  resetStep,
  onChange,
  onTogglePassword,
}: Props) {
  if (resetStep === 'request') {
    return (
      <div className="space-y-2">
        <Label htmlFor="reset-email" className="text-xs font-medium text-foreground-secondary">
          Email
        </Label>
        <Input
          id="reset-email"
          type="email"
          name="email"
          value={formData.email}
          onChange={onChange}
          placeholder="name@company.com"
          autoComplete="email"
          required
        />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="code" className="text-xs font-medium text-foreground-secondary">
          Verification Code
        </Label>
        <Input
          id="code"
          type="text"
          name="confirmationCode"
          value={formData.confirmationCode}
          onChange={onChange}
          placeholder="Enter 6-digit code"
          autoComplete="one-time-code"
          maxLength={6}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="new-password" className="text-xs font-medium text-foreground-secondary">
          New Password
        </Label>
        <div className="relative">
          <Input
            id="new-password"
            type={showPassword ? 'text' : 'password'}
            name="newPassword"
            value={formData.newPassword}
            onChange={onChange}
            placeholder="Enter new password"
            autoComplete="new-password"
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
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="confirm-new-password"
          className="text-xs font-medium text-foreground-secondary"
        >
          Confirm New Password
        </Label>
        <div className="relative">
          <Input
            id="confirm-new-password"
            type={showPassword ? 'text' : 'password'}
            name="confirmNewPassword"
            value={formData.confirmNewPassword}
            onChange={onChange}
            placeholder="Confirm new password"
            autoComplete="new-password"
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
      </div>
    </>
  );
}
