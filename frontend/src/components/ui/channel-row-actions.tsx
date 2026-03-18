'use client';

import { type ReactNode } from 'react';
import { Eye, Play, Zap, Pencil, Trash2, Loader2 } from 'lucide-react';

interface ChannelRowActionsProps {
  onDetail?: () => void;
  onPlay?: () => void;
  onTest?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  testing?: boolean;
  children?: ReactNode;
}

const btnBase =
  'flex items-center justify-center h-8 w-8 text-muted-foreground transition-colors focus-visible:ring-2 focus-visible:ring-primary';

export default function ChannelRowActions({
  onDetail,
  onPlay,
  onTest,
  onEdit,
  onDelete,
  testing,
  children,
}: ChannelRowActionsProps) {
  return (
    <div className="flex items-center justify-end gap-1">
      {onDetail && (
        <button
          onClick={onDetail}
          className={`${btnBase} hover:text-foreground`}
          aria-label="View details"
        >
          <Eye className="h-4 w-4" />
        </button>
      )}
      {onPlay && (
        <button
          onClick={onPlay}
          className={`${btnBase} hover:text-primary`}
          aria-label="Play stream"
        >
          <Play className="h-4 w-4" />
        </button>
      )}
      {onTest && (
        <button
          onClick={onTest}
          disabled={testing}
          className={`${btnBase} hover:text-primary disabled:opacity-50`}
          aria-label="Test stream"
        >
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
        </button>
      )}
      {onEdit && (
        <button
          onClick={onEdit}
          className={`${btnBase} hover:text-foreground`}
          aria-label="Edit channel"
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}
      {onDelete && (
        <button
          onClick={onDelete}
          className={`${btnBase} hover:text-destructive`}
          aria-label="Delete channel"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
      {children}
    </div>
  );
}
