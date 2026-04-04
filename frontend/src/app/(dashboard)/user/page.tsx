'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Tv, Smartphone, Copy, Check, ChevronRight, Zap, ExternalLink } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

interface ProfileData {
  channelListCode?: string;
  channels?: string[];
  metadata?: { lastPairedDevice?: string; deviceModel?: string; pairedAt?: string };
}

export default function UserDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [channelCount, setChannelCount] = useState<number | null>(null);
  const [channelHealth, setChannelHealth] = useState<{ working: number; failing: number }>({
    working: 0,
    failing: 0,
  });
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
    const controller = new AbortController();

    async function fetchData() {
      try {
        const [profileRes, channelsRes] = await Promise.all([
          api.get('/auth/me', { signal: controller.signal }),
          api.get('/user-playlist/me/channels', { signal: controller.signal }).catch((err) => {
            if (err.name !== 'CanceledError') console.warn('Failed to load channels:', err.message);
            return null;
          }),
        ]);
        if (controller.signal.aborted) return;
        const data = profileRes.data.user || profileRes.data.data || profileRes.data;
        setProfile(data);
        if (channelsRes) {
          const body = channelsRes.data;
          const list: Array<{ metadata?: { isWorking?: boolean } }> = Array.isArray(body)
            ? body
            : body.data || body.channels || [];
          setChannelCount(list.length);
          const working = list.filter((ch) => ch.metadata?.isWorking === true).length;
          const failing = list.filter((ch) => ch.metadata?.isWorking === false).length;
          setChannelHealth({ working, failing });
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'CanceledError') return;
      }
    }

    fetchData();
    return () => controller.abort();
  }, []);

  const code = profile?.channelListCode || user?.channelListCode;
  const playlistUrl = code && origin ? `${origin}/api/v1/tv/playlist/${code}` : null;

  function handleCopy() {
    if (playlistUrl) {
      navigator.clipboard.writeText(playlistUrl).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  const quickActions = [
    {
      label: 'Quick Pick',
      desc: 'Find channels fast with guided setup',
      href: '/user/quick-pick',
      icon: Zap,
    },
    { label: 'My Channels', desc: 'Manage your channel list', href: '/user/channels', icon: Tv },
    { label: 'Pair Device', desc: 'Connect your TV app', href: '/user/devices', icon: Smartphone },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-base sm:text-lg font-display font-bold uppercase tracking-[0.1em]">
          My Dashboard
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
          Welcome back{user?.username ? `, ${user.username}` : ''}
        </p>
      </div>

      <div className="border border-border">
        <div className="grid grid-cols-3 sm:grid-cols-3">
          <div className="p-2.5 sm:p-4">
            <p className="text-[11px] sm:text-xs uppercase tracking-[0.15em] text-muted-foreground">
              Channels
            </p>
            <p className="text-lg sm:text-2xl font-display font-bold mt-0.5 sm:mt-1.5 tabular-nums">
              {channelCount !== null ? channelCount : '\u2014'}
            </p>
            <div className="flex items-center gap-1.5 mt-1 sm:mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-signal-green" aria-hidden="true" />
              <span className="text-[11px] sm:text-xs text-muted-foreground">
                {channelHealth.working} ok
              </span>
              {channelHealth.failing > 0 && (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-signal-red" aria-hidden="true" />
                  <span className="text-[11px] sm:text-xs text-muted-foreground">
                    {channelHealth.failing}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="p-2.5 sm:p-4 border-l border-border">
            <p className="text-[11px] sm:text-xs uppercase tracking-[0.15em] text-muted-foreground">
              Device
            </p>
            <p className="text-lg sm:text-2xl font-display font-bold mt-0.5 sm:mt-1.5 truncate">
              {profile?.metadata?.lastPairedDevice || '\u2014'}
            </p>
            <div className="flex items-center gap-1.5 mt-1 sm:mt-2">
              {profile?.metadata?.lastPairedDevice ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-signal-green" aria-hidden="true" />
                  <span className="text-[11px] sm:text-xs text-muted-foreground">paired</span>
                </>
              ) : (
                <>
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40"
                    aria-hidden="true"
                  />
                  <span className="text-[11px] sm:text-xs text-muted-foreground">none</span>
                </>
              )}
            </div>
          </div>
          <div className="p-2.5 sm:p-4 border-l border-border">
            <p className="text-[11px] sm:text-xs uppercase tracking-[0.15em] text-muted-foreground">
              Account
            </p>
            <p className="text-lg sm:text-2xl font-display font-bold mt-0.5 sm:mt-1.5 capitalize">
              {user?.role || '\u2014'}
            </p>
            <div className="flex items-center gap-1.5 mt-1 sm:mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-signal-green" aria-hidden="true" />
              <span className="text-[11px] sm:text-xs text-muted-foreground">active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Playlist Link */}
      <div>
        <h2 className="text-[11px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2 sm:mb-3">
          Playlist Link
        </h2>
        <div className="border border-border p-3 sm:p-4">
          {playlistUrl ? (
            <div className="space-y-2 sm:space-y-3">
              <code className="block text-[11px] sm:text-xs text-muted-foreground bg-muted px-2.5 py-1.5 sm:px-3 sm:py-2 truncate border border-border">
                {playlistUrl}
              </code>
              <div className="flex items-center gap-2">
                <a
                  href={playlistUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium uppercase tracking-[0.15em] border border-border transition-colors hover:bg-muted"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  Open M3U
                </a>
                <button
                  onClick={handleCopy}
                  aria-label="Copy to clipboard"
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium uppercase tracking-[0.15em] border border-border transition-colors hover:bg-muted"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-signal-green" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No playlist available. Add channels to your list first.
            </p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-[11px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2 sm:mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.href}
                onClick={() => router.push(action.href)}
                className="flex items-center gap-3 border border-border bg-card p-3 sm:p-4 text-left transition-colors hover:border-primary/40 group"
              >
                <div className="flex items-center justify-center h-9 w-9 bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium uppercase tracking-[0.05em]">{action.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{action.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
