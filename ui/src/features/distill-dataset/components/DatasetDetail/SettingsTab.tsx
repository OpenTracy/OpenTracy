import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { Dataset } from '../../types';

interface SettingsTabProps {
  dataset: Dataset;
  onDelete: () => void;
}

export function SettingsTab({ dataset, onDelete }: SettingsTabProps) {
  const formatDate = (date?: string) =>
    date
      ? new Date(date).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : '-';

  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dataset Information</CardTitle>
            <CardDescription>General information about this dataset.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Name</Label>
              <Input value={dataset.name} disabled className="max-w-md bg-muted" />
            </div>
            {dataset.description && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Description</Label>
                <Input value={dataset.description} disabled className="max-w-md bg-muted" />
              </div>
            )}
            <Separator />
            <div className="grid grid-cols-2 gap-6 max-w-md">
              {[
                { label: 'Source', value: dataset.source?.replace(/_/g, ' ') ?? 'manual' },
                { label: 'Samples', value: dataset.samples_count.toLocaleString() },
                { label: 'Created', value: formatDate(dataset.created_at) },
                { label: 'Last Updated', value: formatDate(dataset.updated_at) },
              ].map((item) => (
                <div key={item.label} className="space-y-1">
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                  <p className="text-sm font-medium text-foreground capitalize">{item.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Once deleted, a dataset cannot be recovered. All samples will be permanently removed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="size-4" />
                  Delete Dataset
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete &quot;{dataset.name}&quot;?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. All {dataset.samples_count.toLocaleString()}{' '}
                    samples in this dataset will be permanently deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDelete}
                    className="bg-destructive text-destructive-foreground"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
