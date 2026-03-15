const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');

// In-memory cache for images with size limit
const imageCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_ENTRIES = 1000;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB per image

// Cache cleanup interval
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of imageCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      imageCache.delete(key);
    }
  }
}, 60 * 60 * 1000); // Clean every hour

// Block internal/private network URLs to prevent SSRF
function isPrivateUrl(urlStr) {
    try {
        const parsed = new URL(urlStr);
        const hostname = parsed.hostname.replace(/^\[|\]$/g, ''); // strip IPv6 brackets
        if (!['http:', 'https:'].includes(parsed.protocol)) return true;
        if (['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(hostname)) return true;
        // IPv4 private ranges
        const parts = hostname.split('.').map(Number);
        if (parts.length === 4 && parts.every(p => p >= 0 && p <= 255)) {
            if (parts[0] === 10) return true;
            if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
            if (parts[0] === 192 && parts[1] === 168) return true;
            if (parts[0] === 169 && parts[1] === 254) return true;
            if (parts[0] === 127) return true;
            if (parts[0] === 0) return true;
        }
        // IPv6 private ranges (fc00::/7 ULA, fe80::/10 link-local, ::1 loopback, :: unspecified)
        const lower = hostname.toLowerCase();
        if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA
        if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true; // link-local
        if (lower === '::' || lower.startsWith('::ffff:')) return true; // unspecified or IPv4-mapped
        // Cloud metadata endpoints
        if (hostname === 'metadata.google.internal') return true;
        if (hostname === '169.254.169.254') return true;
        return false;
    } catch {
        return true;
    }
}

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
        error: 'URL parameter is required'
      });
    }

    // Validate URL format
    let imageUrl;
    try {
      imageUrl = new URL(url);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format'
      });
    }

    // Block SSRF
    if (isPrivateUrl(url)) {
      return res.status(403).json({
        success: false,
        error: 'Proxying to private/internal addresses is not allowed'
      });
    }

    // Create cache key from URL
    const cacheKey = crypto.createHash('md5').update(url).digest('hex');

    // Check cache
    const cached = imageCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
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
        'User-Agent': 'FireVision-IPTV-Server/1.0'
      }
    });

    const contentType = response.headers['content-type'] || 'image/jpeg';
    const imageData = Buffer.from(response.data);

    // Only cache if within size limits
    if (imageData.length <= MAX_IMAGE_SIZE && imageCache.size < MAX_CACHE_ENTRIES) {
      imageCache.set(cacheKey, {
        data: imageData,
        contentType: contentType,
        timestamp: Date.now()
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
      'base64'
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
router.get('/stats', (req, res) => {
  const stats = {
    cacheSize: imageCache.size,
    cacheTTL: CACHE_TTL,
    entries: Array.from(imageCache.entries()).map(([key, value]) => ({
      key,
      size: value.data.length,
      contentType: value.contentType,
      age: Date.now() - value.timestamp
    }))
  };

  res.json({
    success: true,
    data: stats
  });
});

/**
 * DELETE /api/v1/image-proxy/cache
 * Clear image cache
 */
router.delete('/cache', (req, res) => {
  const sizeBefore = imageCache.size;
  imageCache.clear();

  res.json({
    success: true,
    message: 'Image cache cleared',
    itemsCleared: sizeBefore
  });
});

module.exports = router;
