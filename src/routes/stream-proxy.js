const express = require('express');
const router = express.Router();
const axios = require('axios');
const { requireAuth } = require('./auth');

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

        console.log(`Proxying stream: ${url}`);

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

        // Set CORS headers
        res.set({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Range',
            'Content-Type': response.headers['content-type'] || 'application/vnd.apple.mpegurl',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });

        // If it's a playlist (.m3u8), we need to rewrite URLs in it
        if (url.includes('.m3u8')) {
            let data = '';

            response.data.on('data', chunk => {
                data += chunk.toString();
            });

            response.data.on('end', () => {
                // Rewrite relative URLs in the playlist to go through our proxy
                const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
                const lines = data.split('\n');
                const rewrittenLines = lines.map(line => {
                    // Skip comments and empty lines
                    if (line.startsWith('#') || line.trim() === '') {
                        return line;
                    }

                    // If it's a relative URL, make it absolute
                    if (!line.startsWith('http')) {
                        const absoluteUrl = baseUrl + line.trim();
                        // Proxy the absolute URL
                        return `/api/v1/stream-proxy?url=${encodeURIComponent(absoluteUrl)}`;
                    }

                    // If it's already absolute, proxy it
                    return `/api/v1/stream-proxy?url=${encodeURIComponent(line.trim())}`;
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

        if (error.response) {
            // Forward the error status from the upstream server
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
