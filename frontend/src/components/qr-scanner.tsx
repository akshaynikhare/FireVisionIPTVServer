'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Camera, AlertCircle } from 'lucide-react';

interface QrScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (pin: string) => void;
}

export default function QrScanner({ open, onClose, onScan }: QrScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrRef = useRef<import('html5-qrcode').Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const scannedRef = useRef(false);

  const stopScanner = useCallback(async () => {
    try {
      const scanner = html5QrRef.current;
      if (scanner?.isScanning) {
        await scanner.stop();
      }
      html5QrRef.current = null;
    } catch {
      // ignore cleanup errors
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    scannedRef.current = false;
    setError(null);
    setStarting(true);

    async function start() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');

        if (cancelled) return;

        const scannerId = 'qr-scanner-region';
        const scanner = new Html5Qrcode(scannerId);
        html5QrRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            // QR contains URL like: {server}/pair?pin=123456
            if (scannedRef.current) return;
            const match = decodedText.match(/[?&]pin=(\d{6})/);
            if (match) {
              scannedRef.current = true;
              // Stop scanner before notifying parent to prevent repeat fires
              scanner
                .stop()
                .catch(() => {})
                .finally(() => {
                  onScanRef.current(match[1]);
                });
            }
          },
          () => {
            // QR scan failure (no QR detected in frame) – ignore
          },
        );
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Camera access denied';
          setError(
            msg.includes('NotAllowedError')
              ? 'Camera permission denied. Allow camera access and try again.'
              : msg,
          );
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    }

    start();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [open, stopScanner]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={scannerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Scan QR code from TV"
        className="relative w-full max-w-sm bg-background border border-border"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium flex items-center gap-2">
            <Camera className="h-3.5 w-3.5" />
            Scan TV QR Code
          </p>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close scanner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scanner area */}
        <div className="p-4">
          <p className="text-sm text-muted-foreground mb-3">
            Point your camera at the QR code shown on your TV&apos;s pairing screen.
          </p>

          <div className="relative bg-black aspect-square w-full overflow-hidden [&_video]:!w-full [&_video]:!h-full [&_video]:!object-cover [&_#qr-shaded-region]:!border-none">
            <div id="qr-scanner-region" className="w-full h-full" />
            {starting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="text-center space-y-2">
                  <Camera className="h-8 w-8 text-muted-foreground mx-auto animate-pulse" />
                  <p className="text-xs text-muted-foreground">Starting camera…</p>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-3 px-3 py-2 text-sm border border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
