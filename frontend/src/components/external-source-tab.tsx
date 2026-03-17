'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { SourceChannel, ChannelLiveness, Region } from '@/types/external-sources';
import { regionDisplayName } from '@/types/external-sources';

interface ExternalSourceTabProps {
  sourceKey: string;
  sourceLabel: string;
  defaultRegion?: string;
  children: (props: {
    channels: SourceChannel[];
    region: string;
    onChannelUpdate: (uid: string, liveness: ChannelLiveness) => void;
  }) => ReactNode;
}

export default function ExternalSourceTab({
  sourceKey,
  sourceLabel,
  defaultRegion = 'us',
  children,
}: ExternalSourceTabProps) {
  const { toast } = useToast();
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegion, setSelectedRegion] = useState(defaultRegion);
  const [channels, setChannels] = useState<SourceChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [regionsLoading, setRegionsLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/external-sources/${sourceKey}/regions`)
      .then((res) => setRegions(res.data.data || []))
      .catch(() => {})
      .finally(() => setRegionsLoading(false));
  }, [sourceKey]);

  async function fetchChannels(region: string) {
    setSelectedRegion(region);
    setLoading(true);
    setChannels([]);
    try {
      const res = await api.get(`/external-sources/${sourceKey}/channels?country=${region}`);
      setChannels(res.data.data || []);
    } catch {
      toast(`Failed to fetch ${sourceLabel} channels`, 'error');
    } finally {
      setLoading(false);
    }
  }

  function handleChannelUpdate(uid: string, liveness: ChannelLiveness) {
    setChannels((prev) => prev.map((ch) => (ch._uid === uid ? { ...ch, liveness } : ch)));
  }

  return (
    <div className="space-y-4">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Select Region</p>

      {regionsLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {regions.map((r) => (
            <button
              key={r.code}
              onClick={() => fetchChannels(r.code)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-2 transition-colors ${
                selectedRegion === r.code && channels.length > 0
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card shadow-sm hover:border-primary/40'
              }`}
            >
              {regionDisplayName(r)}
              {r.channelCount != null && (
                <span className="text-muted-foreground text-xs">({r.channelCount})</span>
              )}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">
            Fetching {sourceLabel} channels...
          </span>
        </div>
      )}

      {!loading &&
        channels.length > 0 &&
        children({ channels, region: selectedRegion, onChannelUpdate: handleChannelUpdate })}
    </div>
  );
}
