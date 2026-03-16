const express = require('express');
const router = express.Router();
const axios = require('axios');
const { requireAuth } = require('./auth');
const { validateUrlForSSRF } = require('../utils/ssrf-guard');

// Apply authentication
router.use(requireAuth);

/**
 * Stream Proxy - Proxies HLS streams to bypass CORS and geo-restrictions
 * GET /api/v1/stream-proxy?url=<stream_url>
 */
router.get('/', async (req, res) => {
    try {
        const { url } = req.query;

        if (!url) {
            return res.status(400).send('URL parameter is required');
        }

        // Validate URL
        let streamUrl;
        try {
            streamUrl = new URL(url);
        } catch (error) {
            return res.status(400).send('Invalid URL format');
        }

        const ssrfCheck = await validateUrlForSSRF(url);
        if (!ssrfCheck.safe) {
            return res.status(403).send(ssrfCheck.reason);
        }

        // Fetch the stream
        const response = await axios.get(url, {
            responseType: 'stream',
            timeout: 30000,
            headers: {
                'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
                'Accept': '*/*',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive'
            },
            maxRedirects: 5
        });

        // Determine if response is an HLS manifest by checking:
        // 1. Original URL contains .m3u8
        // 2. Final URL after redirects contains .m3u8
        // 3. Response content-type indicates HLS
        const finalUrl = response.request?.res?.responseUrl || response.request?.responseURL || url;
        const contentType = (response.headers['content-type'] || '').toLowerCase();
        const isManifest = url.includes('.m3u8') ||
            finalUrl.includes('.m3u8') ||
            contentType.includes('mpegurl') ||
            contentType.includes('apple.mpegurl');

        // Set CORS headers
        res.set({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Range',
            'Content-Type': isManifest ? 'application/vnd.apple.mpegurl' : (response.headers['content-type'] || 'application/octet-stream'),
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });

        // If it's a playlist (.m3u8), we need to rewrite URLs in it
        if (isManifest) {
            const MAX_MANIFEST_SIZE = 10 * 1024 * 1024; // 10 MB
            let data = '';
            let dataSize = 0;

            response.data.on('data', chunk => {
                dataSize += chunk.length;
                if (dataSize > MAX_MANIFEST_SIZE) {
                    response.data.destroy();
                    if (!res.headersSent) {
                        res.status(413).send('Manifest too large');
                    }
                    return;
                }
                data += chunk.toString();
            });

            response.data.on('end', () => {
                // Use the final URL (after redirects) as the base for resolving relative URLs
                const baseUrl = finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1);

                function resolveAndProxy(rawUrl) {
                    const trimmed = rawUrl.trim();
                    if (!trimmed || trimmed.startsWith('/api/v1/stream-proxy')) return trimmed;
                    let absolute;
                    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
                        absolute = trimmed;
                    } else if (trimmed.startsWith('/')) {
                        // Root-relative URL
                        try {
                            const parsed = new URL(finalUrl);
                            absolute = `${parsed.protocol}//${parsed.host}${trimmed}`;
                        } catch { absolute = baseUrl + trimmed; }
                    } else {
                        absolute = baseUrl + trimmed;
                    }
                    return `/api/v1/stream-proxy?url=${encodeURIComponent(absolute)}`;
                }

                const lines = data.split('\n');
                const rewrittenLines = lines.map(line => {
                    const trimmedLine = line.trim();

                    // Empty lines pass through
                    if (trimmedLine === '') return line;

                    // Rewrite URI= attributes in comment/tag lines (e.g. #EXT-X-KEY:...URI="...")
                    if (trimmedLine.startsWith('#')) {
                        return line.replace(/URI="([^"]+)"/gi, (match, uri) => {
                            return `URI="${resolveAndProxy(uri)}"`;
                        });
                    }

                    // Non-comment lines are segment/playlist URLs
                    return resolveAndProxy(trimmedLine);
                });

                res.send(rewrittenLines.join('\n'));
            });

            response.data.on('error', error => {
                console.error('Stream error:', error);
                res.status(500).send('Stream error');
            });
        } else {
            // For media segments (.ts files), just pipe them through
            response.data.pipe(res);

            response.data.on('error', error => {
                console.error('Stream error:', error);
                if (!res.headersSent) {
                    res.status(500).send('Stream error');
                }
            });
        }

    } catch (error) {
        console.error('Proxy error:', error.message);

        if (res.headersSent) return;

        if (error.response) {
            res.status(error.response.status).send(error.response.statusText);
        } else if (error.code === 'ECONNABORTED') {
            res.status(504).send('Gateway Timeout');
        } else {
            res.status(502).send('Bad Gateway');
        }
    }
});

// Handle OPTIONS for CORS preflight
router.options('/', (req, res) => {
    res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Range'
    });
    res.sendStatus(204);
});

module.exports = router;
