'use client';

import { Activity } from 'lucide-react';
import type { LivenessStats } from '@/types/external-sources';

interface LivenessStatsBarProps {
  stats: LivenessStats;
  inProgress?: boolean;
}

export default function LivenessStatsBar({ stats, inProgress }: LivenessStatsBarProps) {
  if (stats.alive === 0 && stats.dead === 0 && stats.unknown === 0) return null;

  return (
    <div className="flex items-center gap-4 px-4 py-2.5 bg-muted/50 border border-border text-xs">
      <Activity className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-signal-green font-medium">{stats.alive} alive</span>
      <span className="text-signal-red font-medium">{stats.dead} dead</span>
      <span className="text-muted-foreground font-medium">{stats.unknown} unknown</span>
      {inProgress && <span className="text-primary font-medium animate-pulse">checking...</span>}
    </div>
  );
}
