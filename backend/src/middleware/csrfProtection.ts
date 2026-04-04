import { Request, Response, NextFunction } from 'express';

/**
 * Origin-based CSRF protection middleware.
 *
 * On state-changing methods (POST, PUT, PATCH, DELETE), validates that the
 * request's Origin (or Referer fallback) matches the server's allowed origins.
 *
 * Requests that carry custom auth headers (x-session-id, Authorization: Bearer)
 * are inherently CSRF-safe because browsers never attach custom headers to
 * cross-origin form submissions or navigations — they require XHR/fetch which
 * is already gated by CORS preflight.
 *
 * Requests with no Origin AND no Referer (server-to-server, CLI, TV apps)
 * are also allowed through since they aren't browser-initiated.
 */

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function buildAllowedOrigins(): Set<string> {
  const origins = new Set<string>();

  if (process.env.ALLOWED_ORIGINS && process.env.ALLOWED_ORIGINS !== '*') {
    for (const o of process.env.ALLOWED_ORIGINS.split(',')) {
      const trimmed = o.trim().toLowerCase();
      if (trimmed) origins.add(trimmed);
    }
  }

  // Always allow the default dev origins
  if (process.env.NODE_ENV !== 'production') {
    origins.add('http://localhost:3000');
    origins.add('http://localhost:3001');
  }

  // If APP_URL is set, allow it too
  if (process.env.APP_URL) {
    const appUrl = process.env.APP_URL.trim().toLowerCase().replace(/\/+$/, '');
    if (appUrl) origins.add(appUrl);
  }

  return origins;
}

let cachedAllowedOrigins: Set<string> | null = null;

function getAllowedOrigins(): Set<string> {
  if (!cachedAllowedOrigins) {
    cachedAllowedOrigins = buildAllowedOrigins();
  }
  return cachedAllowedOrigins;
}

function extractOrigin(headerValue: string): string | null {
  try {
    const url = new URL(headerValue);
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}

const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Safe methods don't need CSRF protection
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  // Requests with custom auth headers are CSRF-safe by definition:
  // browsers cannot send custom headers via form submissions or navigations.
  if (req.headers['x-session-id'] || req.headers['authorization']) {
    return next();
  }

  const origin = req.headers['origin'] as string | undefined;
  const referer = req.headers['referer'] as string | undefined;

  // No Origin and no Referer → not a browser request (CLI, server-to-server, TV app)
  if (!origin && !referer) {
    return next();
  }

  const allowedOrigins = getAllowedOrigins();

  // If ALLOWED_ORIGINS is '*' or no origins configured in production, skip validation
  // (the operator has explicitly opted out of origin restrictions)
  if (process.env.ALLOWED_ORIGINS === '*') {
    return next();
  }

  // If no allowed origins are configured at all (shouldn't happen but be safe)
  if (allowedOrigins.size === 0) {
    return next();
  }

  const requestOrigin = origin ? origin.toLowerCase() : extractOrigin(referer!);

  if (!requestOrigin) {
    return res.status(403).json({
      success: false,
      error: 'CSRF validation failed: unable to determine request origin',
    });
  }

  if (!allowedOrigins.has(requestOrigin)) {
    return res.status(403).json({
      success: false,
      error: 'CSRF validation failed: origin not allowed',
    });
  }

  next();
};

module.exports = { csrfProtection };
export { csrfProtection };
