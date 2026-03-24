const express = require('express');
const router = express.Router();
const axios = require('axios');
const mongoose = require('mongoose');
const Channel = require('../models/Channel');
const { requireAuth, requireAdmin } = require('./auth');
const { validateUrlForSSRF, isPrivateIP } = require('../utils/ssrf-guard');
const { audit } = require('../services/audit-log');

// Apply authentication to all routes — admin only for testing operations
router.use(requireAuth);
router.use(requireAdmin);

// Lock mechanism to prevent concurrent test operations per user
const testLocks = new Map(); // sessionId -> { locked: boolean, timestamp: number }
const LOCK_TTL = 300000; // 5 minutes

// Periodic cleanup of stale locks to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, lock] of testLocks.entries()) {
    if (now - lock.timestamp > LOCK_TTL) {
      testLocks.delete(key);
    }
  }
}, 60000); // Clean every minute

// Helper functions for lock management
function acquireLock(sessionId) {
  const now = Date.now();
  const lock = testLocks.get(sessionId);

  // Clean up old locks (older than 5 minutes)
  if (lock && now - lock.timestamp > LOCK_TTL) {
    testLocks.delete(sessionId);
    return true;
  }

  // Check if already locked
  if (lock && lock.locked) {
    return false;
  }

  // Acquire lock
  testLocks.set(sessionId, { locked: true, timestamp: now });
  return true;
}

function releaseLock(sessionId) {
  testLocks.delete(sessionId);
}

// Test a single channel
router.post('/test-channel', async (req, res) => {
  try {
    const { channelId } = req.body;

    if (!channelId) {
      return res.status(400).json({
        success: false,
        error: 'channelId is required',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(channelId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid channelId format',
      });
    }

    const channel = await Channel.findById(channelId);

    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found',
      });
    }

    const result = await testChannelStream(channel.channelUrl);

    // Update channel metadata with test results
    await Channel.findByIdAndUpdate(channelId, {
      'metadata.lastTested': new Date(),
      'metadata.isWorking': result.working,
      'metadata.responseTime': result.responseTime,
    });
    audit({
      userId: req.user.id,
      action: 'test_channel',
      resource: 'channel',
      resourceId: String(channelId),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      channel: {
        id: channel._id,
        name: channel.channelName,
        url: channel.channelUrl,
      },
      ...result,
    });
  } catch (error) {
    console.error('Error testing channel:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test channel',
    });
  }
});

// Test multiple channels
router.post('/test-batch', async (req, res) => {
  const sessionId = req.sessionId || req.headers['x-session-id'];

  try {
    let { channelIds } = req.body;

    if (!channelIds || !Array.isArray(channelIds)) {
      return res.status(400).json({
        success: false,
        error: 'channelIds array is required',
      });
    }

    // Cap batch size to prevent abuse
    channelIds = channelIds.slice(0, 200);

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required for batch operations',
      });
    }

    // Try to acquire lock
    if (!acquireLock(sessionId)) {
      return res.status(409).json({
        success: false,
        error: 'Another test operation is already in progress. Please wait for it to complete.',
      });
    }

    const results = [];

    try {
      for (const channelId of channelIds) {
        try {
          const channel = await Channel.findById(channelId);

          if (channel) {
            const testResult = await testChannelStream(channel.channelUrl);

            // Update channel metadata
            await Channel.findByIdAndUpdate(channelId, {
              'metadata.lastTested': new Date(),
              'metadata.isWorking': testResult.working,
              'metadata.responseTime': testResult.responseTime,
            });

            results.push({
              channelId: channel._id,
              channelName: channel.channelName,
              ...testResult,
            });
          }
        } catch (error) {
          results.push({
            channelId,
            working: false,
            error: error.message,
          });
        }
      }

      audit({
        userId: req.user.id,
        action: 'test_channel_batch',
        resource: 'channel',
        resourceId: `${results.length} channels`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      res.json({
        success: true,
        tested: results.length,
        results,
      });
    } finally {
      // Always release lock when done
      releaseLock(sessionId);
    }
  } catch (error) {
    console.error('Error testing channels:', error);
    releaseLock(sessionId);
    res.status(500).json({
      success: false,
      error: 'Failed to test channels',
    });
  }
});

// Test all channels (paginated)
router.post('/test-all', async (req, res) => {
  const sessionId = req.sessionId || req.headers['x-session-id'];

  try {
    const { limit = 50, skip = 0 } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required for batch operations',
      });
    }

    // Try to acquire lock
    if (!acquireLock(sessionId)) {
      return res.status(409).json({
        success: false,
        error: 'Another test operation is already in progress. Please wait for it to complete.',
      });
    }

    const channels = await Channel.find({})
      .limit(Math.min(parseInt(limit, 10) || 50, 200))
      .skip(parseInt(skip, 10) || 0);

    const results = [];

    try {
      for (const channel of channels) {
        try {
          const testResult = await testChannelStream(channel.channelUrl);
          results.push({
            channelId: channel._id,
            channelName: channel.channelName,
            channelGroup: channel.channelGroup,
            ...testResult,
          });

          // Update channel status
          await Channel.findByIdAndUpdate(channel._id, {
            'metadata.lastTested': new Date(),
            'metadata.isWorking': testResult.working,
            'metadata.responseTime': testResult.responseTime,
          });
        } catch (error) {
          results.push({
            channelId: channel._id,
            channelName: channel.channelName,
            working: false,
            error: error.message,
          });
        }
      }

      const workingCount = results.filter((r) => r.working).length;
      audit({
        userId: req.user.id,
        action: 'test_channel_all',
        resource: 'channel',
        resourceId: `${results.length} channels`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        tested: results.length,
        working: workingCount,
        notWorking: results.length - workingCount,
        results,
      });
    } finally {
      // Always release lock when done
      releaseLock(sessionId);
    }
  } catch (error) {
    console.error('Error testing all channels:', error);
    releaseLock(sessionId);
    res.status(500).json({
      success: false,
      error: 'Failed to test channels',
    });
  }
});

// Helper function to test a channel stream
async function testChannelStream(url, timeout = 15000) {
  const startTime = Date.now();

  // SSRF protection
  const ssrfCheck = await validateUrlForSSRF(url);
  if (!ssrfCheck.safe) {
    return {
      working: false,
      statusCode: null,
      responseTime: Date.now() - startTime,
      error: `Blocked: ${ssrfCheck.reason}`,
      message: 'Stream URL blocked by security policy',
    };
  }

  try {
    const response = await axios.get(url, {
      timeout: timeout,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 500,
      headers: {
        'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
        Accept: '*/*',
        'Accept-Encoding': 'gzip, deflate',
        Connection: 'keep-alive',
      },
      maxContentLength: url.includes('.m3u8') ? 10240 : 1024,
      responseType: url.includes('.m3u8') ? 'text' : 'stream',
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

    const responseTime = Date.now() - startTime;
    const statusCode = response.status;
    const working = statusCode >= 200 && statusCode < 400;

    // For m3u8 files, validate the manifest content
    let manifestValid = true;
    let manifestInfo = {};

    if (url.includes('.m3u8') && response.data) {
      const manifest = response.data.toString();
      manifestValid = manifest.includes('#EXTM3U') || manifest.includes('#EXT-X-');

      // Extract some basic info from manifest
      if (manifestValid) {
        manifestInfo = {
          isLive: manifest.includes('#EXT-X-PLAYLIST-TYPE') === false,
          hasVideo: manifest.includes('#EXTINF') || manifest.includes('#EXT-X-STREAM-INF'),
          segmentCount: (manifest.match(/#EXTINF/g) || []).length,
        };
      }
    }

    // Cleanup stream response if needed
    if (response.data && typeof response.data.destroy === 'function') {
      response.data.destroy();
    }

    return {
      working: working && manifestValid,
      statusCode: statusCode,
      responseTime: responseTime,
      contentType: response.headers['content-type'],
      manifestValid: url.includes('.m3u8') ? manifestValid : undefined,
      manifestInfo: url.includes('.m3u8') ? manifestInfo : undefined,
      message:
        working && manifestValid
          ? 'Stream is accessible and valid'
          : !working
            ? `HTTP ${statusCode}`
            : 'Invalid manifest format',
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    // Determine error type
    let errorType = 'Unknown error';
    let statusCode = null;

    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      errorType = 'Timeout - Stream took too long to respond';
    } else if (error.code === 'ENOTFOUND') {
      errorType = 'DNS resolution failed - Host not found';
    } else if (error.code === 'ECONNREFUSED') {
      errorType = 'Connection refused - Stream server is down';
    } else if (error.response) {
      statusCode = error.response.status;
      errorType = `HTTP ${statusCode} - ${error.response.statusText || 'Error'}`;
    } else if (error.code) {
      errorType = `${error.code} - ${error.message}`;
    } else {
      errorType = error.message || 'Unknown error';
    }

    return {
      working: false,
      statusCode: statusCode,
      responseTime: responseTime,
      error: errorType,
      message: 'Stream is not accessible',
    };
  }
}

module.exports = router;
