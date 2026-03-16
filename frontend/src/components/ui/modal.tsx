'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: 'default' | 'lg' | 'xl';
  children: ReactNode;
}

const sizeClasses = {
  default: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-5xl',
};

export default function Modal({ open, onClose, title, size = 'default', children }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

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
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className={`${sizeClasses[size]} w-full bg-card border-2 border-primary/30 shadow-lg animate-fade-up max-h-[90vh] flex flex-col`}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="flex items-center justify-center h-7 w-7 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
