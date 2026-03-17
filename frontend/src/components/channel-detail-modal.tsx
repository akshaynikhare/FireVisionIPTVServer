'use client';

import { type ReactNode } from 'react';
import { Play } from 'lucide-react';
import Modal from '@/components/ui/modal';
import ChannelLogo from '@/components/ui/channel-logo';

export interface ChannelField {
  label: string;
  value?: string | null;
}

interface ChannelDetailModalProps {
  open: boolean;
  onClose: () => void;
  channel: {
    channelName: string;
    channelId?: string;
    tvgLogo?: string;
    channelUrl?: string;
    summary?: string;
  } | null;
  fields: ChannelField[];
  onPlay?: () => void;
  actions?: ReactNode;
  showRawData?: boolean;
  rawData?: Record<string, unknown>;
}

export default function ChannelDetailModal({
  open,
  onClose,
  channel,
  fields,
  onPlay,
  actions,
  showRawData,
  rawData,
}: ChannelDetailModalProps) {
  if (!channel) return null;

  const visibleFields = fields.filter((r) => r.value);

  return (
    <Modal open={open} onClose={onClose} title="Channel Details" size="lg">
      <div className="p-5 space-y-4">
        <div className="flex items-start gap-4">
          <ChannelLogo src={channel.tvgLogo} alt={`${channel.channelName} logo`} size="lg" />
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-medium">{channel.channelName}</h3>
            {channel.channelId && (
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{channel.channelId}</p>
            )}
            {channel.summary && (
              <p className="text-sm text-muted-foreground mt-1">{channel.summary}</p>
            )}
          </div>
        </div>

        {visibleFields.length > 0 && (
          <div className="divide-y divide-border border border-border">
            {visibleFields.map((r) => (
              <div key={r.label} className="flex items-start justify-between gap-4 px-4 py-2.5">
                <span className="text-sm text-muted-foreground shrink-0">{r.label}</span>
                <span className="text-sm font-medium text-right break-all max-w-[65%]">
                  {r.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {showRawData && rawData && (
          <details className="group">
            <summary className="text-xs uppercase tracking-[0.15em] text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors">
              Raw Data
            </summary>
            <pre className="mt-2 text-xs font-mono bg-muted border border-border p-3 overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre-wrap break-all">
              {JSON.stringify(rawData, null, 2)}
            </pre>
          </details>
        )}

        <div className="flex items-center gap-3 pt-2">
          {onPlay && channel.channelUrl && (
            <button
              onClick={onPlay}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-primary-foreground uppercase tracking-[0.1em] transition-colors hover:bg-primary/90"
            >
              <Play className="h-4 w-4" />
              Preview Stream
            </button>
          )}
          {actions}
        </div>
      </div>
    </Modal>
  );
}
