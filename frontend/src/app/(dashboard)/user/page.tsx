'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';

export default function UserDashboard() {
  const { user } = useAuthStore();
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const playlistUrl =
    user?.channelListCode && origin
      ? `${origin}/api/v1/channels/playlist/${user.channelListCode}`
      : null;

  function handleCopy() {
    if (playlistUrl) {
      navigator.clipboard.writeText(playlistUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="space-y-8">
      <div className="animate-fade-up">
        <h1 className="text-lg font-display font-bold uppercase tracking-[0.1em]">My Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Your channels, devices, and account</p>
      </div>

      <div className="border border-border animate-fade-up" style={{ animationDelay: '50ms' }}>
        <div className="grid grid-cols-1 sm:grid-cols-3">
          {[
            { label: 'My Channels', value: '\u2014', status: 'assigned' },
            { label: 'My Devices', value: '\u2014', status: 'registered' },
            { label: 'Account', value: user?.role || '\u2014', status: 'active' },
          ].map((metric, i) => (
            <div
              key={metric.label}
              className={`p-4 ${i > 0 ? 'border-t sm:border-t-0 sm:border-l border-border' : ''}`}
            >
              <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                {metric.label}
              </p>
              <p className="text-2xl font-display font-bold mt-1.5 tabular-nums">{metric.value}</p>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-signal-green" />
                <span className="text-[11px] text-muted-foreground capitalize">
                  {metric.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="animate-fade-up" style={{ animationDelay: '100ms' }}>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
          Playlist Link
        </p>
        <div className="border border-border p-4">
          {playlistUrl ? (
            <div className="flex items-center gap-3">
              <code className="flex-1 text-xs text-muted-foreground bg-secondary px-3 py-2 truncate border border-border">
                {playlistUrl}
              </code>
              <button
                onClick={handleCopy}
                className={`px-4 py-2 text-xs font-medium uppercase tracking-[0.15em] border border-border transition-colors shrink-0 ${
                  copied ? 'text-signal-green border-signal-green/30' : 'hover:bg-secondary'
                }`}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No playlist assigned. Contact your administrator.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
