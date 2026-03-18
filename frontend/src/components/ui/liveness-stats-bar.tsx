'use client';

import StatusDot from '@/components/ui/status-dot';
import type { LivenessStats } from '@/types/external-sources';

interface LivenessStatsBarProps {
  stats: LivenessStats;
  inProgress?: boolean;
  progressText?: string;
}

export default function LivenessStatsBar({
  stats,
  inProgress,
  progressText,
}: LivenessStatsBarProps) {
  if (stats.alive === 0 && stats.dead === 0 && stats.unknown === 0) return null;

  return (
    <div className="flex items-center gap-4 px-4 py-2.5 border border-border bg-card">
      <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Stream Health
      </span>
      <div className="flex items-center gap-3">
        <span className="relative inline-flex items-center gap-1.5 text-xs">
          <StatusDot status="alive" showLabel={false} size="md" />
          <span className="font-medium">{stats.alive}</span>
          <span className="text-muted-foreground">alive</span>
        </span>
        <span className="relative inline-flex items-center gap-1.5 text-xs">
          <StatusDot status="dead" showLabel={false} size="md" />
          <span className="font-medium">{stats.dead}</span>
          <span className="text-muted-foreground">dead</span>
        </span>
        <span className="relative inline-flex items-center gap-1.5 text-xs">
          <StatusDot status="unknown" showLabel={false} size="md" />
          <span className="font-medium">{stats.unknown}</span>
          <span className="text-muted-foreground">unknown</span>
        </span>
      </div>
      {inProgress && (
        <span className="text-xs text-muted-foreground animate-pulse">
          {progressText || 'Batch check in progress...'}
        </span>
      )}
    </div>
  );
}
