import { NextResponse } from 'next/server';

// GA and Sentry are runtime-only config so self-hosters don't rebuild the image to change
// them. Reading process.env inside the root layout cannot work: every page is statically
// prerendered, so the build-time value (usually undefined) is baked into the HTML. This
// route renders per request instead, and the layout loads it before hydration.
export const dynamic = 'force-dynamic';

export async function GET() {
  const config = {
    gaId: process.env.GA_MEASUREMENT_ID || null,
    sentryDsn: process.env.FRONTEND_SENTRY_DSN || null,
  };

  return new NextResponse(
    `window.__RUNTIME_CONFIG__=${JSON.stringify(config)};` +
      `window.__SENTRY_DSN__=${JSON.stringify(config.sentryDsn || undefined)};`,
    {
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    },
  );
}
