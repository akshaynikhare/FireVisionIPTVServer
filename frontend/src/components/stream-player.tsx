'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Minimize2, Maximize2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import api from '@/lib/api';

interface StreamPlayerChannel {
  name: string;
  url: string;
  logo?: string;
  channelId?: string;
}

interface StreamPlayerProps {
  channel: StreamPlayerChannel | null;
  onClose: () => void;
  /** 'proxy' = only use proxy (default). 'direct-fallback' = try direct first, fallback to proxy. */
  mode?: 'proxy' | 'direct-fallback';
}

export default function StreamPlayer({ channel, onClose, mode = 'proxy' }: StreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Loading...');
  const [playerError, setPlayerError] = useState('');
  const [activeSource, setActiveSource] = useState<'direct' | 'proxy'>('direct');
  const [mini, setMini] = useState(false);
  const wasActiveRef = useRef(false); // tracks if player was already open (for swap vs fresh open)
  const playReportedRef = useRef<string | null>(null);

  // Drag position for mini player
  const [position, setPosition] = useState({ right: 16, bottom: 16 });
  const dragRef = useRef<{ mouseX: number; mouseY: number; right: number; bottom: number } | null>(
    null,
  );
  const dragCleanupRef = useRef<(() => void) | null>(null);

  // Block body scroll in full mode
  useEffect(() => {
    if (!channel || mini) {
      document.body.style.overflow = '';
      return;
    }
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [channel, mini]);

  // Escape key closes in full mode
  useEffect(() => {
    if (!channel || mini) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [channel, mini, onClose]);

  // Player setup
  useEffect(() => {
    if (!channel) {
      wasActiveRef.current = false;
      return;
    }
    const url = channel.url;
    const directUrl = url;
    const proxyUrl = `/api/v1/stream-proxy?url=${encodeURIComponent(url)}`;
    const sessionId = typeof window !== 'undefined' ? useAuthStore.getState().sessionId : null;
    let destroyed = false;
    let currentSource: 'direct' | 'proxy' = mode === 'proxy' ? 'proxy' : 'direct';

    setStatus('Loading...');
    setPlayerError('');
    setActiveSource(currentSource);

    // If player was already active (swapping streams), keep mini mode & position.
    // Only reset to full modal on fresh open.
    if (!wasActiveRef.current) {
      setMini(false);
      setPosition({ right: 16, bottom: 16 });
    }
    wasActiveRef.current = true;

    // ── Video (HLS) mode ──
    const video = videoRef.current;
    if (!video) return;

    async function initPlayer() {
      try {
        const HlsModule = await import('hls.js');
        const Hls = HlsModule.default;
        if (destroyed) return;

        if (Hls.isSupported()) {
          const tryHlsSource = (src: string, isProxy: boolean) => {
            if (destroyed) return;
            hlsRef.current?.destroy();
            currentSource = isProxy ? 'proxy' : 'direct';
            setActiveSource(currentSource);
            if (isProxy && mode === 'direct-fallback') setStatus('Trying proxy...');
            setPlayerError('');

            const hls = new Hls({
              enableWorker: true,
              lowLatencyMode: true,
              backBufferLength: 90,
              maxBufferLength: 30,
              maxMaxBufferLength: 60,
              manifestLoadingTimeOut: 10000,
              manifestLoadingMaxRetry: 2,
              levelLoadingTimeOut: 10000,
              levelLoadingMaxRetry: 2,
              fragLoadingTimeOut: 20000,
              fragLoadingMaxRetry: 2,
              xhrSetup: (xhr: XMLHttpRequest, xhrUrl: string) => {
                if (xhrUrl.includes('/api/v1/stream-proxy') && sessionId) {
                  xhr.setRequestHeader('X-Session-Id', sessionId);
                }
              },
            });
            hlsRef.current = hls;
            hls.loadSource(src);
            hls.attachMedia(video!);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              if (!destroyed) {
                setStatus('Playing');
                video!.play().catch(() => {});
              }
            });
            hls.on(
              Hls.Events.ERROR,
              (_: string, data: { fatal: boolean; type: string; details: string }) => {
                if (destroyed) return;
                if (data.fatal) {
                  if (data.type === 'mediaError') {
                    setStatus('Media error — recovering...');
                    hls.recoverMediaError();
                  } else if (!isProxy && mode === 'direct-fallback') {
                    hls.destroy();
                    tryHlsSource(proxyUrl, true);
                  } else if (data.type === 'networkError' && mode === 'proxy') {
                    setStatus('Network error — retrying...');
                    hls.startLoad();
                  } else {
                    setPlayerError(`Fatal error: ${data.details}`);
                    hls.destroy();
                  }
                }
              },
            );
          };

          tryHlsSource(mode === 'proxy' ? proxyUrl : directUrl, mode === 'proxy');
        } else if (video!.canPlayType('application/vnd.apple.mpegurl')) {
          const startUrl = mode === 'proxy' ? proxyUrl : directUrl;
          currentSource = mode === 'proxy' ? 'proxy' : 'direct';
          setActiveSource(currentSource);
          video!.src = startUrl;
          let nativeFallback = false;
          video!.addEventListener('loadedmetadata', () => {
            if (!destroyed) {
              setStatus('Playing');
              video!.play().catch(() => {});
            }
          });
          video!.addEventListener('error', () => {
            if (destroyed) return;
            if (!nativeFallback && mode === 'direct-fallback') {
              nativeFallback = true;
              currentSource = 'proxy';
              setActiveSource(currentSource);
              setStatus('Trying proxy...');
              video!.src = proxyUrl;
              video!.load();
            } else {
              setPlayerError('Playback error');
            }
          });
        } else {
          setPlayerError('HLS not supported in this browser.');
        }
      } catch {
        setPlayerError('Failed to load player');
      }
    }

    initPlayer();
    const reportPlay = () => {
      if (!channel.channelId || playReportedRef.current === channel.channelId) return;
      playReportedRef.current = channel.channelId;
      const deviceId = `web-${sessionId || 'anonymous'}`;
      api
        .post(
          `/channels/${channel.channelId}/report-play`,
          { deviceId, proxyPlay: currentSource === 'proxy' },
          {
            headers: { 'X-Skip-Auth-Redirect': '1' },
          },
        )
        .catch((err) => {
          console.warn(
            '[StreamPlayer] report-play failed:',
            err.response?.status,
            err.response?.data || err.message,
          );
        });
    };
    const onPlaying = () => {
      if (destroyed) return;
      setStatus('Playing');
      reportPlay();
    };
    const onPause = () => !destroyed && setStatus('Paused');
    const onWaiting = () => !destroyed && setStatus('Buffering...');
    const onVidError = () => !destroyed && setPlayerError('Playback error');
    video.addEventListener('playing', onPlaying);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('error', onVidError);

    return () => {
      destroyed = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('error', onVidError);
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [channel, mode]);

  // Clean up drag listeners on unmount
  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  // Drag handler for mini player header
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      right: position.right,
      bottom: position.bottom,
    };

    const handleMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = dragRef.current.mouseX - ev.clientX;
      const dy = dragRef.current.mouseY - ev.clientY;
      setPosition({
        right: Math.max(0, dragRef.current.right + dx),
        bottom: Math.max(0, dragRef.current.bottom + dy),
      });
    };
    const cleanup = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      dragCleanupRef.current = null;
    };
    const handleUp = () => {
      dragRef.current = null;
      cleanup();
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    dragCleanupRef.current = cleanup;
  }, []);

  if (!channel) return null;

  const statusColor = playerError
    ? 'text-signal-red'
    : status === 'Playing'
      ? 'text-signal-green'
      : 'text-muted-foreground';

  const sourceBadge = activeSource === 'proxy' ? 'proxy' : 'direct';

  /*
   * Single return — the video/audio element is always at the same position
   * in the React tree so it is never unmounted when toggling mini mode.
   */
  return (
    <>
      {/* Backdrop overlay — only in full mode */}
      {!mini && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === overlayRef.current) onClose();
          }}
        />
      )}

      {/* Player container */}
      <div
        role="region"
        aria-label={`Stream player — ${channel.name}`}
        className={
          mini
            ? 'fixed z-[60] shadow-2xl border border-border bg-card flex flex-col overflow-hidden rounded-lg transition-[transform,box-shadow] duration-300'
            : 'fixed z-50 inset-0 flex items-center justify-center p-4 pointer-events-none'
        }
        style={
          mini
            ? {
                width: 'min(360px, calc(100vw - 32px))',
                maxWidth: 'calc(100vw - 32px)',
                right: position.right,
                bottom: position.bottom,
              }
            : undefined
        }
      >
        <div
          className={
            mini
              ? 'flex flex-col w-full'
              : 'max-w-5xl w-full bg-card border-2 border-primary/30 shadow-lg animate-fade-up max-h-[90vh] flex flex-col pointer-events-auto'
          }
        >
          {/* Header */}
          <div
            className={
              mini
                ? 'flex items-center justify-between px-3 py-1.5 bg-card border-b border-border cursor-grab active:cursor-grabbing select-none'
                : 'flex items-center justify-between px-5 py-3 border-b border-border'
            }
            onMouseDown={mini ? handleDragStart : undefined}
          >
            <h2
              className={
                mini
                  ? 'text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground truncate mr-2'
                  : 'text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground'
              }
            >
              {channel.name}
            </h2>
            <div className={`flex items-center shrink-0 ${mini ? 'gap-1' : 'gap-2'}`}>
              <button
                onClick={() => setMini(!mini)}
                className={
                  mini
                    ? 'hidden md:flex items-center justify-center h-8 w-8 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors'
                    : 'hidden md:flex items-center gap-1.5 px-2 py-1 rounded border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors'
                }
                aria-label={mini ? 'Expand' : 'Mini player'}
                title={mini ? 'Expand' : 'Mini player'}
              >
                {mini ? (
                  <Maximize2 className="h-3 w-3" />
                ) : (
                  <>
                    <Minimize2 className="h-3.5 w-3.5" />
                    <span className="uppercase tracking-[0.1em] text-xs font-medium">Mini</span>
                  </>
                )}
              </button>
              <button
                onClick={onClose}
                className={`flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors ${mini ? 'h-8 w-8' : 'h-10 w-10'}`}
                aria-label="Close"
                title="Close"
              >
                <X className={mini ? 'h-3 w-3' : 'h-4 w-4'} />
              </button>
            </div>
          </div>

          {/* Media */}
          <div className="bg-black">
            <video
              ref={videoRef}
              controls
              className={mini ? 'w-full aspect-video' : 'w-full max-h-[80vh]'}
              playsInline
            />
          </div>

          {/* Status bar */}
          <div
            className={
              mini
                ? 'flex items-center justify-between px-3 py-1 border-t border-border'
                : 'flex items-center justify-between px-5 py-2.5 border-t border-border'
            }
          >
            <div
              className={`flex items-center gap-2 truncate ${mini ? 'max-w-[55%]' : 'max-w-[60%]'}`}
            >
              {!mini && (
                <span
                  className={`truncate ${mini ? 'text-xs' : 'text-xs'} text-muted-foreground`}
                  title={channel.url}
                >
                  {channel.url}
                </span>
              )}
              {!mini && (
                <span className="text-xs uppercase tracking-wider px-1.5 py-0.5 border border-border text-muted-foreground shrink-0">
                  {sourceBadge}
                </span>
              )}
            </div>
            <span
              className={`font-medium ${mini ? 'text-xs' : 'text-xs'} ${statusColor}`}
              aria-live="polite"
              aria-atomic="true"
            >
              {playerError || status}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
