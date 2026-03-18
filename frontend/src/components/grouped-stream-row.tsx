'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Zap, Loader2 } from 'lucide-react';
import StatusDot from '@/components/ui/status-dot';

export interface GroupedStream {
  streamUrl: string;
  quality?: string | null;
  liveness?: {
    status: 'alive' | 'dead' | 'unknown';
    lastCheckedAt?: string | null;
    responseTimeMs?: number | null;
    error?: string | null;
  };
  userAgent?: string | null;
  referrer?: string | null;
  rankScore?: number;
}

interface GroupedStreamRowProps {
  streams: GroupedStream[];
  selectedStreamUrl: string;
  onSelectStream: (url: string) => void;
  onTestStream?: (stream: GroupedStream) => void;
  testingStreamUrl?: string | null;
}

export default function GroupedStreamRow({
  streams,
  selectedStreamUrl,
  onSelectStream,
  onTestStream,
  testingStreamUrl,
}: GroupedStreamRowProps) {
  const [expanded, setExpanded] = useState(false);

  if (streams.length <= 1) return null;

  return (
    <div className="border-t border-border/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <span className="font-medium">{streams.length} streams available</span>
        <span className="text-muted-foreground/60">— click to expand</span>
      </button>

      {expanded && (
        <div className="px-3 pb-2 space-y-1">
          {streams.map((stream, idx) => {
            const isSelected = stream.streamUrl === selectedStreamUrl;
            const isTesting = testingStreamUrl === stream.streamUrl;

            return (
              <div
                key={stream.streamUrl}
                className={`flex items-center gap-2 px-2 py-1.5 text-xs border transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-transparent hover:border-border'
                }`}
                onClick={() => onSelectStream(stream.streamUrl)}
              >
                <input
                  type="radio"
                  checked={isSelected}
                  onChange={() => onSelectStream(stream.streamUrl)}
                  className="accent-primary"
                  aria-label={`Select stream ${idx + 1}`}
                />

                <span className="text-muted-foreground w-4 text-center font-mono">{idx + 1}</span>

                {stream.quality ? (
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium border border-border bg-muted/50 min-w-[40px] text-center justify-center">
                    {stream.quality}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] text-muted-foreground min-w-[40px] text-center justify-center">
                    —
                  </span>
                )}

                <div className="flex items-center gap-1">
                  {isTesting ? (
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  ) : (
                    <StatusDot
                      status={stream.liveness?.status || 'unknown'}
                      showLabel={false}
                      size="sm"
                    />
                  )}
                </div>

                {stream.liveness?.responseTimeMs != null && (
                  <span className="text-muted-foreground/70 text-[10px] font-mono">
                    {stream.liveness.responseTimeMs}ms
                  </span>
                )}

                <span className="text-muted-foreground/50 truncate flex-1 font-mono text-[10px]">
                  {stream.streamUrl}
                </span>

                {onTestStream && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTestStream(stream);
                    }}
                    disabled={isTesting}
                    className="flex items-center justify-center h-5 w-5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                    title="Test this stream"
                  >
                    <Zap className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
