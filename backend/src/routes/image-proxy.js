const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('./auth');
const { validateUrlForSSRF } = require('../utils/ssrf-guard');
const { audit } = require('../services/audit-log');

/**
 * GET /api/v1/image-proxy
 * Validate a logo URL for safety (SSRF, protocol) then 302 redirect to the original.
 * No bytes are proxied or cached — the browser fetches directly from the origin.
 * Query params:
 *   - url: The image URL to redirect to
 */
// Allow auth via query params for browser-initiated requests (e.g. <img src="...">)
router.get(
  '/',
  (req, res, next) => {
    if (!req.headers['x-session-id'] && req.query.sid) {
      req.headers['x-session-id'] = req.query.sid;
    }
    if (!req.headers['authorization'] && req.query.token) {
      req.headers['authorization'] = `Bearer ${req.query.token}`;
    }
    next();
  },
  requireAuth,
  async (req, res) => {
    try {
      const { url } = req.query;

      if (!url) {
        return res.status(400).json({
          success: false,
          error: 'URL parameter is required',
        });
      }

      // Validate URL format
      try {
        new URL(url);
      } catch (_error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid URL format',
        });
      }

      // Block SSRF (with DNS resolution check)
      const ssrfCheck = await validateUrlForSSRF(url);
      if (!ssrfCheck.safe) {
        return res.status(403).json({
          success: false,
          error: ssrfCheck.reason,
        });
      }

      // Redirect to the original URL — browser fetches the image directly
      res.set('Cache-Control', 'public, max-age=86400'); // browsers cache the redirect for 24h
      res.set('X-Content-Type-Options', 'nosniff');
      res.redirect(302, url);
    } catch (error) {
      console.error('Image proxy error:', error.message);

      // Return a default placeholder image (1x1 transparent PNG)
      const placeholderPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
        'base64',
      );

      res.set('Content-Type', 'image/png');
      res.set('X-Content-Type-Options', 'nosniff');
      res.set('Cache-Control', 'public, max-age=300');
      res.send(placeholderPng);
    }
  },
);

/**
 * GET /api/v1/image-proxy/stats
 * Returns proxy mode info (no cache to report since we use redirect mode)
 */
router.get('/stats', requireAuth, requireAdmin, (req, res) => {
  res.json({
    success: true,
    data: {
      mode: 'redirect',
      description: 'Image proxy validates URLs and redirects to the original source. No server-side caching.',
    },
  });
});

/**
 * DELETE /api/v1/image-proxy/cache
 * No-op in redirect mode — kept for API compatibility
 */
router.delete('/cache', requireAuth, requireAdmin, (req, res) => {
  audit({
    userId: req.user.id,
    action: 'clear_image_cache',
    resource: 'image_proxy',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json({
    success: true,
    message: 'Image proxy uses redirect mode — no server-side cache to clear',
    itemsCleared: 0,
  });
});

module.exports = router;
