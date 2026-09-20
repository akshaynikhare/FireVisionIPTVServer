'use client';

import { useEffect, useState } from 'react';
import { GoogleAnalytics } from '@next/third-parties/google';

// gaId only exists once /runtime-config.js has run, which is after the static HTML is
// rendered — so mount GA on the client rather than reading process.env during prerender.
export function AnalyticsBootstrap() {
  const [gaId, setGaId] = useState<string | null>(null);

  useEffect(() => {
    setGaId(window.__RUNTIME_CONFIG__?.gaId || null);
  }, []);

  if (!gaId) return null;
  return <GoogleAnalytics gaId={gaId} />;
}
