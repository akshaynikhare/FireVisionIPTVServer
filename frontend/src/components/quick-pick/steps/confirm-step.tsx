'use client';

import { useState, useMemo } from 'react';
import { Loader2, CheckCircle, ArrowRight, RotateCcw } from 'lucide-react';
import { proxyImageUrl } from '@/lib/image-proxy';
import api from '@/lib/api';
import type { WizardChannel } from '../wizard-shell';

const SOURCE_LABELS: Record<string, string> = {
  'iptv-org': 'IPTV-org',
  'pluto-tv': 'Pluto TV',
  'samsung-tv-plus': 'Samsung TV Plus',
};

interface ConfirmStepProps {
  fetchedChannels: WizardChannel[];
  selectedChannelIds: Set<string>;
  mode: 'user' | 'admin';
  onReset: () => void;
}

export function ConfirmStep({
  fetchedChannels,
  selectedChannelIds,
  mode,
  onReset,
}: ConfirmStepProps) {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const selectedChannels = useMemo(
    () => fetchedChannels.filter((ch) => selectedChannelIds.has(ch.uid)),
    [fetchedChannels, selectedChannelIds],
  );

  const groupedBySource = useMemo(() => {
    const groups: Record<string, WizardChannel[]> = {};
    selectedChannels.forEach((ch) => {
      if (!groups[ch.source]) groups[ch.source] = [];
      groups[ch.source].push(ch);
    });
    return groups;
  }, [selectedChannels]);

  async function handleImport() {
    setImporting(true);
    setResult(null);

    try {
      let totalAdded = 0;

      // Group channels by source for appropriate API calls
      const iptvOrgChannels = selectedChannels.filter((ch) => ch.source === 'iptv-org');
      const externalChannels = selectedChannels.filter((ch) => ch.source !== 'iptv-org');

      // Import IPTV-org channels
      if (iptvOrgChannels.length > 0) {
        if (mode === 'user') {
          const payload = iptvOrgChannels.map((ch) => ({
            name: ch.channelName,
            url: ch.channelUrl,
            logo: ch.tvgLogo,
            category: ch.groupTitle,
            id: ch.channelId,
            country: ch.country,
            language: ch.language,
          }));
          const res = await api.post('/iptv-org/import-user', { channels: payload });
          totalAdded += res.data.addedCount || 0;
        } else {
          const payload = iptvOrgChannels.map((ch) => ({
            channelName: ch.channelName,
            channelUrl: ch.channelUrl,
            tvgLogo: ch.tvgLogo,
            channelGroup: ch.groupTitle,
            channelId: ch.channelId,
            country: ch.country,
            language: ch.language,
          }));
          const res = await api.post('/iptv-org/import', { channels: payload });
          totalAdded += res.data.importedCount || 0;
        }
      }

      // Import external source channels
      if (externalChannels.length > 0) {
        const payload = externalChannels.map((ch) => ({
          channelName: ch.channelName,
          channelUrl: ch.channelUrl,
          tvgLogo: ch.tvgLogo,
          groupTitle: ch.groupTitle,
          channelId: ch.channelId,
          country: ch.country,
          language: ch.language,
        }));

        if (mode === 'user') {
          const res = await api.post('/external-sources/import-user', { channels: payload });
          totalAdded += res.data.addedCount || 0;
        } else {
          const res = await api.post('/external-sources/import', { channels: payload });
          totalAdded += res.data.importedCount || 0;
        }
      }

      setResult({
        success: true,
        message: `Successfully added ${totalAdded} channel${totalAdded !== 1 ? 's' : ''} to your ${mode === 'user' ? 'list' : 'system'}!`,
      });
    } catch {
      setResult({
        success: false,
        message: 'Failed to import channels. Please try again.',
      });
    } finally {
      setImporting(false);
    }
  }

  // Success state
  if (result?.success) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <CheckCircle className="h-12 w-12 text-primary" />
        <h2 className="text-base font-display font-bold uppercase tracking-[0.08em]">
          Channels Added!
        </h2>
        <p className="text-sm text-muted-foreground text-center max-w-md">{result.message}</p>
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={onReset}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-2 border-border bg-card hover:border-primary/40 uppercase tracking-[0.1em] transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Pick More
          </button>
          <a
            href={mode === 'user' ? '/user/channels' : '/admin/channels'}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-primary text-primary-foreground uppercase tracking-[0.1em] transition-colors hover:bg-primary/90"
          >
            {mode === 'user' ? 'My Channels' : 'View Channels'}{' '}
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Step 6</p>
        <h2 className="text-base font-display font-bold uppercase tracking-[0.08em]">
          Confirm Selection
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Review your selection and add to {mode === 'user' ? 'your list' : 'the system'}.
        </p>
      </div>

      {result && !result.success && (
        <div className="border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {result.message}
        </div>
      )}

      {/* Summary by source */}
      <div className="space-y-3">
        {Object.entries(groupedBySource).map(([source, channels]) => (
          <div key={source} className="border border-border">
            <div className="flex items-center justify-between px-4 py-2.5 bg-muted/50">
              <h3 className="text-xs font-medium uppercase tracking-[0.1em]">
                {SOURCE_LABELS[source] || source}
              </h3>
              <span className="text-xs text-muted-foreground">
                {channels.length} channel{channels.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="divide-y divide-border max-h-[200px] overflow-y-auto">
              {channels.map((ch) => (
                <div key={ch.uid} className="flex items-center gap-3 px-4 py-2">
                  {ch.tvgLogo ? (
                    <img
                      src={proxyImageUrl(ch.tvgLogo)}
                      alt={ch.channelName}
                      loading="lazy"
                      className="h-6 w-6 rounded-sm object-contain shrink-0 bg-muted"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="h-6 w-6 rounded-sm bg-muted shrink-0" />
                  )}
                  <span className="text-sm truncate flex-1">{ch.channelName}</span>
                  <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                    {ch.groupTitle}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2" aria-live="polite">
        <p className="text-sm font-medium">
          Total: {selectedChannels.length} channel{selectedChannels.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={handleImport}
          disabled={importing || selectedChannels.length === 0}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-primary-foreground uppercase tracking-[0.1em] transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
        >
          {importing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Importing...
            </>
          ) : (
            <>Add to {mode === 'user' ? 'My Channels' : 'System'}</>
          )}
        </button>
      </div>
    </div>
  );
}
