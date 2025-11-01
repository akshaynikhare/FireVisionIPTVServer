const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');
const { URL } = require('url');
const Channel = require('../models/Channel');
const { requireAuth } = require('./auth');

// Apply authentication to all routes
router.use(requireAuth);

// Test a single channel
router.post('/test-channel', async (req, res) => {
    try {
        const { channelId } = req.body;

        if (!channelId) {
            return res.status(400).json({
                success: false,
                error: 'channelId is required'
            });
        }

        const channel = await Channel.findById(channelId);

        if (!channel) {
            return res.status(404).json({
                success: false,
                error: 'Channel not found'
            });
        }

        const result = await testChannelStream(channel.channelUrl);

        // Update channel metadata with test results
        await Channel.findByIdAndUpdate(channelId, {
            'metadata.lastTested': new Date(),
            'metadata.isWorking': result.working,
            'metadata.responseTime': result.responseTime
        });

        res.json({
            success: true,
            channel: {
                id: channel._id,
                name: channel.channelName,
                url: channel.channelUrl
            },
            ...result
        });
    } catch (error) {
        console.error('Error testing channel:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to test channel'
        });
    }
});

// Test multiple channels
router.post('/test-batch', async (req, res) => {
    try {
        const { channelIds } = req.body;

        if (!channelIds || !Array.isArray(channelIds)) {
            return res.status(400).json({
                success: false,
                error: 'channelIds array is required'
            });
        }

        const results = [];

        for (const channelId of channelIds) {
            try {
                const channel = await Channel.findById(channelId);

                if (channel) {
                    const testResult = await testChannelStream(channel.channelUrl);

                    // Update channel metadata
                    await Channel.findByIdAndUpdate(channelId, {
                        'metadata.lastTested': new Date(),
                        'metadata.isWorking': testResult.working,
                        'metadata.responseTime': testResult.responseTime
                    });

                    results.push({
                        channelId: channel._id,
                        channelName: channel.channelName,
                        ...testResult
                    });
                }
            } catch (error) {
                results.push({
                    channelId,
                    working: false,
                    error: error.message
                });
            }
        }

        res.json({
            success: true,
            tested: results.length,
            results
        });
    } catch (error) {
        console.error('Error testing channels:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to test channels'
        });
    }
});

// Test all channels (paginated)
router.post('/test-all', async (req, res) => {
    try {
        const { limit = 50, skip = 0 } = req.body;

        const channels = await Channel.find({ isActive: true })
            .limit(parseInt(limit))
            .skip(parseInt(skip));

        const results = [];

        for (const channel of channels) {
            try {
                const testResult = await testChannelStream(channel.channelUrl);
                results.push({
                    channelId: channel._id,
                    channelName: channel.channelName,
                    channelGroup: channel.channelGroup,
                    ...testResult
                });

                // Update channel status
                await Channel.findByIdAndUpdate(channel._id, {
                    'metadata.lastTested': new Date(),
                    'metadata.isWorking': testResult.working,
                    'metadata.responseTime': testResult.responseTime
                });
            } catch (error) {
                results.push({
                    channelId: channel._id,
                    channelName: channel.channelName,
                    working: false,
                    error: error.message
                });
            }
        }

        const workingCount = results.filter(r => r.working).length;

        res.json({
            success: true,
            tested: results.length,
            working: workingCount,
            notWorking: results.length - workingCount,
            results
        });
    } catch (error) {
        console.error('Error testing all channels:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to test channels'
        });
    }
});

// Helper function to test a channel stream
async function testChannelStream(url, timeout = 10000) {
    return new Promise((resolve) => {
        try {
            const parsedUrl = new URL(url);
            const protocol = parsedUrl.protocol === 'https:' ? https : http;

            const startTime = Date.now();

            const req = protocol.request(url, {
                method: 'HEAD',
                timeout: timeout
            }, (res) => {
                const responseTime = Date.now() - startTime;

                const working = res.statusCode >= 200 && res.statusCode < 400;

                resolve({
                    working,
                    statusCode: res.statusCode,
                    responseTime,
                    contentType: res.headers['content-type'],
                    message: working ? 'Stream is accessible' : `HTTP ${res.statusCode}`
                });

                req.destroy();
            });

            req.on('error', (error) => {
                const responseTime = Date.now() - startTime;
                resolve({
                    working: false,
                    statusCode: null,
                    responseTime,
                    error: error.message,
                    message: 'Stream is not accessible'
                });
            });

            req.on('timeout', () => {
                req.destroy();
                resolve({
                    working: false,
                    statusCode: null,
                    responseTime: timeout,
                    error: 'Timeout',
                    message: 'Stream request timed out'
                });
            });

            req.end();
        } catch (error) {
            resolve({
                working: false,
                statusCode: null,
                error: error.message,
                message: 'Invalid URL or request failed'
            });
        }
    });
}

module.exports = router;
