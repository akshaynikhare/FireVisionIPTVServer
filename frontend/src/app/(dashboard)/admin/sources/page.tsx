'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Tv, Monitor, Activity, Download } from 'lucide-react';
import api from '@/lib/api';
import { proxyImageUrl } from '@/lib/image-proxy';
import { useBulkSelection } from '@/hooks/use-bulk-selection';
import { useStreamPlayer } from '@/components/stream-player-context';
import ChannelDetailModal, { type ChannelField } from '@/components/channel-detail-modal';
import ExternalSourceTab from '@/components/external-source-tab';
import SourceChannelDataTable from '@/components/source-channel-data-table';
import LivenessStatsBar from '@/components/ui/liveness-stats-bar';
import type { SourceChannel, SourceTab, LivenessStats } from '@/types/external-sources';

const TABS: { id: SourceTab; label: string; icon: typeof Tv }[] = [
  { id: 'pluto-tv', label: 'Pluto TV', icon: Tv },
  { id: 'samsung-tv-plus', label: 'Samsung TV Plus', icon: Monitor },
];

export default function AdminSourcesPage() {
  const [activeTab, setActiveTab] = useState<SourceTab>('pluto-tv');
  const { playStream } = useStreamPlayer();
  const [detailChannel, setDetailChannel] = useState<SourceChannel | null>(null);
  const selection = useBulkSelection();

  const handlePlay = useCallback(
    (ch: SourceChannel) => {
      playStream(
        {
          name: ch.channelName || 'Stream Preview',
          url: ch.channelUrl,
          logo: ch.tvgLogo ? proxyImageUrl(ch.tvgLogo) : undefined,
        },
        { mode: 'direct-fallback' },
      );
    },
    [playStream],
  );

  const detailFields: ChannelField[] = detailChannel
    ? [
        { label: 'Stream URL', value: detailChannel.channelUrl },
        { label: 'Logo URL', value: detailChannel.tvgLogo },
        { label: 'Category', value: detailChannel.groupTitle },
        { label: 'Country', value: detailChannel.country },
        { label: 'Source', value: detailChannel.source },
        { label: 'Codec', value: detailChannel.codec },
        {
          label: 'Bitrate',
          value: detailChannel.bitrate ? `${detailChannel.bitrate} kbps` : undefined,
        },
        { label: 'Language', value: detailChannel.language },
        {
          label: 'Votes',
          value: detailChannel.votes != null ? String(detailChannel.votes) : undefined,
        },
        { label: 'Homepage', value: detailChannel.homepage },
        {
          label: 'Liveness',
          value: detailChannel.liveness
            ? `${detailChannel.liveness.status}${detailChannel.liveness.responseTimeMs ? ` (${detailChannel.liveness.responseTimeMs}ms)` : ''}${detailChannel.liveness.error ? ` — ${detailChannel.liveness.error}` : ''}`
            : undefined,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-display font-bold uppercase tracking-[0.1em]">Other Sources</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Import channels from free, ad-supported streaming services
        </p>
      </div>

      <div role="tablist" className="flex gap-1 border-b border-border">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setActiveTab(tab.id);
                selection.unselectAll();
              }}
              className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium uppercase tracking-[0.1em] transition-colors border-b-2 -mb-px ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        <ExternalSourceTab
          key={activeTab}
          sourceKey={activeTab}
          sourceLabel={TABS.find((t) => t.id === activeTab)!.label}
        >
          {({ channels, region, onChannelUpdate }) => (
            <AdminSourceContent
              channels={channels}
              source={activeTab}
              region={region}
              selection={selection}
              onPlay={handlePlay}
              onDetail={setDetailChannel}
              onChannelUpdate={onChannelUpdate}
            />
          )}
        </ExternalSourceTab>
      </div>

      <ChannelDetailModal
        open={!!detailChannel}
        onClose={() => setDetailChannel(null)}
        channel={detailChannel}
        fields={detailFields}
        onPlay={
          detailChannel?.channelUrl
            ? () => {
                const ch = detailChannel!;
                setDetailChannel(null);
                handlePlay(ch);
              }
            : undefined
        }
      />
    </div>
  );
}

function AdminSourceContent({
  channels,
  source,
  region,
  selection,
  onPlay,
  onDetail,
  onChannelUpdate,
}: {
  channels: SourceChannel[];
  source: SourceTab;
  region: string;
  selection: ReturnType<typeof useBulkSelection>;
  onPlay: (ch: SourceChannel) => void;
  onDetail: (ch: SourceChannel) => void;
  onChannelUpdate: (
    uid: string,
    liveness: import('@/types/external-sources').ChannelLiveness,
  ) => void;
}) {
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [batchTesting, setBatchTesting] = useState(false);
  const [livenessStats, setLivenessStats] = useState<LivenessStats | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLivenessStats = useCallback(async () => {
    if (!source || !region) return;
    try {
      const res = await api.get(
        `/external-sources/liveness-status?source=${source}&region=${encodeURIComponent(region)}`,
      );
      const data = res.data.data;
      setLivenessStats(data.livenessStats);
      if (!data.livenessCheckInProgress && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setBatchTesting(false);
      }
      if (data.livenessCheckInProgress) {
        setBatchTesting(true);
      }
    } catch {
      // ignore
    }
  }, [source, region]);

  useEffect(() => {
    fetchLivenessStats();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchLivenessStats]);

  async function handleBatchLivenessCheck() {
    if (batchTesting || !source || !region) return;
    setBatchTesting(true);
    try {
      await api.post('/external-sources/check-liveness', { source, region });
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(fetchLivenessStats, 5000);
    } catch {
      setBatchTesting(false);
    }
  }

  async function handleTestChannel(ch: SourceChannel) {
    const res = await api.post(`/external-sources/check-liveness/${ch._uid}`);
    const result = res.data.data;
    if (result) {
      onChannelUpdate(ch._uid, {
        status: result.status,
        lastCheckedAt: new Date().toISOString(),
        responseTimeMs: result.responseTimeMs,
        error: result.error,
      });
    }
    fetchLivenessStats();
  }

  async function handleImport() {
    if (selection.count === 0) return;
    setImporting(true);
    setImportResult(null);

    const toImport = channels
      .filter((c) => selection.isSelected(c._uid))
      .map((c) => ({
        channelName: c.channelName,
        channelUrl: c.channelUrl,
        tvgLogo: c.tvgLogo || '',
        groupTitle: c.groupTitle || 'Imported',
        channelId: c.channelId || '',
        country: c.country || '',
        language: c.language || '',
      }));

    try {
      const res = await api.post('/external-sources/import', {
        channels: toImport,
        replaceExisting,
      });
      const body = res.data;
      setImportResult(
        body.message || `Imported ${body.importedCount || toImport.length} channels to system`,
      );
    } catch {
      setImportResult('Failed to import channels');
    } finally {
      setImporting(false);
    }
  }

  return (
    <SourceChannelDataTable
      channels={channels}
      selection={selection}
      onPlay={onPlay}
      onDetail={onDetail}
      showLiveness
      onTestChannel={handleTestChannel}
      headerSlot={
        livenessStats ? <LivenessStatsBar stats={livenessStats} inProgress={batchTesting} /> : null
      }
      toolbarActions={
        <>
          <button
            onClick={handleBatchLivenessCheck}
            disabled={batchTesting}
            className="inline-flex items-center gap-2 px-4 py-2.5 h-10 text-sm font-medium border border-border bg-card text-foreground uppercase tracking-[0.1em] transition-colors hover:bg-muted disabled:opacity-50 disabled:pointer-events-none"
          >
            {batchTesting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Activity className="h-4 w-4" />
            )}
            {batchTesting ? 'Checking...' : 'Check Liveness'}
          </button>
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(e) => setReplaceExisting(e.target.checked)}
              className="accent-primary"
            />
            Replace existing
          </label>
          <button
            onClick={handleImport}
            disabled={importing || selection.count === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-primary text-primary-foreground uppercase tracking-[0.1em] transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
          >
            <Download className="h-4 w-4" />
            {importing ? 'Importing...' : `Import ${selection.count} to System`}
          </button>
        </>
      }
      bannerSlot={
        importResult ? (
          <div className="border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
            {importResult}
          </div>
        ) : null
      }
    />
  );
}
