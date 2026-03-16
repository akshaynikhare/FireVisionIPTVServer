'use client';

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextIdRef = useRef(0);
  const timersRef = useRef<
    Map<number, { timerId: ReturnType<typeof setTimeout>; remaining: number; startedAt: number }>
  >(new Map());

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    timersRef.current.delete(id);
  }, []);

  const startTimer = useCallback(
    (id: number, delay: number) => {
      const timerId = setTimeout(() => {
        removeToast(id);
      }, delay);
      timersRef.current.set(id, { timerId, remaining: delay, startedAt: Date.now() });
    },
    [removeToast],
  );

  const pauseTimer = useCallback((id: number) => {
    const entry = timersRef.current.get(id);
    if (entry) {
      clearTimeout(entry.timerId);
      const elapsed = Date.now() - entry.startedAt;
      entry.remaining = Math.max(entry.remaining - elapsed, 0);
    }
  }, []);

  const resumeTimer = useCallback(
    (id: number) => {
      const entry = timersRef.current.get(id);
      if (entry) {
        startTimer(id, entry.remaining);
      }
    },
    [startTimer],
  );

  const toast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = nextIdRef.current++;
      setToasts((prev) => [...prev, { id, message, type }]);
      startTimer(id, 3500);
    },
    [startTimer],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
          {toasts.map((t) => (
            <div
              key={t.id}
              role="alert"
              aria-live={t.type === 'error' ? 'assertive' : 'polite'}
              aria-atomic="true"
              className={`flex items-start gap-2 px-4 py-3 text-sm border shadow-lg animate-fade-up ${
                t.type === 'error'
                  ? 'bg-destructive/10 border-destructive/40 text-destructive'
                  : t.type === 'success'
                    ? 'bg-signal-green/10 border-signal-green/40 text-signal-green'
                    : 'bg-card border-border text-foreground'
              }`}
              onMouseEnter={() => pauseTimer(t.id)}
              onMouseLeave={() => resumeTimer(t.id)}
              onFocus={() => pauseTimer(t.id)}
              onBlur={() => resumeTimer(t.id)}
            >
              <span className="flex-1">{t.message}</span>
              <button
                onClick={() => removeToast(t.id)}
                className="shrink-0 p-2.5 hover:opacity-70 transition-opacity"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
