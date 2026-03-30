import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface ModelCardDeleteDialogProps {
  modelName: string;
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ModelCardDeleteDialog({
  modelName,
  isOpen,
  onConfirm,
  onCancel,
}: ModelCardDeleteDialogProps) {
  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{modelName}"?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove the model from your registry. You will need to re-download
            it if you want to use it again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete Model
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
