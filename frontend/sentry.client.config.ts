import * as Sentry from '@sentry/nextjs';

declare global {
  interface Window {
    __SENTRY_DSN__?: string;
  }
}

const dsn = typeof window !== 'undefined' ? window.__SENTRY_DSN__ : undefined;

Sentry.init({
  dsn,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  enabled: !!dsn,
});
