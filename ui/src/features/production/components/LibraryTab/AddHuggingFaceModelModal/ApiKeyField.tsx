import { Info, Key, Lock, Shield } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Field, FieldContent, FieldDescription } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ApiKeyFieldProps {
  hfApiKey: string;
  showApiKey: boolean;
  needsApiKey: boolean;
  disabled: boolean;
  apiKeyInputRef: React.RefObject<HTMLInputElement | null>;
  onApiKeyChange: (value: string) => void;
  onToggle: () => void;
  onRetryWithApiKey: () => void;
}

export function ApiKeyField({
  hfApiKey,
  showApiKey,
  needsApiKey,
  disabled,
  apiKeyInputRef,
  onApiKeyChange,
  onToggle,
  onRetryWithApiKey,
}: ApiKeyFieldProps) {
  const isOpen = showApiKey || needsApiKey;

  const handleOpenChange = (open: boolean) => {
    // Only allow toggling when the API key is not required
    if (!needsApiKey) onToggle();
    // Focus the input after the collapsible content renders
    if (open) requestAnimationFrame(() => apiKeyInputRef.current?.focus());
  };

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={handleOpenChange}
      className={`rounded-lg border transition-colors ${
        needsApiKey
          ? 'border-yellow-500/30 bg-yellow-500/5'
          : isOpen
            ? 'border-border bg-muted/30'
            : 'border-transparent'
      }`}
    >
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={`w-full justify-start gap-2 font-normal ${
            needsApiKey ? 'text-yellow-600' : 'text-muted-foreground'
          }`}
        >
          {needsApiKey ? <Lock className="size-4 shrink-0" /> : <Key className="size-4 shrink-0" />}
          {needsApiKey
            ? 'API Key required for this model'
            : isOpen
              ? 'HuggingFace API Key'
              : 'Add API Key (for gated models)'}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="px-3 pb-3 space-y-3">
          <Field>
            <FieldContent>
              <Label htmlFor="hf-api-key" className="sr-only">
                HuggingFace API Key
              </Label>
              <Input
                id="hf-api-key"
                ref={apiKeyInputRef}
                type="password"
                value={hfApiKey}
                onChange={(e) => {
                  onApiKeyChange(e.target.value);
                  if (needsApiKey) onRetryWithApiKey();
                }}
                placeholder="hf_..."
                disabled={disabled}
                className={
                  needsApiKey ? 'border-yellow-500/30 focus-visible:ring-yellow-500/30' : ''
                }
              />

              <FieldDescription className="flex items-start gap-1.5">
                <Info className="size-3 mt-0.5 shrink-0" />
                <span>
                  Get your key from{' '}
                  <a
                    href="https://huggingface.co/settings/tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    HuggingFace Settings → Access Tokens
                  </a>
                </span>
              </FieldDescription>

              {needsApiKey && (
                <FieldDescription className="flex items-start gap-1.5 text-yellow-600">
                  <Shield className="size-3 mt-0.5 shrink-0" />
                  <span>
                    Make sure you've accepted the model's license agreement on its HuggingFace page.
                  </span>
                </FieldDescription>
              )}
            </FieldContent>
          </Field>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
