import { useCallback, useRef, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { ChevronDown, ChevronUp, FileCode2, Package, Plus, Terminal, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { handleEditorWillMount } from '../Metrics/monacoTheme';
import { POPULAR_PACKAGES } from './useCreateCustomMetricForm';

interface PythonScriptEditorProps {
  pythonScript: string;
  requirements: string[];
  newRequirement: string;
  onScriptChange: (value: string) => void;
  onNewRequirementChange: (value: string) => void;
  onAddRequirement: (value: string) => void;
  onRemoveRequirement: (value: string) => void;
}

export function PythonScriptEditor({
  pythonScript,
  requirements,
  newRequirement,
  onScriptChange,
  onNewRequirementChange,
  onAddRequirement,
  onRemoveRequirement,
}: PythonScriptEditorProps) {
  const [panelOpen, setPanelOpen] = useState(true);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const lineCount = pythonScript.split('\n').length;

  const handleEditorMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;
    editor.onDidChangeCursorPosition((e) => {
      setCursorPosition({ line: e.position.lineNumber, column: e.position.column });
    });
  }, []);

  return (
    <div className="flex flex-col rounded-lg border border-border bg-background overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center justify-between bg-surface border-b border-border">
        <Tabs defaultValue="evaluate" className="gap-0">
          <TabsList variant="line" className="h-9 rounded-none bg-transparent p-0">
            <TabsTrigger
              value="evaluate"
              className="h-9 rounded-none border-b-0 px-4 gap-2 text-xs data-[state=active]:bg-background data-[state=active]:shadow-none after:hidden"
            >
              <FileCode2 className="size-3.5 text-foreground-muted" />
              evaluate.py
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center pr-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-6 text-foreground-muted hover:text-foreground"
            onClick={() => setPanelOpen(!panelOpen)}
            title={panelOpen ? 'Hide dependencies' : 'Show dependencies'}
          >
            {panelOpen ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="relative">
        <Editor
          height={panelOpen ? '380px' : '500px'}
          defaultLanguage="python"
          value={pythonScript}
          onChange={(value) => onScriptChange(value || '')}
          theme="pureai-dark"
          beforeMount={handleEditorWillMount}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            wordWrap: 'on',
            padding: { top: 8, bottom: 8 },
            renderLineHighlight: 'line',
            cursorBlinking: 'smooth',
            smoothScrolling: true,
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: true, indentation: true },
            folding: true,
            glyphMargin: false,
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            overviewRulerBorder: false,
            scrollbar: {
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
          }}
        />
      </div>

      {/* Dependencies panel */}
      {panelOpen && (
        <>
          <Separator />

          <div className="flex flex-col bg-surface">
            {/* Panel tab bar */}
            <div className="flex items-center gap-2 border-b border-border px-3 h-8">
              <Package className="size-3.5 text-foreground-muted" />
              <span className="text-xs font-medium text-foreground-secondary uppercase tracking-wider">
                Dependencies
              </span>
              {requirements.length > 0 && (
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px] rounded-sm">
                  {requirements.length}
                </Badge>
              )}
            </div>

            <div className="p-3 space-y-2.5">
              {/* Installed packages */}
              {requirements.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {requirements.map((pkg) => (
                    <Badge
                      key={pkg}
                      variant="outline"
                      className="gap-1 py-0.5 px-2 font-mono text-xs rounded-sm"
                    >
                      <Terminal className="size-3 text-foreground-muted" />
                      {pkg}
                      <button
                        type="button"
                        className="ml-0.5 rounded-sm hover:bg-surface-hover p-0.5 transition-colors"
                        onClick={() => onRemoveRequirement(pkg)}
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {/* Add package input */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Terminal className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-foreground-muted" />
                  <Input
                    className="h-8 pl-8 font-mono text-xs bg-background"
                    value={newRequirement}
                    onChange={(event) => onNewRequirementChange(event.target.value)}
                    placeholder="pip install package-name"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        onAddRequirement(newRequirement);
                      }
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => onAddRequirement(newRequirement)}
                  disabled={!newRequirement.trim()}
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>

              {/* Suggested packages */}
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_PACKAGES.filter((pkg) => !requirements.includes(pkg.name)).map((pkg) => (
                  <button
                    key={pkg.name}
                    type="button"
                    className="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-0.5 text-xs font-mono text-foreground-secondary hover:text-foreground hover:border-border-hover hover:bg-surface-hover transition-colors"
                    onClick={() => onAddRequirement(pkg.name)}
                    title={pkg.description}
                  >
                    <Plus className="size-3" />
                    {pkg.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Status bar */}
      <div className="flex items-center justify-between border-t border-border bg-surface px-3 h-6 text-[11px] text-foreground-muted select-none">
        <div className="flex items-center gap-3">
          <span>Python</span>
          <span>UTF-8</span>
          <span>{lineCount} lines</span>
        </div>
        <div className="flex items-center gap-3">
          <span>
            Ln {cursorPosition.line}, Col {cursorPosition.column}
          </span>
          <span>Spaces: 4</span>
        </div>
      </div>
    </div>
  );
}
