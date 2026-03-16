'use client';

import { useEffect, useState } from 'react';
import { Loader2, Smartphone, Copy, Check, Wifi } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

interface PairedDevice {
  name: string;
  model: string;
  pairedAt: string;
}

export default function PairDevicePage() {
  const { user } = useAuthStore();
  const [pin, setPin] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [pairedDevice, setPairedDevice] = useState<PairedDevice | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [origin, setOrigin] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const res = await api.get('/auth/me');
      const data = res.data.user || res.data.data || res.data;
      if (data.metadata?.lastPairedDevice) {
        setPairedDevice({
          name: data.metadata.lastPairedDevice,
          model: data.metadata.deviceModel || 'Unknown',
          pairedAt: data.metadata.pairedAt || '',
        });
      }
    } catch {
      // ignore
    } finally {
      setLoadingProfile(false);
    }
  }

  async function handleConfirmPin(e: React.FormEvent) {
    e.preventDefault();
    if (!pin || pin.length !== 6) return;
    setConfirming(true);
    setResult(null);

    try {
      const res = await api.post('/tv/pairing/confirm', { pin });
      const body = res.data;
      setResult({ success: true, message: body.message || 'Device paired successfully!' });
      if (body.device) {
        setPairedDevice({
          name: body.device.name,
          model: body.device.model,
          pairedAt: new Date().toISOString(),
        });
      }
      setPin('');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setResult({
        success: false,
        message:
          axiosErr.response?.data?.error ||
          'Failed to confirm pairing. Check the PIN and try again.',
      });
    } finally {
      setConfirming(false);
    }
  }

  function handleCopyCode() {
    if (!user?.channelListCode) return;
    navigator.clipboard.writeText(user.channelListCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1500);
  }

  function handleCopyUrl() {
    if (!user?.channelListCode || !origin) return;
    navigator.clipboard.writeText(`${origin}/api/v1/tv/playlist/${user.channelListCode}`);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 1500);
  }

  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-display font-bold uppercase tracking-[0.1em]">
          Pair TV Device
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Connect your Fire TV or Android TV app</p>
      </div>

      {/* PIN Confirmation */}
      <div className="border border-border">
        <div className="px-4 py-2 bg-muted/50 border-b border-border">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium">
            Enter TV PIN
          </p>
        </div>
        <div className="p-5">
          <p className="text-sm text-muted-foreground mb-4">
            Open the FireVision app on your TV. A 6-digit PIN will appear on screen. Enter it below
            to link your account.
          </p>
          <form onSubmit={handleConfirmPin} className="flex items-end gap-3">
            <div className="space-y-1.5 flex-1 max-w-xs">
              <label
                htmlFor="pairing-pin"
                className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground"
              >
                PIN Code
              </label>
              <input
                id="pairing-pin"
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="flex h-12 w-full border border-border bg-background px-4 py-2 text-2xl font-mono font-bold tracking-[0.3em] text-center focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary placeholder:text-muted-foreground/30"
              />
            </div>
            <button
              type="submit"
              disabled={confirming || pin.length !== 6}
              className="inline-flex items-center gap-2 h-12 px-6 text-sm font-medium bg-primary text-primary-foreground uppercase tracking-[0.1em] transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
            >
              {confirming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Pairing...
                </>
              ) : (
                <>
                  <Wifi className="h-4 w-4" /> Pair Device
                </>
              )}
            </button>
          </form>

          {result && (
            <div
              role="alert"
              aria-live="polite"
              className={`mt-4 px-4 py-3 text-sm border ${
                result.success
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-destructive/40 bg-destructive/10 text-destructive'
              }`}
            >
              {result.message}
            </div>
          )}
        </div>
      </div>

      {/* Channel List Code */}
      <div className="border border-border">
        <div className="px-4 py-2 bg-muted/50 border-b border-border">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium">
            Your Channel List Code
          </p>
        </div>
        <div className="p-5">
          <p className="text-sm text-muted-foreground mb-3">
            Use this code in the TV app to load your channel list directly.
          </p>
          <div className="flex items-center gap-3">
            <code className="text-2xl font-mono font-bold bg-muted px-4 py-2 tracking-[0.3em]">
              {user?.channelListCode || '------'}
            </code>
            {user?.channelListCode && (
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Copy to clipboard"
              >
                {copiedCode ? (
                  <>
                    <Check className="h-4 w-4 text-signal-green" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" /> Copy
                  </>
                )}
              </button>
            )}
          </div>

          {user?.channelListCode && origin && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium mb-2">
                M3U Playlist URL
              </p>
              <div className="flex items-center gap-3">
                <code className="flex-1 text-xs text-muted-foreground bg-muted px-3 py-2 truncate border border-border">
                  {origin}/api/v1/tv/playlist/{user.channelListCode}
                </code>
                <button
                  onClick={handleCopyUrl}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  aria-label="Copy to clipboard"
                >
                  {copiedUrl ? (
                    <>
                      <Check className="h-4 w-4 text-signal-green" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" /> Copy
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Last Paired Device */}
      <div className="border border-border">
        <div className="px-4 py-2 bg-muted/50 border-b border-border">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium">
            Last Paired Device
          </p>
        </div>
        <div className="p-5">
          {pairedDevice ? (
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center h-10 w-10 bg-primary/10 text-primary">
                <Smartphone className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">{pairedDevice.name}</p>
                <p className="text-xs text-muted-foreground">{pairedDevice.model}</p>
                {pairedDevice.pairedAt && (
                  <p className="text-xs text-muted-foreground">
                    Paired {new Date(pairedDevice.pairedAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No device paired yet. Open the FireVision app on your TV and follow the pairing
              instructions.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
