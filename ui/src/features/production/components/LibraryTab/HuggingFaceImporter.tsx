import { Download, ExternalLink, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface HuggingFaceImporterProps {
  onAddModel: () => void;
}

export function HuggingFaceImporter({ onAddModel }: HuggingFaceImporterProps) {
  return (
    <Card className="mb-8">
      <CardContent>
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shrink-0">
            <Download className="size-5 text-primary-foreground" />
          </div>

          <div className="flex-1">
            <h3 className="font-semibold mb-1">Import from HuggingFace</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Import any open-source model from HuggingFace Hub. We validate compatibility with vLLM
              and download it for deployment.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={onAddModel} variant="secondary">
                <Plus className="w-4 h-4" />
                Add Model
              </Button>
              <a
                href="https://huggingface.co/models?pipeline_tag=text-generation&sort=trending"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
              >
                Browse HuggingFace
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
