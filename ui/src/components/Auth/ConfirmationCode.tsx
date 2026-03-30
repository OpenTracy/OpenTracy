import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ConfirmationCodeInput = ({ value, onChange }: Props) => (
  <div className="space-y-2">
    <Label htmlFor="confirmation-code" className="text-xs font-medium text-foreground-secondary">
      Verification Code
    </Label>
    <Input
      id="confirmation-code"
      type="text"
      name="confirmationCode"
      value={value}
      onChange={onChange}
      placeholder="Enter 6-digit code"
      maxLength={6}
      required
    />
  </div>
);
