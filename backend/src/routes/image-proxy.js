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
const MAX_CACHE_ENTRIES = 1000;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB per image

// Cache cleanup interval
setInterval(
  () => {
    const now = Date.now();
    for (const [key, value] of imageCache.entries()) {
      if (now - value.timestamp > CACHE_TTL) {
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
router.get('/', async (req, res) => {
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
    const cacheKey = crypto.createHash('md5').update(url).digest('hex');

    // Check cache
    const cached = imageCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      res.set('Content-Type', cached.contentType);
      res.set('Cache-Control', 'public, max-age=86400'); // 24 hours
      res.set('X-Cache', 'HIT');
      return res.send(cached.data);
    }

    // Fetch image
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      maxRedirects: 5,
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
    const contentType = rawContentType.startsWith('image/')
      ? rawContentType
      : 'application/octet-stream';
    const imageData = Buffer.from(response.data);

    // Only cache if within size limits
    if (imageData.length <= MAX_IMAGE_SIZE && imageCache.size < MAX_CACHE_ENTRIES) {
      imageCache.set(cacheKey, {
        data: imageData,
        contentType: contentType,
        timestamp: Date.now(),
      });
    }

    // Send response
    res.set('Content-Type', contentType);
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
    res.set('Cache-Control', 'public, max-age=300'); // Cache errors for 5 minutes
    res.send(placeholderPng);
  }
});

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
