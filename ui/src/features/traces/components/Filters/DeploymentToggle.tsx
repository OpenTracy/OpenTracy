import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import OpentracyLogo from '@/assets/opentracy-logo.png';

interface DeploymentToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function DeploymentToggle({ checked, onChange }: DeploymentToggleProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <img src={OpentracyLogo} alt="OpenTracy" className="size-4 invert dark:invert-0" />
        <div>
          <Label className="text-sm font-medium text-foreground">Deployment runs only</Label>
          <p className="text-xs text-muted-foreground">Filter to deployed traces</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
