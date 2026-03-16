'use client';

import { useEffect, useState, useRef } from 'react';
import { Loader2, Search, Trash2, Plus, Download, TestTube, Check, Play } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { proxyImageUrl } from '@/lib/image-proxy';
import Modal from '@/components/ui/modal';

interface Channel {
  _id: string;
  channelName?: string;
  name?: string;
  channelUrl?: string;
  url?: string;
  tvgLogo?: string;
  logo?: string;
  channelGroup?: string;
  metadata?: { isWorking?: boolean; lastTested?: string };
}

function getName(c: Channel) {
  return c.channelName || c.name || 'Unnamed';
}

function getLogo(c: Channel) {
  return c.tvgLogo || c.logo;
}

export default function UserChannelsPage() {
  const { user } = useAuthStore();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [allChannels, setAllChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [testing, setTesting] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);
  const [playerChannel, setPlayerChannel] = useState<Channel | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    fetchMyChannels();
  }, []);

  async function fetchMyChannels() {
    try {
      const res = await api.get('/user-playlist/me/channels');
      const body = res.data;
      setChannels(Array.isArray(body) ? body : body.data || body.channels || []);
    } catch {
      // empty
    } finally {
      setLoading(false);
    }
  }

  async function fetchAllChannels() {
    try {
      const res = await api.get('/channels');
      const body = res.data;
      setAllChannels(Array.isArray(body) ? body : body.data || body.channels || []);
    } catch {
      // empty
    }
  }

  async function handleAddChannels() {
    if (selectedIds.size === 0) return;
    try {
      await api.post('/user-playlist/me/channels/add', {
        channelIds: Array.from(selectedIds),
      });
      setSelectedIds(new Set());
      setShowAdd(false);
      fetchMyChannels();
    } catch {
      alert('Failed to add channels');
    }
  }

  async function handleRemove(id: string) {
    try {
      await api.post('/user-playlist/me/channels/remove', { channelIds: [id] });
      setChannels((prev) => prev.filter((c) => c._id !== id));
    } catch {
      alert('Failed to remove channel');
    }
  }

  async function handleRemoveAll() {
    if (!confirm('Remove all channels from your list?')) return;
    try {
      await api.put('/user-playlist/me/channels', { channelIds: [] });
      setChannels([]);
    } catch {
      alert('Failed to clear channels');
    }
  }

  async function handleTest(id: string) {
    setTesting(id);
    try {
      const res = await api.post(`/channels/${id}/test`);
      const result = res.data.data || res.data;
      setChannels((prev) =>
        prev.map((c) =>
          c._id === id
            ? {
                ...c,
                metadata: {
                  ...c.metadata,
                  isWorking: result.isWorking,
                  lastTested: result.testedAt,
                },
              }
            : c,
        ),
      );
    } catch {
      // ignore
    } finally {
      setTesting(null);
    }
  }

  function handleCopyM3U() {
    if (!user?.channelListCode || !origin) return;
    navigator.clipboard.writeText(`${origin}/api/v1/tv/playlist/${user.channelListCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const filtered = channels.filter(
    (c) =>
      getName(c).toLowerCase().includes(search.toLowerCase()) ||
      c.channelGroup?.toLowerCase().includes(search.toLowerCase()),
  );

  const myIds = new Set(channels.map((c) => c._id));
  const availableChannels = allChannels.filter(
    (c) =>
      !myIds.has(c._id) &&
      (getName(c).toLowerCase().includes(addSearch.toLowerCase()) ||
        c.channelGroup?.toLowerCase().includes(addSearch.toLowerCase())),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-lg font-display font-bold uppercase tracking-[0.1em]">My Channels</h1>
          <p className="text-sm text-muted-foreground mt-1">{channels.length} channels</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setShowAdd(!showAdd);
              if (!showAdd && allChannels.length === 0) fetchAllChannels();
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-primary text-primary-foreground uppercase tracking-[0.1em] transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
          {channels.length > 0 && (
            <>
              <button
                onClick={handleCopyM3U}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-2 border-border bg-card shadow-sm transition-all hover:border-primary/40 uppercase tracking-[0.1em]"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-signal-green" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                M3U
              </button>
              <button
                onClick={handleRemoveAll}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-2 border-destructive/30 bg-card shadow-sm transition-all hover:border-destructive/60 text-destructive uppercase tracking-[0.1em]"
              >
                <Trash2 className="h-4 w-4" /> Clear All
              </button>
            </>
          )}
        </div>
      </div>

      {showAdd && (
        <div className="border-2 border-primary/30 bg-card p-5 space-y-4 animate-fade-up">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
            Add Channels to Your List
          </p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search available channels..."
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-4 border border-border bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="max-h-64 overflow-y-auto border border-border divide-y divide-border">
            {availableChannels.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                {allChannels.length === 0 ? 'Loading channels...' : 'No channels available to add'}
              </div>
            ) : (
              availableChannels.slice(0, 50).map((ch) => (
                <label
                  key={ch._id}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(ch._id)}
                    onChange={(e) => {
                      const next = new Set(selectedIds);
                      if (e.target.checked) {
                        next.add(ch._id);
                      } else {
                        next.delete(ch._id);
                      }
                      setSelectedIds(next);
                    }}
                    className="accent-primary"
                  />
                  <span className="text-sm font-medium flex-1 truncate">{getName(ch)}</span>
                  <span className="text-xs text-muted-foreground">{ch.channelGroup || ''}</span>
                </label>
              ))
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleAddChannels}
              disabled={selectedIds.size === 0}
              className="px-6 py-2.5 text-sm font-medium bg-primary text-primary-foreground uppercase tracking-[0.1em] transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
            >
              Add {selectedIds.size} Channel{selectedIds.size !== 1 ? 's' : ''}
            </button>
            <button
              onClick={() => {
                setShowAdd(false);
                setSelectedIds(new Set());
              }}
              className="px-6 py-2.5 text-sm font-medium border border-border uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="relative animate-fade-up" style={{ animationDelay: '50ms' }}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search my channels..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-10 pr-4 border border-border bg-card text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      <div
        className="border border-border divide-y divide-border animate-fade-up"
        style={{ animationDelay: '100ms' }}
      >
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {search
              ? 'No channels match your search'
              : 'No channels in your list yet. Click "Add" to get started.'}
          </div>
        ) : (
          filtered.map((ch) => (
            <div key={ch._id} className="flex items-center gap-3 px-4 py-3">
              {getLogo(ch) ? (
                <img
                  src={proxyImageUrl(getLogo(ch)!)}
                  alt=""
                  className="h-7 w-7 rounded-sm object-contain shrink-0 bg-muted"
                />
              ) : (
                <div className="h-7 w-7 rounded-sm bg-muted shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{getName(ch)}</p>
                <p className="text-xs text-muted-foreground truncate">{ch.channelGroup || '—'}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {ch.metadata?.isWorking !== undefined && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${ch.metadata.isWorking ? 'bg-signal-green' : 'bg-signal-red'}`}
                  />
                )}
                <span className="text-[11px] text-muted-foreground">
                  {ch.metadata?.isWorking === true
                    ? 'Working'
                    : ch.metadata?.isWorking === false
                      ? 'Not Working'
                      : ''}
                </span>
              </div>
              <button
                onClick={() => setPlayerChannel(ch)}
                className="flex items-center justify-center h-8 w-8 text-muted-foreground hover:text-primary transition-colors"
                aria-label="Play stream"
              >
                <Play className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleTest(ch._id)}
                disabled={testing === ch._id}
                className="flex items-center justify-center h-8 w-8 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                aria-label="Test stream"
              >
                {testing === ch._id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={() => handleRemove(ch._id)}
                className="flex items-center justify-center h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                aria-label="Remove channel"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Channel Player Modal */}
      <UserChannelPlayer channel={playerChannel} onClose={() => setPlayerChannel(null)} />
    </div>
  );
}

function getChannelUrl(c: Channel) {
  return c.channelUrl || c.url || '';
}

function UserChannelPlayer({ channel, onClose }: { channel: Channel | null; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);
  const [status, setStatus] = useState('Loading...');
  const [playerError, setPlayerError] = useState('');

  useEffect(() => {
    if (!channel || !videoRef.current) return;
    const video = videoRef.current;
    const streamUrl = `/api/v1/stream-proxy?url=${encodeURIComponent(getChannelUrl(channel))}`;
    const sessionId = typeof window !== 'undefined' ? localStorage.getItem('sessionId') : null;
    let destroyed = false;

    async function initPlayer() {
      const HlsModule = await import('hls.js');
      const Hls = HlsModule.default;
      if (destroyed) return;

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          xhrSetup: (xhr: XMLHttpRequest, xhrUrl: string) => {
            if (xhrUrl.includes('/api/v1/stream-proxy') && sessionId) {
              xhr.setRequestHeader('X-Session-Id', sessionId);
            }
          },
        });
        hlsRef.current = hls;
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!destroyed) {
            setStatus('Playing');
            video.play().catch(() => {});
          }
        });
        hls.on(
          Hls.Events.ERROR,
          (_e: string, data: { fatal: boolean; type: string; details: string }) => {
            if (destroyed) return;
            if (data.fatal) {
              if (data.type === 'networkError') {
                setStatus('Retrying...');
                hls.startLoad();
              } else if (data.type === 'mediaError') {
                hls.recoverMediaError();
              } else {
                setPlayerError(`Error: ${data.details}`);
                hls.destroy();
              }
            }
          },
        );
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
        video.addEventListener('loadedmetadata', () => {
          if (!destroyed) {
            setStatus('Playing');
            video.play().catch(() => {});
          }
        });
      } else {
        setPlayerError('HLS not supported in this browser.');
      }
    }

    initPlayer();
    const onPlaying = () => !destroyed && setStatus('Playing');
    const onPause = () => !destroyed && setStatus('Paused');
    const onWaiting = () => !destroyed && setStatus('Buffering...');
    const onErr = () => !destroyed && setPlayerError('Playback error');
    video.addEventListener('playing', onPlaying);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('error', onErr);

    return () => {
      destroyed = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('error', onErr);
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [channel]);

  if (!channel) return null;

  return (
    <Modal open={!!channel} onClose={onClose} title={getName(channel)} size="xl">
      <div className="bg-black">
        <video ref={videoRef} controls className="w-full max-h-[80vh]" playsInline />
      </div>
      <div className="flex items-center justify-between px-5 py-2.5 border-t border-border">
        <span
          className="text-xs text-muted-foreground truncate max-w-[60%]"
          title={getChannelUrl(channel)}
        >
          {getChannelUrl(channel)}
        </span>
        <span
          className={`text-xs font-medium ${playerError ? 'text-signal-red' : status === 'Playing' ? 'text-signal-green' : 'text-muted-foreground'}`}
        >
          {playerError || status}
        </span>
      </div>
    </Modal>
  );
}
