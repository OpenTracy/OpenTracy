import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Sparkles,
  BarChart3,
  GitBranch,
  FlaskConical,
  Settings,
  Database,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { Badge } from '@/components/ui/badge';
import { PageTabs, type PageTab } from '@/components/shared/PageTabs';
import type { Dataset, ViewTab } from '../../types';

const TABS: PageTab<ViewTab>[] = [
  { id: 'general', label: 'General', icon: <BarChart3 className="size-4" /> },
  { id: 'data-pipeline', label: 'Data Pipeline', icon: <GitBranch className="size-4" /> },
  { id: 'models', label: 'Models', icon: <Sparkles className="size-4" /> },
  { id: 'evaluate', label: 'Evaluate', icon: <FlaskConical className="size-4" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="size-4" /> },
];

interface DetailHeaderProps {
  dataset: Dataset;
  activeTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  onExport: () => void;
  onTraining: () => void;
}

export function DetailHeader({
  dataset,
  activeTab,
  onTabChange,
  onExport,
  onTraining,
}: DetailHeaderProps) {
  const navigate = useNavigate();

  const formattedDate = dataset.created_at
    ? new Date(dataset.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';

  return (
    <header className="shrink-0 bg-background">
      <div className="px-6 pt-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                href="/distill-datasets"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/distill-datasets');
                }}
              >
                Datasets
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{dataset.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-center justify-between mt-4 mb-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => navigate('/distill-datasets')}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-semibold text-foreground tracking-tight">
                  {dataset.name}
                </h1>
                <Badge variant="secondary" className="text-xs gap-1">
                  <Database className="size-3" />
                  {dataset.samples_count.toLocaleString()} samples
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {dataset.description && (
                  <span className="max-w-md truncate">{dataset.description}</span>
                )}
                {dataset.description && formattedDate && <span className="text-border">|</span>}
                {formattedDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3" />
                    {formattedDate}
                  </span>
                )}
                {dataset.source && (
                  <>
                    <span className="text-border">|</span>
                    <span className="capitalize">{dataset.source.replace(/_/g, ' ')}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onExport}>
              <Download className="size-4" />
              Export JSON
            </Button>
            <Button variant="default" size="sm" onClick={onTraining}>
              <Sparkles className="size-4" />
              Start Training
            </Button>
          </div>
        </div>
      </div>

      <PageTabs tabs={TABS} value={activeTab} onValueChange={onTabChange} />
    </header>
  );
}
