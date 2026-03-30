import { createElement } from 'react';
import { Eye, Square, Trash2 } from 'lucide-react';
import type { RowAction } from './ListRowActions';

export function viewAction(opts: {
  visible: boolean;
  onClick: () => void;
  label?: string;
}): RowAction {
  return {
    key: 'view',
    label: opts.label ?? 'View results',
    icon: createElement(Eye, { className: 'size-3.5' }),
    visible: opts.visible,
    onClick: opts.onClick,
  };
}

export function cancelAction(opts: { visible: boolean; onClick: () => void }): RowAction {
  return {
    key: 'cancel',
    label: 'Cancel',
    icon: createElement(Square, { className: 'size-3' }),
    visible: opts.visible,
    onClick: opts.onClick,
  };
}

export function deleteAction(opts: { visible: boolean; onClick: () => void }): RowAction {
  return {
    key: 'delete',
    label: 'Delete',
    icon: createElement(Trash2, { className: 'size-3.5' }),
    visible: opts.visible,
    onClick: opts.onClick,
    className: 'hover:text-destructive',
  };
}
