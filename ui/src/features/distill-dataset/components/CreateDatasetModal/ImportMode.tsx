import { useRef, useState } from 'react';
import { FileText, Upload, ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface ImportModeProps {
  file: File | null;
  disabled: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ImportMode({ file, disabled, onFileChange }: ImportModeProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formatOpen, setFormatOpen] = useState(false);

  return (
    <div className="space-y-3">
      <Card
        className="cursor-pointer border-dashed border-2 hover:border-primary hover:bg-accent/50 transition-colors"
        onClick={() => fileInputRef.current?.click()}
      >
        <CardContent className="py-6 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json"
            onChange={onFileChange}
            className="hidden"
            disabled={disabled}
          />
          {file ? (
            <div className="space-y-1">
              <FileText className="size-8 mx-auto text-primary" />
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          ) : (
            <div className="space-y-1">
              <Upload className="size-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Click to upload CSV or JSON</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Collapsible open={formatOpen} onOpenChange={setFormatOpen}>
        <CollapsibleTrigger className="flex w-full items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ChevronDown
            className={`size-3.5 transition-transform ${formatOpen ? 'rotate-180' : ''}`}
          />
          Expected format reference
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 space-y-2 text-xs text-muted-foreground">
            <div>
              <span className="font-medium">JSON:</span>{' '}
              <code className="bg-muted px-1.5 py-0.5 rounded">
                {'[{ "input": "...", "expected_output": "..." }]'}
              </code>
            </div>
            <div>
              <span className="font-medium">CSV:</span>{' '}
              <code className="bg-muted px-1.5 py-0.5 rounded">input,expected_output</code>
            </div>
            <p>The &quot;expected_output&quot; field is optional.</p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
