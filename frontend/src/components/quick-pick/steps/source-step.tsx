'use client';

import { Globe, Tv, Monitor } from 'lucide-react';
import type { SourceType } from '../wizard-shell';

const SOURCES: { id: SourceType; label: string; icon: typeof Globe; description: string }[] = [
  {
    id: 'iptv-org',
    label: 'IPTV-org',
    icon: Globe,
    description: '8000+ channels from the iptv-org database',
  },
  { id: 'pluto-tv', label: 'Pluto TV', icon: Tv, description: 'Free ad-supported TV channels' },
  {
    id: 'samsung-tv-plus',
    label: 'Samsung TV Plus',
    icon: Monitor,
    description: 'Free streaming channels',
  },
];

interface SourceStepProps {
  selectedSources: SourceType[];
  onToggleSource: (source: SourceType) => void;
}

export function SourceStep({ selectedSources, onToggleSource }: SourceStepProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Step 1</p>
        <h2 className="text-base font-display font-bold uppercase tracking-[0.08em]">
          Choose Your Sources
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Select where you want to browse channels from. Pick one or more.
        </p>
      </div>

      <div
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        role="group"
        aria-label="Source selection"
      >
        {SOURCES.map((source) => {
          const Icon = source.icon;
          const isSelected = selectedSources.includes(source.id);
          return (
            <button
              key={source.id}
              onClick={() => onToggleSource(source.id)}
              aria-pressed={isSelected}
              className={`flex items-start gap-3 p-4 border-2 text-left transition-colors ${
                isSelected
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card hover:border-primary/40'
              }`}
            >
              <Icon
                className={`h-5 w-5 mt-0.5 shrink-0 ${
                  isSelected ? 'text-primary' : 'text-muted-foreground'
                }`}
              />
              <div>
                <p
                  className={`text-sm font-medium uppercase tracking-[0.05em] ${isSelected ? 'text-primary' : ''}`}
                >
                  {source.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{source.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {selectedSources.length === 0 && (
        <p className="text-xs text-destructive">Select at least one source to continue.</p>
      )}
    </div>
  );
}
