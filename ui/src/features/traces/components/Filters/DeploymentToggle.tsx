import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface DeploymentToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  logo: string;
}

export function DeploymentToggle({ checked, onChange, logo }: DeploymentToggleProps) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-background p-3">
      <div className="flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-md bg-muted">
          <img src={logo} alt="Logo" className="size-4 invert dark:invert-0" />
        </div>
        <div>
          <Label className="text-sm font-medium">Deployment Runs Only</Label>
          <p className="text-xs text-muted-foreground">Show only deployed traces</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
