'use client';

import { useCallback, useState } from 'react';
import { Tv, Monitor, Download } from 'lucide-react';
import api from '@/lib/api';
import { proxyImageUrl } from '@/lib/image-proxy';
import { useToast } from '@/hooks/use-toast';
import { useBulkSelection } from '@/hooks/use-bulk-selection';
import { useStreamPlayer } from '@/components/stream-player-context';
import ChannelDetailModal, { type ChannelField } from '@/components/channel-detail-modal';
import ExternalSourceTab from '@/components/external-source-tab';
import SourceChannelDataTable from '@/components/source-channel-data-table';
import type { SourceChannel, SourceTab } from '@/types/external-sources';

const TABS: { id: SourceTab; label: string; icon: typeof Tv }[] = [
  { id: 'pluto-tv', label: 'Pluto TV', icon: Tv },
  { id: 'samsung-tv-plus', label: 'Samsung TV Plus', icon: Monitor },
];

export default function UserSourcesPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<SourceTab>('pluto-tv');
  const { playStream } = useStreamPlayer();
  const [detailChannel, setDetailChannel] = useState<SourceChannel | null>(null);
  const selection = useBulkSelection();
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

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

  async function handleTestChannel(ch: SourceChannel) {
    const res = await api.post(`/external-sources/check-liveness/${ch._uid}`);
    const result = res.data.data;
    if (result) {
      toast(
        result.status === 'alive' ? 'Stream is alive' : `Stream is ${result.status}`,
        result.status === 'alive' ? 'success' : 'error',
      );
    }
  }

  async function handleImport(channels: SourceChannel[]) {
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
      const res = await api.post('/external-sources/import-user', { channels: toImport });
      const body = res.data;
      setImportResult(
        body.message || `Added ${body.addedCount || toImport.length} channels to your list`,
      );
    } catch {
      setImportResult('Failed to import channels');
    } finally {
      setImporting(false);
    }
  }

  const detailFields: ChannelField[] = detailChannel
    ? [
        { label: 'Stream URL', value: detailChannel.channelUrl },
        { label: 'Category', value: detailChannel.groupTitle },
        { label: 'Country', value: detailChannel.country },
        { label: 'Language', value: detailChannel.language },
        { label: 'Codec', value: detailChannel.codec },
        {
          label: 'Bitrate',
          value: detailChannel.bitrate ? `${detailChannel.bitrate} kbps` : undefined,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-display font-bold uppercase tracking-[0.1em]">Other Sources</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse and import channels from free streaming services
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
                setImportResult(null);
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
          {({ channels }) => (
            <SourceChannelDataTable
              channels={channels}
              selection={selection}
              onPlay={handlePlay}
              onDetail={setDetailChannel}
              onTestChannel={handleTestChannel}
              toolbarActions={
                <button
                  onClick={() => handleImport(channels)}
                  disabled={importing || selection.count === 0}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-primary text-primary-foreground uppercase tracking-[0.1em] transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <Download className="h-4 w-4" />
                  {importing ? 'Importing...' : `Import ${selection.count} to My List`}
                </button>
              }
              bannerSlot={
                importResult ? (
                  <div className="border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
                    {importResult}
                  </div>
                ) : null
              }
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
