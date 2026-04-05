import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.FRONTEND_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: !!process.env.FRONTEND_SENTRY_DSN,
});
