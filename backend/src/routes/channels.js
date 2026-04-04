const express = require('express');
const router = express.Router();
const Channel = require('../models/Channel');
const { requireAuth, requireAdmin } = require('./auth');
const { requireTvOrSessionAuth } = require('../middleware/requireTvOrSessionAuth');
const { escapeRegex } = require('../utils/escapeRegex');
const { validateUrlForSSRF, isPrivateIP, createPinnedLookup } = require('../utils/ssrf-guard');
const { audit } = require('../services/audit-log');

// In-memory rate-limit maps for stream metrics reporting
const reportStatusLimits = new Map();
const reportPlayLimits = new Map();
const healthSyncLimits = new Map();
const flagLimits = new Map();

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
    for (const [key, ts] of flagLimits) {
      if (now - ts > 60 * 1000) flagLimits.delete(key);
    }
    // Cap map sizes to prevent unbounded growth between cleanups
    if (reportStatusLimits.size > 50000) reportStatusLimits.clear();
    if (reportPlayLimits.size > 50000) reportPlayLimits.clear();
    if (healthSyncLimits.size > 50000) healthSyncLimits.clear();
    if (flagLimits.size > 50000) flagLimits.clear();
  },
  10 * 60 * 1000,
).unref();

// Filter alternateStreams to viable entries for client consumption.
// Keeps full objects (liveness, flaggedBad, etc.) so web frontend can display rich details.
function slimAlternates(channel) {
  if (!channel.alternateStreams?.length) return channel;
  channel.alternateStreams = channel.alternateStreams
    .filter((alt) => alt.liveness?.status !== 'dead' && alt.flaggedBad?.isFlagged !== true)
    .slice(0, 10);
  return channel;
}

// Get channels (for Android app sync) — accepts TV code or session auth, excludes DRM keys
router.get('/', requireTvOrSessionAuth, async (req, res) => {
  try {
    const query =
      req.user.role === 'Admin'
        ? {}
        : { _id: { $in: (req.user.channels || []).filter(Boolean) }, isActive: { $ne: false } };

    const channels = await Channel.find(query)
      .sort({ channelGroup: 1, order: 1 })
      .select('-__v -createdAt -updatedAt -channelDrmKey')
      .lean();

    res.json({
      success: true,
      count: channels.length,
      data: channels.map(slimAlternates),
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
    const query =
      req.user.role === 'Admin'
        ? {}
        : { _id: { $in: (req.user.channels || []).filter(Boolean) }, isActive: { $ne: false } };

    const channels = await Channel.find(query)
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
    if (q.length > 500) {
      return res
        .status(400)
        .json({ success: false, error: 'Search query too long (max 500 characters)' });
    }

    const escaped = escapeRegex(q);
    const searchFilter = {
      $or: [
        { channelName: { $regex: escaped, $options: 'i' } },
        { channelGroup: { $regex: escaped, $options: 'i' } },
        { channelId: { $regex: escaped, $options: 'i' } },
      ],
    };

    if (req.user.role !== 'Admin') {
      searchFilter._id = { $in: (req.user.channels || []).filter(Boolean) };
      searchFilter.isActive = { $ne: false };
    }

    const channels = await Channel.find(searchFilter)
      .sort({ channelGroup: 1, order: 1 })
      .select('-__v -createdAt -updatedAt -channelDrmKey')
      .lean();

    res.json({ success: true, count: channels.length, data: channels.map(slimAlternates) });
  } catch (error) {
    console.error('Error searching channels:', error);
    res.status(500).json({ success: false, error: 'Failed to search channels' });
  }
});

// Bulk health sync from scanner/client — TV or session auth (must be BEFORE /:id to avoid route shadowing)
// Rate limit: 1 per device per 5 minutes
router.post('/health-sync', requireTvOrSessionAuth, async (req, res) => {
  try {
    const { deviceId, reports: reportsRaw, results: resultsRaw } = req.body;
    // Android app sends "results", web may send "reports" — accept both
    const reports = reportsRaw || resultsRaw;

    if (!deviceId || typeof deviceId !== 'string') {
      return res.status(400).json({ success: false, error: 'deviceId is required' });
    }
    if (!Array.isArray(reports) || reports.length === 0) {
      return res.status(400).json({ success: false, error: 'reports array is required' });
    }
    if (reports.length > 100) {
      return res.status(400).json({ success: false, error: 'Maximum 100 reports per sync' });
    }

    // Rate limiting — key by authenticated user + device to prevent spoofing
    const userId = req.user?.id?.toString() || 'anon';
    const rateLimitKey = `health-sync:${userId}:${deviceId}`;
    const lastSync = healthSyncLimits.get(rateLimitKey);
    if (lastSync && Date.now() - lastSync < 5 * 60 * 1000) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. One health sync per device per 5 minutes.',
      });
    }

    // Pre-validate that reported channel IDs exist in the database
    const reportedIds = [
      ...new Set(reports.map((r) => r.channelId).filter((id) => id && typeof id === 'string')),
    ];
    const existingChannels = await Channel.find({ _id: { $in: reportedIds } }, { _id: 1 }).lean();
    const validChannelIds = new Set(existingChannels.map((c) => c._id.toString()));

    const validStatuses = ['dead', 'alive', 'unresponsive', 'played'];
    const results = { updated: 0, failed: 0, skipped: 0 };

    for (const report of reports) {
      if (!report.channelId || !report.status || !validStatuses.includes(report.status)) {
        results.skipped++;
        continue;
      }
      if (!validChannelIds.has(report.channelId.toString())) {
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
  } catch {
    res.status(500).json({ success: false, error: 'Failed to check test status' });
  }
});

// Get channel by ID
router.get('/:id', requireTvOrSessionAuth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      const userChannelIds = (req.user.channels || []).map((id) => id.toString());
      if (!userChannelIds.includes(req.params.id)) {
        return res.status(404).json({ success: false, error: 'Channel not found' });
      }
    }

    const channel = await Channel.findById(req.params.id).select('-channelDrmKey').lean();
    if (!channel) {
      return res.status(404).json({ success: false, error: 'Channel not found' });
    }
    res.json({ success: true, data: slimAlternates(channel) });
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
      alternateStreams,
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
      alternateStreams,
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
      alternateStreams,
      flaggedBad,
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
    if (alternateStreams !== undefined) allowedUpdates.alternateStreams = alternateStreams;
    if (flaggedBad !== undefined) allowedUpdates.flaggedBad = flaggedBad;

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

// Get channel with filtered fallback streams (for Android app)
router.get('/:id/with-fallbacks', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      const userChannelIds = (req.user.channels || []).map((id) => id.toString());
      if (!userChannelIds.includes(req.params.id)) {
        return res.status(404).json({ success: false, error: 'Channel not found' });
      }
    }

    const channel = await Channel.findById(req.params.id).select('-channelDrmKey').lean();
    if (!channel) {
      return res.status(404).json({ success: false, error: 'Channel not found' });
    }

    // Filter alternates: only alive + non-flagged, sorted by ranking
    const viableAlternates = (channel.alternateStreams || [])
      .filter((alt) => alt.liveness?.status !== 'dead' && alt.flaggedBad?.isFlagged !== true)
      .sort((a, b) => {
        const scoreA = getStreamScore(a);
        const scoreB = getStreamScore(b);
        return scoreB - scoreA;
      });

    channel.alternateStreams = viableAlternates;
    res.json({ success: true, data: channel });
  } catch (error) {
    console.error('Error fetching channel with fallbacks:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch channel' });
  }
});

// Flag primary stream as bad (any authenticated user, rate-limited: 1 per channel per user per minute)
router.post('/:id/flag', requireAuth, async (req, res) => {
  try {
    const flagKey = `${req.user.id}:${req.params.id}:primary`;
    if (flagLimits.has(flagKey)) {
      return res.status(429).json({ success: false, error: 'Please wait before flagging again' });
    }

    const { reason } = req.body;
    const validReasons = ['looping', 'frozen', 'wrong-content', 'other'];
    if (!reason || !validReasons.includes(reason)) {
      return res
        .status(400)
        .json({ success: false, error: `Reason must be one of: ${validReasons.join(', ')}` });
    }

    const channel = await Channel.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          'flaggedBad.isFlagged': true,
          'flaggedBad.reason': reason,
          'flaggedBad.flaggedBy': req.user.id,
          'flaggedBad.flaggedAt': new Date(),
        },
      },
      { new: true },
    );

    if (!channel) {
      return res.status(404).json({ success: false, error: 'Channel not found' });
    }

    flagLimits.set(flagKey, Date.now());

    audit({
      userId: req.user.id,
      action: 'flag_channel',
      resource: 'channel',
      resourceId: req.params.id,
      details: { reason },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, message: 'Stream flagged as bad' });
  } catch (error) {
    console.error('Error flagging channel:', error);
    res.status(500).json({ success: false, error: 'Failed to flag channel' });
  }
});

// Unflag primary stream (admin only)
router.post('/:id/unflag', requireAuth, requireAdmin, async (req, res) => {
  try {
    const channel = await Channel.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          'flaggedBad.isFlagged': false,
          'flaggedBad.reason': null,
          'flaggedBad.flaggedBy': null,
          'flaggedBad.flaggedAt': null,
        },
      },
      { new: true },
    );

    if (!channel) {
      return res.status(404).json({ success: false, error: 'Channel not found' });
    }

    audit({
      userId: req.user.id,
      action: 'unflag_channel',
      resource: 'channel',
      resourceId: req.params.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, message: 'Stream flag cleared' });
  } catch (error) {
    console.error('Error unflagging channel:', error);
    res.status(500).json({ success: false, error: 'Failed to unflag channel' });
  }
});

// Flag an alternate stream as bad (any authenticated user, rate-limited)
router.post('/:id/alternates/:index/flag', requireAuth, async (req, res) => {
  try {
    const { reason } = req.body;
    const index = parseInt(req.params.index, 10);
    const flagKey = `${req.user.id}:${req.params.id}:alt${index}`;
    if (flagLimits.has(flagKey)) {
      return res.status(429).json({ success: false, error: 'Please wait before flagging again' });
    }

    const validReasons = ['looping', 'frozen', 'wrong-content', 'other'];

    if (!reason || !validReasons.includes(reason)) {
      return res
        .status(400)
        .json({ success: false, error: `Reason must be one of: ${validReasons.join(', ')}` });
    }

    const channel = await Channel.findById(req.params.id);
    if (!channel) {
      return res.status(404).json({ success: false, error: 'Channel not found' });
    }

    if (!channel.alternateStreams || index < 0 || index >= channel.alternateStreams.length) {
      return res.status(400).json({ success: false, error: 'Invalid alternate stream index' });
    }

    channel.alternateStreams[index].flaggedBad = {
      isFlagged: true,
      reason,
      flaggedBy: req.user.id,
      flaggedAt: new Date(),
    };
    await channel.save();

    flagLimits.set(flagKey, Date.now());

    audit({
      userId: req.user.id,
      action: 'flag_alternate_stream',
      resource: 'channel',
      resourceId: req.params.id,
      details: { index, reason },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, message: 'Alternate stream flagged as bad' });
  } catch (error) {
    console.error('Error flagging alternate stream:', error);
    res.status(500).json({ success: false, error: 'Failed to flag alternate stream' });
  }
});

// Unflag an alternate stream (admin only)
router.post('/:id/alternates/:index/unflag', requireAuth, requireAdmin, async (req, res) => {
  try {
    const index = parseInt(req.params.index, 10);

    const channel = await Channel.findById(req.params.id);
    if (!channel) {
      return res.status(404).json({ success: false, error: 'Channel not found' });
    }

    if (!channel.alternateStreams || index < 0 || index >= channel.alternateStreams.length) {
      return res.status(400).json({ success: false, error: 'Invalid alternate stream index' });
    }

    channel.alternateStreams[index].flaggedBad = {
      isFlagged: false,
      reason: null,
      flaggedBy: null,
      flaggedAt: null,
    };
    await channel.save();

    audit({
      userId: req.user.id,
      action: 'unflag_alternate_stream',
      resource: 'channel',
      resourceId: req.params.id,
      details: { index },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, message: 'Alternate stream flag cleared' });
  } catch (error) {
    console.error('Error unflagging alternate stream:', error);
    res.status(500).json({ success: false, error: 'Failed to unflag alternate stream' });
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

    const http = require('http');
    const https = require('https');
    const pinnedLookup = createPinnedLookup(ssrfCheck.resolvedAddresses);
    const httpAgent = new http.Agent({ lookup: pinnedLookup });
    const httpsAgent = new https.Agent({ lookup: pinnedLookup });

    const axios = require('axios');
    let isWorking = false;
    let error = null;

    try {
      const response = await axios.get(channel.channelUrl, {
        timeout: 20000,
        maxRedirects: 5,
        responseType: 'stream',
        validateStatus: (status) => status < 500,
        httpAgent,
        httpsAgent,
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

// ─── Helpers ──────────────────────────────────────────────

function getStreamScore(stream) {
  const livenessScores = { alive: 20000, unknown: 10000, dead: 0 };
  const qualityScores = { '1080p': 400, '720p': 300, '480p': 200 };

  const liveness = livenessScores[stream.liveness?.status] ?? 10000;
  const quality = qualityScores[stream.quality] ?? 100;
  const speed = Math.max(0, 100 - (stream.liveness?.responseTimeMs || 5000) / 100);

  return liveness + quality + speed;
}

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
    const { deviceId, proxyPlay } = req.body;

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

    const updateInc = { 'metrics.playCount': 1 };
    if (proxyPlay) {
      updateInc['metrics.proxyPlayCount'] = 1;
    }

    const channel = await Channel.findByIdAndUpdate(
      req.params.id,
      {
        $inc: updateInc,
        $set: { 'metrics.lastPlayedAt': new Date() },
      },
      { new: true },
    );

    if (!channel) {
      return res.status(404).json({ success: false, error: 'Channel not found' });
    }

    // Note: auto-promotion from report-play was removed to avoid race conditions
    // with the stream-health-service scheduler and to prevent untrusted clients
    // from forcing promotions. The scheduler handles promotion based on health probes.

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
