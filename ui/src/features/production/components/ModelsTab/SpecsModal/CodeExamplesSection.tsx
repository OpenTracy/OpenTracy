import { Code2, Terminal } from 'lucide-react';

import { FieldLegend, FieldSet } from '@/components/ui/field';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CodeBlock } from './CodeBlock';

import {
  buildCurlCode,
  buildJsCode,
  buildPythonCode,
} from '@/features/production/utils/codeBuilters.utils';
import type { SectionProps } from '@/features/production/types/specsModal.types';

const TABS = [
  {
    value: 'python',
    label: 'Python',
    icon: Terminal,
    language: 'python',
    buildCode: buildPythonCode,
  },
  {
    value: 'curl',
    label: 'cURL',
    icon: Code2,
    language: 'bash',
    buildCode: buildCurlCode,
  },
  {
    value: 'js',
    label: 'JavaScript',
    icon: Code2,
    language: 'javascript',
    buildCode: buildJsCode,
  },
] as const;

export function CodeExamplesSection({ apiModelId }: SectionProps) {
  return (
    <FieldSet>
      <FieldLegend>Code examples</FieldLegend>
      <Tabs defaultValue="python" orientation="vertical" className="gap-0">
        <TabsList
          variant="line"
          className="w-32 shrink-0 flex-col justify-start border-r rounded-none pr-0 h-auto gap-0.5"
        >
          {TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="w-full justify-start gap-2">
              <Icon className="size-3.5" aria-hidden="true" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex-1 pl-4">
          {TABS.map(({ value, language, buildCode }) => (
            <TabsContent key={value} value={value}>
              <CodeBlock code={buildCode(apiModelId)} language={language} />
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </FieldSet>
  );
}
