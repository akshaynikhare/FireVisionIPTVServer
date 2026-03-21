const express = require('express');
const router = express.Router();
const Channel = require('../models/Channel');
const { requireAuth, requireAdmin } = require('./auth');
const { requireTvOrSessionAuth } = require('../middleware/requireTvOrSessionAuth');
const { escapeRegex } = require('../utils/escapeRegex');
const { validateUrlForSSRF, isPrivateIP } = require('../utils/ssrf-guard');
const { audit } = require('../services/audit-log');

// In-memory rate-limit maps for stream metrics reporting
const reportStatusLimits = new Map();
const reportPlayLimits = new Map();
const healthSyncLimits = new Map();

// Cleanup stale rate-limit entries every 10 minutes
// .unref() ensures this timer doesn't prevent graceful process exit
setInterval(
  () => {
    const now = Date.now();
    for (const [key, ts] of reportStatusLimits) {
      if (now - ts > 5 * 60 * 1000) reportStatusLimits.delete(key);
    }
    for (const [key, ts] of reportPlayLimits) {
      if (now - ts > 60 * 1000) reportPlayLimits.delete(key);
    }
    for (const [key, ts] of healthSyncLimits) {
      if (now - ts > 5 * 60 * 1000) healthSyncLimits.delete(key);
    }
  },
  10 * 60 * 1000,
).unref();

// Get all channels (for Android app sync) — accepts TV code or session auth, excludes DRM keys
router.get('/', requireTvOrSessionAuth, async (req, res) => {
  try {
    const channels = await Channel.find({})
      .sort({ channelGroup: 1, order: 1 })
      .select('-__v -createdAt -updatedAt -channelDrmKey')
      .lean();

    res.json({
      success: true,
      count: channels.length,
      data: channels,
    });
  } catch (error) {
    console.error('Error fetching channels:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch channels',
    });
  }
});

// Get channels grouped by category
router.get('/grouped', requireTvOrSessionAuth, async (req, res) => {
  try {
    const channels = await Channel.find({})
      .sort({ channelGroup: 1, order: 1 })
      .select('-channelDrmKey')
      .lean();

    // Group by channelGroup
    const grouped = channels.reduce((acc, channel) => {
      const group = channel.channelGroup || 'Uncategorized';
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(channel);
      return acc;
    }, {});

    res.json({
      success: true,
      data: grouped,
    });
  } catch (error) {
    console.error('Error fetching grouped channels:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch grouped channels',
    });
  }
});

// Get M3U playlist (requires global playlist code - LEGACY ENDPOINT)
router.get('/playlist.m3u', async (req, res) => {
  try {
    const providedCode = req.query.code || req.headers['x-playlist-code'];
    const requiredCode = process.env.PLAYLIST_CODE || process.env.SUPER_ADMIN_CHANNEL_LIST_CODE;

    if (!requiredCode) {
      return res.status(500).json({ success: false, error: 'Playlist access not configured' });
    }
    if (!providedCode) {
      return res.status(401).json({ success: false, error: 'Playlist code required' });
    }
    if (providedCode !== requiredCode) {
      return res.status(403).json({ success: false, error: 'Invalid playlist code' });
    }

    const m3uContent = await Channel.generateM3UPlaylist();
    res.setHeader('Content-Type', 'application/x-mpegurl');
    res.setHeader('Content-Disposition', 'attachment; filename="playlist.m3u"');
    res.send(m3uContent);
  } catch (error) {
    console.error('Error generating M3U playlist:', error);
    res.status(500).json({ success: false, error: 'Failed to generate M3U playlist' });
  }
});

// Search channels (with regex escaping to prevent ReDoS)
router.get('/search', requireTvOrSessionAuth, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Search query is required' });
    }

    const escaped = escapeRegex(q);
    const channels = await Channel.find({
      $or: [
        { channelName: { $regex: escaped, $options: 'i' } },
        { channelGroup: { $regex: escaped, $options: 'i' } },
        { channelId: { $regex: escaped, $options: 'i' } },
      ],
    })
      .sort({ channelGroup: 1, order: 1 })
      .select('-__v -createdAt -updatedAt -channelDrmKey')
      .lean();

    res.json({ success: true, count: channels.length, data: channels });
  } catch (error) {
    console.error('Error searching channels:', error);
    res.status(500).json({ success: false, error: 'Failed to search channels' });
  }
});

// Bulk health sync from scanner/client — TV or session auth (must be BEFORE /:id to avoid route shadowing)
// Rate limit: 1 per device per 5 minutes
router.post('/health-sync', requireTvOrSessionAuth, async (req, res) => {
  try {
    const { deviceId, reports } = req.body;

    if (!deviceId || typeof deviceId !== 'string') {
      return res.status(400).json({ success: false, error: 'deviceId is required' });
    }
    if (!Array.isArray(reports) || reports.length === 0) {
      return res.status(400).json({ success: false, error: 'reports array is required' });
    }
    if (reports.length > 100) {
      return res.status(400).json({ success: false, error: 'Maximum 100 reports per sync' });
    }

    // Rate limiting
    const rateLimitKey = `health-sync:${deviceId}`;
    const lastSync = healthSyncLimits.get(rateLimitKey);
    if (lastSync && Date.now() - lastSync < 5 * 60 * 1000) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. One health sync per device per 5 minutes.',
      });
    }

    const validStatuses = ['dead', 'alive', 'unresponsive', 'played'];
    const results = { updated: 0, failed: 0, skipped: 0 };

    for (const report of reports) {
      if (!report.channelId || !report.status || !validStatuses.includes(report.status)) {
        results.skipped++;
        continue;
      }

      const update = {};
      const now = new Date();

      if (report.status === 'dead') {
        update.$inc = { 'metrics.deadCount': 1 };
        update.$set = { 'metrics.lastDeadAt': now };
      } else if (report.status === 'alive') {
        update.$inc = { 'metrics.aliveCount': 1 };
        update.$set = { 'metrics.lastAliveAt': now };
      } else if (report.status === 'unresponsive') {
        update.$inc = { 'metrics.unresponsiveCount': 1 };
        update.$set = { 'metrics.lastUnresponsiveAt': now };
      } else if (report.status === 'played') {
        update.$inc = { 'metrics.playCount': 1 };
        update.$set = { 'metrics.lastPlayedAt': now };
      }

      try {
        const result = await Channel.findByIdAndUpdate(report.channelId, update);
        if (result) {
          results.updated++;
        } else {
          results.failed++;
        }
      } catch {
        results.failed++;
      }
    }

    healthSyncLimits.set(rateLimitKey, Date.now());

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error processing health sync:', error);
    res.status(500).json({ success: false, error: 'Failed to process health sync' });
  }
});

// Get test status (must be BEFORE /:id to avoid route shadowing)
router.get('/test-status', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, isLocked: false });
  } catch (_error) {
    res.status(500).json({ success: false, error: 'Failed to check test status' });
  }
});

// Get channel by ID
router.get('/:id', requireTvOrSessionAuth, async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.id).select('-channelDrmKey').lean();
    if (!channel) {
      return res.status(404).json({ success: false, error: 'Channel not found' });
    }
    res.json({ success: true, data: channel });
  } catch (error) {
    console.error('Error fetching channel:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch channel' });
  }
});

// Create new channel (admin only, field whitelist)
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      channelId,
      channelName,
      channelUrl,
      channelImg,
      tvgLogo,
      tvgName,
      tvgId,
      channelGroup,
      channelDrmKey,
      order,
      isActive,
      metadata,
    } = req.body;

    if (channelId) {
      const existing = await Channel.findOne({ channelId });
      if (existing) {
        return res
          .status(400)
          .json({ success: false, error: 'Channel with this ID already exists' });
      }
    }

    const channel = new Channel({
      channelId,
      channelName,
      channelUrl,
      channelImg,
      tvgLogo,
      tvgName,
      tvgId,
      channelGroup,
      channelDrmKey,
      order,
      isActive,
      metadata,
    });
    await channel.save();
    audit({
      userId: req.user.id,
      action: 'create_channel',
      resource: 'channel',
      resourceId: String(channel._id),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({ success: true, data: channel });
  } catch (error) {
    console.error('Error creating channel:', error);
    res.status(500).json({ success: false, error: 'Failed to create channel' });
  }
});

// Update channel (admin only, field whitelist)
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      channelId,
      channelName,
      channelUrl,
      channelImg,
      tvgLogo,
      tvgName,
      tvgId,
      channelGroup,
      channelDrmKey,
      order,
      isActive,
      metadata,
    } = req.body;

    const allowedUpdates = {};
    if (channelId !== undefined) allowedUpdates.channelId = channelId;
    if (channelName !== undefined) allowedUpdates.channelName = channelName;
    if (channelUrl !== undefined) allowedUpdates.channelUrl = channelUrl;
    if (channelImg !== undefined) allowedUpdates.channelImg = channelImg;
    if (tvgLogo !== undefined) allowedUpdates.tvgLogo = tvgLogo;
    if (tvgName !== undefined) allowedUpdates.tvgName = tvgName;
    if (tvgId !== undefined) allowedUpdates.tvgId = tvgId;
    if (channelGroup !== undefined) allowedUpdates.channelGroup = channelGroup;
    if (channelDrmKey !== undefined) allowedUpdates.channelDrmKey = channelDrmKey;
    if (order !== undefined) allowedUpdates.order = order;
    if (isActive !== undefined) allowedUpdates.isActive = isActive;
    if (metadata !== undefined) allowedUpdates.metadata = metadata;

    const channel = await Channel.findByIdAndUpdate(
      req.params.id,
      { $set: allowedUpdates },
      { new: true, runValidators: true },
    );

    if (!channel) {
      return res.status(404).json({ success: false, error: 'Channel not found' });
    }
    audit({
      userId: req.user.id,
      action: 'update_channel',
      resource: 'channel',
      resourceId: String(channel._id),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({ success: true, data: channel });
  } catch (error) {
    console.error('Error updating channel:', error);
    res.status(500).json({ success: false, error: 'Failed to update channel' });
  }
});

// Delete channel (admin only)
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const channel = await Channel.findByIdAndDelete(req.params.id);
    if (!channel) {
      return res.status(404).json({ success: false, error: 'Channel not found' });
    }
    audit({
      userId: req.user.id,
      action: 'delete_channel',
      resource: 'channel',
      resourceId: req.params.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({ success: true, message: 'Channel deleted successfully' });
  } catch (error) {
    console.error('Error deleting channel:', error);
    res.status(500).json({ success: false, error: 'Failed to delete channel' });
  }
});

// Test channel stream (session auth only, with SSRF protection)
router.post('/:id/test', requireAuth, async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.id);
    if (!channel) {
      return res.status(404).json({ success: false, error: 'Channel not found' });
    }

    const ssrfCheck = await validateUrlForSSRF(channel.channelUrl);
    if (!ssrfCheck.safe) {
      return res
        .status(403)
        .json({ success: false, error: 'Stream URL blocked by security policy' });
    }

    const axios = require('axios');
    let isWorking = false;
    let error = null;

    try {
      const response = await axios.get(channel.channelUrl, {
        timeout: 20000,
        maxRedirects: 5,
        responseType: 'stream',
        validateStatus: (status) => status < 500,
        headers: {
          'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
          Accept: '*/*',
          'Accept-Encoding': 'gzip, deflate',
          Connection: 'keep-alive',
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
      if (response.data && typeof response.data.destroy === 'function') {
        response.data.destroy();
      }
      isWorking = response.status >= 200 && response.status < 400;
    } catch (err) {
      error = err.message;
      isWorking = false;
    }

    const now = new Date();
    const metadataUpdate = {
      'metadata.isWorking': isWorking,
      'metadata.lastTested': now,
    };
    if (error) {
      metadataUpdate['metadata.testError'] = error;
    }

    // Atomic update: metadata fields + metrics counters
    const metricsInc = isWorking ? { 'metrics.aliveCount': 1 } : { 'metrics.deadCount': 1 };
    const metricsSet = isWorking ? { 'metrics.lastAliveAt': now } : { 'metrics.lastDeadAt': now };

    const updateOp = {
      $set: { ...metadataUpdate, ...metricsSet },
      $inc: metricsInc,
    };
    if (!error) {
      updateOp.$unset = { 'metadata.testError': '' };
    }

    await Channel.findByIdAndUpdate(req.params.id, updateOp);
    audit({
      userId: req.user.id,
      action: 'test_channel',
      resource: 'channel',
      resourceId: String(channel._id),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      data: {
        channelId: channel._id,
        channelName: channel.channelName,
        isWorking,
        testedAt: now,
        error: error || undefined,
      },
    });
  } catch (error) {
    console.error('Error testing channel:', error);
    res.status(500).json({ success: false, error: 'Failed to test channel' });
  }
});

// ============ STREAM METRICS REPORTING ============

// Report stream status (dead/alive/unresponsive) — TV or session auth
// Rate limit: 1 per channel per device per 5 minutes
router.post('/:id/report-status', requireTvOrSessionAuth, async (req, res) => {
  try {
    const { status, deviceId } = req.body;

    if (!status || !['dead', 'alive', 'unresponsive'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'status must be one of: dead, alive, unresponsive',
      });
    }
    if (!deviceId || typeof deviceId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'deviceId is required',
      });
    }

    // Rate limiting
    const rateLimitKey = `${req.params.id}:${deviceId}`;
    const lastReport = reportStatusLimits.get(rateLimitKey);
    if (lastReport && Date.now() - lastReport < 5 * 60 * 1000) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. One report per channel per device per 5 minutes.',
      });
    }

    const update = {};
    const now = new Date();

    if (status === 'dead') {
      update.$inc = { 'metrics.deadCount': 1 };
      update.$set = { 'metrics.lastDeadAt': now };
    } else if (status === 'alive') {
      update.$inc = { 'metrics.aliveCount': 1 };
      update.$set = { 'metrics.lastAliveAt': now };
    } else if (status === 'unresponsive') {
      update.$inc = { 'metrics.unresponsiveCount': 1 };
      update.$set = { 'metrics.lastUnresponsiveAt': now };
    }

    const channel = await Channel.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!channel) {
      return res.status(404).json({ success: false, error: 'Channel not found' });
    }

    reportStatusLimits.set(rateLimitKey, Date.now());

    res.json({
      success: true,
      data: { channelId: channel._id, status, metrics: channel.metrics },
    });
  } catch (error) {
    console.error('Error reporting channel status:', error);
    res.status(500).json({ success: false, error: 'Failed to report channel status' });
  }
});

// Report successful playback — TV or session auth
// Rate limit: 1 per channel per device per 1 minute
router.post('/:id/report-play', requireTvOrSessionAuth, async (req, res) => {
  try {
    const { deviceId } = req.body;

    if (!deviceId || typeof deviceId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'deviceId is required',
      });
    }

    // Rate limiting
    const rateLimitKey = `${req.params.id}:${deviceId}`;
    const lastReport = reportPlayLimits.get(rateLimitKey);
    if (lastReport && Date.now() - lastReport < 60 * 1000) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. One play report per channel per device per minute.',
      });
    }

    const channel = await Channel.findByIdAndUpdate(
      req.params.id,
      {
        $inc: { 'metrics.playCount': 1 },
        $set: { 'metrics.lastPlayedAt': new Date() },
      },
      { new: true },
    );

    if (!channel) {
      return res.status(404).json({ success: false, error: 'Channel not found' });
    }

    reportPlayLimits.set(rateLimitKey, Date.now());

    res.json({
      success: true,
      data: { channelId: channel._id, metrics: channel.metrics },
    });
  } catch (error) {
    console.error('Error reporting channel play:', error);
    res.status(500).json({ success: false, error: 'Failed to report channel play' });
  }
});

module.exports = router;
