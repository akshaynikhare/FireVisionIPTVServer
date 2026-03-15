'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Tv, Smartphone, Copy, Check, ChevronRight } from 'lucide-react';
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
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [profileRes, channelsRes] = await Promise.all([
        api.get('/auth/me'),
        api.get('/user-playlist/me/channels').catch(() => null),
      ]);
      const data = profileRes.data.user || profileRes.data.data || profileRes.data;
      setProfile(data);
      if (channelsRes) {
        const body = channelsRes.data;
        const list = Array.isArray(body) ? body : body.data || body.channels || [];
        setChannelCount(list.length);
      }
    } catch {
      // ignore
    }
  }

  const code = profile?.channelListCode || user?.channelListCode;
  const playlistUrl = code && origin ? `${origin}/api/v1/tv/playlist/${code}` : null;

  function handleCopy() {
    if (playlistUrl) {
      navigator.clipboard.writeText(playlistUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  const quickActions = [
    { label: 'My Channels', desc: 'Manage your channel list', href: '/user/channels', icon: Tv },
    { label: 'Pair Device', desc: 'Connect your TV app', href: '/user/devices', icon: Smartphone },
  ];

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-lg font-display font-bold uppercase tracking-[0.1em]">My Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Welcome back{user?.username ? `, ${user.username}` : ''}
        </p>
      </div>

      <div className="border border-border animate-fade-up" style={{ animationDelay: '50ms' }}>
        <div className="grid grid-cols-1 sm:grid-cols-3">
          <div className="p-4">
            <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
              My Channels
            </p>
            <p className="text-2xl font-display font-bold mt-1.5 tabular-nums">
              {channelCount !== null ? channelCount : '\u2014'}
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-signal-green" />
              <span className="text-[11px] text-muted-foreground">assigned</span>
            </div>
          </div>
          <div className="p-4 border-t sm:border-t-0 sm:border-l border-border">
            <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
              Last Device
            </p>
            <p className="text-2xl font-display font-bold mt-1.5 truncate">
              {profile?.metadata?.lastPairedDevice || '\u2014'}
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              {profile?.metadata?.lastPairedDevice ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-signal-green" />
                  <span className="text-[11px] text-muted-foreground">paired</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                  <span className="text-[11px] text-muted-foreground">not paired</span>
                </>
              )}
            </div>
          </div>
          <div className="p-4 border-t sm:border-t-0 sm:border-l border-border">
            <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Account</p>
            <p className="text-2xl font-display font-bold mt-1.5">{user?.role || '\u2014'}</p>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-signal-green" />
              <span className="text-[11px] text-muted-foreground">active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Playlist Link */}
      <div className="animate-fade-up" style={{ animationDelay: '100ms' }}>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
          Playlist Link
        </p>
        <div className="border border-border p-4">
          {playlistUrl ? (
            <div className="flex items-center gap-3">
              <code className="flex-1 text-xs text-muted-foreground bg-muted px-3 py-2 truncate border border-border">
                {playlistUrl}
              </code>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium uppercase tracking-[0.15em] border border-border transition-colors shrink-0 hover:bg-muted"
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
          ) : (
            <p className="text-sm text-muted-foreground">
              No playlist available. Add channels to your list first.
            </p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="animate-fade-up" style={{ animationDelay: '150ms' }}>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
          Quick Actions
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.href}
                onClick={() => router.push(action.href)}
                className="flex items-center gap-3 border-2 border-border bg-card p-4 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md group"
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
