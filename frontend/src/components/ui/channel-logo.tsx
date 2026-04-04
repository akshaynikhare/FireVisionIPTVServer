'use client';

import { proxyImageUrl } from '@/lib/image-proxy';
import { isSafeImageUrl } from '@/lib/safe-url';

const SIZES = {
  sm: 'h-6 w-6',
  md: 'h-7 w-7',
  lg: 'h-16 w-16',
} as const;

interface ChannelLogoProps {
  src?: string | null;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function ChannelLogo({ src, alt, size = 'md', className = '' }: ChannelLogoProps) {
  const sizeClass = SIZES[size];
  const rounding = size === 'lg' ? 'rounded' : 'rounded-sm';

  if (!src) {
    return <div className={`${sizeClass} ${rounding} bg-muted shrink-0 ${className}`} />;
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element -- dynamic external URL with onError fallback */
    <img
      src={proxyImageUrl(src)}
      alt={alt}
      loading="lazy"
      className={`${sizeClass} ${rounding} object-contain bg-muted shrink-0 ${className}`}
      onError={(e) => {
        const img = e.currentTarget;
        if (!img.dataset.fallback && isSafeImageUrl(src)) {
          img.dataset.fallback = '1';
          img.src = src;
        }
      }}
    />
  );
}
