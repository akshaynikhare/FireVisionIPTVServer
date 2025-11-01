const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');

// In-memory cache for images (in production, use Redis or similar)
const imageCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Cache cleanup interval
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of imageCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      imageCache.delete(key);
    }
  }
}, 60 * 60 * 1000); // Clean every hour

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

    // Store in cache
    imageCache.set(cacheKey, {
      data: imageData,
      contentType: contentType,
      timestamp: Date.now()
    });

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
