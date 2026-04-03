'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: 'default' | 'lg' | 'xl';
  children: ReactNode;
  role?: 'dialog' | 'alertdialog';
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
}

const sizeClasses = {
  default: 'max-w-[calc(100vw-2rem)] sm:max-w-lg',
  lg: 'max-w-[calc(100vw-2rem)] sm:max-w-md lg:max-w-2xl',
  xl: 'max-w-[calc(100vw-2rem)] sm:max-w-lg lg:max-w-5xl',
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({
  open,
  onClose,
  title,
  size = 'default',
  children,
  role = 'dialog',
  ariaLabelledBy,
  ariaDescribedBy,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = title ? (ariaLabelledBy ?? 'modal-title') : undefined;

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement;

    const frame = requestAnimationFrame(() => {
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      firstFocusable?.focus();
    });

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
      previousFocusRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 dark:bg-background/90 backdrop-blur-sm p-2 sm:p-4 motion-reduce:backdrop-blur-none"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={ariaLabelledBy ?? titleId}
        aria-describedby={ariaDescribedBy}
        className={`${sizeClasses[size]} w-full bg-card border-2 border-primary/30 shadow-lg animate-fade-up max-h-[90vh] flex flex-col`}
      >
        {title && (
          <div className="flex items-center justify-between gap-2 px-3 sm:px-5 py-2.5 sm:py-3 border-b border-border">
            <h2
              id={titleId}
              className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground min-w-0 truncate"
            >
              {title}
            </h2>
            <button
              onClick={onClose}
              className="flex items-center justify-center h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-primary transition-colors"
              aria-label="Close dialog"
              title="Close (Esc)"
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
