'use client';

import { type ReactNode, useState, useEffect } from 'react';
import { Play, Flag, ArrowUpCircle, AlertTriangle, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/modal';
import ChannelLogo from '@/components/ui/channel-logo';
import StatusDot from '@/components/ui/status-dot';
import type { AlternateStream, FlaggedBad } from '@/types';

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
    flaggedBad?: FlaggedBad;
    alternateStreams?: AlternateStream[];
  } | null;
  fields: ChannelField[];
  onPlay?: () => void;
  actions?: ReactNode;
  showRawData?: boolean;
  rawData?: Record<string, unknown>;
  onPromoteAlternate?: (index: number) => void;
  onFlagPrimary?: () => void;
  onUnflagPrimary?: () => void;
  onFlagAlternate?: (index: number) => void;
  onUnflagAlternate?: (index: number) => void;
  isAdmin?: boolean;
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
  onPromoteAlternate,
  onFlagPrimary,
  onUnflagPrimary,
  onFlagAlternate,
  onUnflagAlternate,
  isAdmin,
}: ChannelDetailModalProps) {
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [confirmPromote, setConfirmPromote] = useState<number | null>(null);

  useEffect(() => {
    setPendingAction(null);
    setConfirmPromote(null);
  }, [channel?.channelId]);

  if (!channel) return null;

  const visibleFields = fields.filter((r) => r.value);
  const alternates = channel.alternateStreams || [];
  const primaryFlagged = channel.flaggedBad?.isFlagged;

  async function withLoading(key: string, fn: () => void | Promise<void>) {
    setPendingAction(key);
    try {
      await fn();
    } finally {
      setPendingAction(null);
    }
  }

  function formatTimeAgo(date: string | Date | null | undefined) {
    if (!date) return null;
    const d = new Date(date);
    const diffMs = Date.now() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  return (
    <Modal open={open} onClose={onClose} title="Channel Details" size="lg">
      <div className="p-5 space-y-4">
        <div className="flex items-start gap-4">
          <ChannelLogo src={channel.tvgLogo} alt={`${channel.channelName} logo`} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-medium">{channel.channelName}</h3>
              {primaryFlagged && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-signal-red/10 text-signal-red border border-signal-red/30">
                  <AlertTriangle className="h-3 w-3" />
                  Flagged: {channel.flaggedBad?.reason}
                </span>
              )}
            </div>
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

        {/* Alternate Streams Section */}
        {alternates.length > 0 && (
          <div>
            <h4 className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium mb-2">
              Alternate Streams ({alternates.length})
            </h4>
            <div className="border border-border divide-y divide-border">
              {alternates.map((alt, idx) => (
                <div key={alt.streamUrl} className="flex items-center gap-2 px-3 py-2 text-xs">
                  <span className="text-[10px] font-mono text-muted-foreground/70 w-4 text-center shrink-0">
                    #{idx + 1}
                  </span>
                  <StatusDot
                    status={alt.liveness?.status || 'unknown'}
                    showLabel={false}
                    size="sm"
                  />
                  {alt.quality && (
                    <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium border border-border bg-muted/50 min-w-[40px] text-center justify-center">
                      {alt.quality}
                    </span>
                  )}
                  <span className="truncate flex-1 font-mono text-muted-foreground text-[11px]">
                    {alt.streamUrl}
                  </span>
                  {alt.liveness?.responseTimeMs != null && (
                    <span className="text-muted-foreground/70 font-mono text-[10px]">
                      {alt.liveness.responseTimeMs}ms
                    </span>
                  )}
                  {alt.liveness?.lastCheckedAt && (
                    <span
                      className="text-muted-foreground/50 font-mono text-[10px]"
                      title={new Date(alt.liveness.lastCheckedAt).toLocaleString()}
                    >
                      {formatTimeAgo(alt.liveness.lastCheckedAt)}
                    </span>
                  )}
                  {alt.flaggedBad?.isFlagged && (
                    <span className="inline-flex items-center gap-0.5 text-signal-red text-[10px]">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      {alt.flaggedBad.reason}
                    </span>
                  )}
                  <div className="flex items-center gap-1 shrink-0">
                    {onPromoteAlternate && !alt.flaggedBad?.isFlagged && (
                      <button
                        onClick={() => setConfirmPromote(idx)}
                        disabled={pendingAction === `promote-${idx}`}
                        className="flex items-center justify-center h-6 w-6 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                        title="Promote to primary"
                        aria-label={`Promote alternate stream ${idx + 1} to primary`}
                      >
                        {pendingAction === `promote-${idx}` ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ArrowUpCircle className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                    {alt.flaggedBad?.isFlagged
                      ? isAdmin &&
                        onUnflagAlternate && (
                          <button
                            onClick={() =>
                              withLoading(`unflag-${idx}`, () => onUnflagAlternate(idx))
                            }
                            disabled={pendingAction === `unflag-${idx}`}
                            className="flex items-center justify-center h-6 w-6 text-signal-red hover:text-foreground transition-colors disabled:opacity-50"
                            title="Clear flag"
                            aria-label={`Clear flag on alternate stream ${idx + 1}`}
                          >
                            {pendingAction === `unflag-${idx}` ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Flag className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )
                      : onFlagAlternate && (
                          <button
                            onClick={() => withLoading(`flag-${idx}`, () => onFlagAlternate(idx))}
                            disabled={pendingAction === `flag-${idx}`}
                            className="flex items-center justify-center h-6 w-6 text-muted-foreground hover:text-signal-red transition-colors disabled:opacity-50"
                            title="Flag as bad"
                            aria-label={`Flag alternate stream ${idx + 1} as bad`}
                          >
                            {pendingAction === `flag-${idx}` ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Flag className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                  </div>
                </div>
              ))}
            </div>

            {/* Promote confirmation dialog */}
            {confirmPromote !== null && onPromoteAlternate && (
              <div className="mt-2 p-3 border border-primary/30 bg-primary/5 text-xs space-y-2">
                <p className="text-foreground">
                  Promote alternate #{confirmPromote + 1} to primary? This changes the stream for
                  all users.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      const idx = confirmPromote;
                      setConfirmPromote(null);
                      await withLoading(`promote-${idx}`, () => onPromoteAlternate(idx));
                    }}
                    disabled={!!pendingAction}
                    className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground uppercase tracking-[0.1em] hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    Confirm Promote
                  </button>
                  <button
                    onClick={() => setConfirmPromote(null)}
                    className="px-3 py-1.5 text-xs font-medium border border-border text-muted-foreground uppercase tracking-[0.1em] hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {showRawData && rawData && (
          <details className="group">
            <summary className="text-xs uppercase tracking-[0.15em] text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors">
              Raw Data
            </summary>
            <pre className="mt-2 text-xs font-mono bg-muted border border-border p-2 sm:p-3 max-h-[300px] overflow-y-auto whitespace-pre-wrap break-all">
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
          {/* Primary stream flag/unflag */}
          {primaryFlagged
            ? isAdmin &&
              onUnflagPrimary && (
                <button
                  onClick={() => withLoading('unflag-primary', onUnflagPrimary)}
                  disabled={pendingAction === 'unflag-primary'}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-signal-red/30 text-signal-red uppercase tracking-[0.1em] hover:bg-signal-red/10 transition-colors disabled:opacity-50"
                  aria-label="Clear flag on primary stream"
                >
                  <Flag className="h-4 w-4" />
                  Clear Flag
                </button>
              )
            : onFlagPrimary && (
                <button
                  onClick={() => withLoading('flag-primary', onFlagPrimary)}
                  disabled={pendingAction === 'flag-primary'}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-border text-muted-foreground uppercase tracking-[0.1em] hover:text-signal-red hover:border-signal-red/30 transition-colors disabled:opacity-50"
                  aria-label="Flag primary stream as bad"
                >
                  <Flag className="h-4 w-4" />
                  Flag Bad Stream
                </button>
              )}
          {actions}
        </div>
      </div>
    </Modal>
  );
}
