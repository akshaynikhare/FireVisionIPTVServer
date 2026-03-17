const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const { requireAuth, requireAdmin } = require('./auth');
const { validateUrlForSSRF, isPrivateIP } = require('../utils/ssrf-guard');
const { audit } = require('../services/audit-log');

// In-memory cache for images with size limit
const imageCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_ENTRIES = 500;
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB per image
const MAX_CACHE_BYTES = 256 * 1024 * 1024; // 256MB total cache memory cap
let cacheBytes = 0;

// Cache cleanup interval
setInterval(
  () => {
    const now = Date.now();
    for (const [key, value] of imageCache.entries()) {
      if (now - value.timestamp > CACHE_TTL) {
        cacheBytes -= value.data.length;
        imageCache.delete(key);
      }
    }
  },
  60 * 60 * 1000,
); // Clean every hour

/**
 * GET /api/v1/image-proxy
 * Proxy and cache channel logo images
 * Query params:
 *   - url: The image URL to fetch
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

      // Create cache key from URL
      const cacheKey = crypto.createHash('sha256').update(url).digest('hex');

      // Check cache
      const cached = imageCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        res.set('Content-Type', cached.contentType);
        res.set('X-Content-Type-Options', 'nosniff');
        res.set('Cache-Control', 'public, max-age=86400'); // 24 hours
        res.set('X-Cache', 'HIT');
        return res.send(cached.data);
      }

      // Fetch image
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 10000,
        maxRedirects: 5,
        maxContentLength: 10 * 1024 * 1024,
        headers: {
          'User-Agent': 'FireVision-IPTV-Server/1.0',
        },
        beforeRedirect: (options) => {
          const hostname = (options.hostname || '').replace(/^\[|\]$/g, '');
          if (
            isPrivateIP(hostname) ||
            ['localhost', 'metadata.google.internal'].includes(hostname.toLowerCase())
          ) {
            throw new Error('Redirect to private/internal address blocked');
          }
        },
      });

      const rawContentType = response.headers['content-type'] || 'image/jpeg';
      // Validate Content-Type is an image to prevent serving HTML/JS under our origin
      if (!rawContentType.startsWith('image/')) {
        // Not an image – return placeholder instead of proxying arbitrary content
        const placeholderPng = Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
          'base64',
        );
        res.set('Content-Type', 'image/png');
        res.set('X-Content-Type-Options', 'nosniff');
        res.set('Cache-Control', 'public, max-age=300');
        return res.send(placeholderPng);
      }
      const contentType = rawContentType;
      const imageData = Buffer.from(response.data);

      // Only cache if within size limits (entry size, count, and total memory)
      if (
        imageData.length <= MAX_IMAGE_SIZE &&
        imageCache.size < MAX_CACHE_ENTRIES &&
        cacheBytes + imageData.length <= MAX_CACHE_BYTES
      ) {
        imageCache.set(cacheKey, {
          data: imageData,
          contentType: contentType,
          timestamp: Date.now(),
        });
        cacheBytes += imageData.length;
      }

      // Send response
      res.set('Content-Type', contentType);
      res.set('X-Content-Type-Options', 'nosniff');
      res.set('Cache-Control', 'public, max-age=86400');
      res.set('X-Cache', 'MISS');
      res.send(imageData);
    } catch (error) {
      console.error('Image proxy error:', error.message);

      // Return a default placeholder image (1x1 transparent PNG)
      const placeholderPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
        'base64',
      );

      res.set('Content-Type', 'image/png');
      res.set('X-Content-Type-Options', 'nosniff');
      res.set('Cache-Control', 'public, max-age=300'); // Cache errors for 5 minutes
      res.send(placeholderPng);
    }
  },
);

/**
 * GET /api/v1/image-proxy/stats
 * Get cache statistics
 */
router.get('/stats', requireAuth, requireAdmin, (req, res) => {
  const stats = {
    cacheSize: imageCache.size,
    cacheTTL: CACHE_TTL,
    entries: Array.from(imageCache.entries()).map(([key, value]) => ({
      key,
      size: value.data.length,
      contentType: value.contentType,
      age: Date.now() - value.timestamp,
    })),
  };

  res.json({
    success: true,
    data: stats,
  });
});

/**
 * DELETE /api/v1/image-proxy/cache
 * Clear image cache
 */
router.delete('/cache', requireAuth, requireAdmin, (req, res) => {
  const sizeBefore = imageCache.size;
  imageCache.clear();
  cacheBytes = 0;
  audit({
    userId: req.user.id,
    action: 'clear_image_cache',
    resource: 'image_proxy',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json({
    success: true,
    message: 'Image cache cleared',
    itemsCleared: sizeBefore,
  });
});

module.exports = router;
