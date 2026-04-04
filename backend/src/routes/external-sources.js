const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const Channel = require('../models/Channel');
const { SeedChannel } = require('../models/SeedChannel');
const { requireAuth, requireAdmin } = require('./auth');
const { externalSourceCacheService } = require('../services/external-source-cache');
const { audit } = require('../services/audit-log');

const VALID_SOURCES = ['pluto-tv', 'samsung-tv-plus', 'youtube-live', 'prasar-bharati'];
const SEED_SOURCES = ['youtube-live', 'prasar-bharati'];
const REGION_REGEX = /^[a-z]{2}$/;

function validateSource(source) {
  return VALID_SOURCES.includes(source);
}
function validateRegion(region) {
  return typeof region === 'string' && REGION_REGEX.test(region);
}

router.use(requireAuth);

// Middleware: admin-only for destructive/administrative operations
const adminOnly = requireAdmin;

// ─── Helper: map DB doc to frontend shape ────────────────────
function mapToFrontendShape(ch, source) {
  return {
    _uid: String(ch._id),
    channelId: ch.channelId,
    channelName: ch.channelName,
    channelUrl: ch.streamUrl,
    tvgLogo: ch.tvgLogo || '',
    groupTitle: ch.groupTitle || 'Uncategorized',
    country: ch.country || '',
    source,
    summary: ch.summary || '',
    codec: ch.codec || undefined,
    bitrate: ch.bitrate || undefined,
    language: ch.language || undefined,
    votes: ch.votes != null ? ch.votes : undefined,
    homepage: ch.homepage || undefined,
    liveness: ch.liveness
      ? {
          status: ch.liveness.status,
          lastCheckedAt: ch.liveness.lastCheckedAt,
          responseTimeMs: ch.liveness.responseTimeMs,
          error: ch.liveness.error,
        }
      : undefined,
  };
}

// ─── Helper: validate cached channel has expected structure ─
function isValidCachedChannel(ch) {
  return (
    ch &&
    typeof ch === 'object' &&
    typeof ch.channelId === 'string' &&
    ch.channelId.length > 0 &&
    typeof ch.channelName === 'string' &&
    ch.channelName.length > 0
  );
}

function filterValidChannels(channels) {
  if (!Array.isArray(channels)) return [];
  return channels.filter(isValidCachedChannel);
}

// ─── Pluto TV ──────────────────────────────────────────────

router.get('/pluto-tv/regions', async (req, res) => {
  try {
    const regions = await externalSourceCacheService.getPlutoRegions();
    res.json({ success: true, data: regions });
  } catch (error) {
    console.error('Pluto TV regions error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch Pluto TV regions' });
  }
});

router.get('/pluto-tv/channels', async (req, res) => {
  try {
    const country = (req.query.country || 'us').toLowerCase();
    if (!validateRegion(country)) {
      return res
        .status(400)
        .json({ success: false, error: 'Invalid country code. Must be a 2-letter code' });
    }
    const status = req.query.status;
    const rawChannels = await externalSourceCacheService.getChannels('pluto-tv', country, {
      status,
    });
    const channels = filterValidChannels(rawChannels);
    const data = channels.map((ch) => mapToFrontendShape(ch, 'pluto-tv'));
    res.json({ success: true, data, fromCache: true });
  } catch (error) {
    console.error('Pluto TV fetch error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch Pluto TV channels' });
  }
});

// ─── Samsung TV Plus ───────────────────────────────────────

router.get('/samsung-tv-plus/regions', async (req, res) => {
  try {
    const regions = await externalSourceCacheService.getSamsungRegions();
    res.json({ success: true, data: regions });
  } catch (error) {
    console.error('Samsung TV Plus regions error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Samsung TV Plus regions',
    });
  }
});

router.get('/samsung-tv-plus/channels', async (req, res) => {
  try {
    const country = (req.query.country || 'us').toLowerCase();
    if (!validateRegion(country)) {
      return res
        .status(400)
        .json({ success: false, error: 'Invalid country code. Must be a 2-letter code' });
    }
    const status = req.query.status;
    const rawChannels = await externalSourceCacheService.getChannels('samsung-tv-plus', country, {
      status,
    });
    const channels = filterValidChannels(rawChannels);
    const data = channels.map((ch) => mapToFrontendShape(ch, 'samsung-tv-plus'));
    res.json({ success: true, data, fromCache: true });
  } catch (error) {
    console.error('Samsung TV Plus fetch error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Samsung TV Plus channels',
    });
  }
});

// ─── YouTube Live ────────────────────────────────────────────

router.get('/youtube-live/regions', async (req, res) => {
  try {
    const regions = await externalSourceCacheService.getYouTubeLiveRegions();
    res.json({ success: true, data: regions });
  } catch (error) {
    console.error('YouTube Live regions error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch YouTube Live regions' });
  }
});

router.get('/youtube-live/channels', async (req, res) => {
  try {
    const country = (req.query.country || 'in').toLowerCase();
    if (!validateRegion(country)) {
      return res
        .status(400)
        .json({ success: false, error: 'Invalid country code. Must be a 2-letter code' });
    }
    const status = req.query.status;
    const rawChannels = await externalSourceCacheService.getChannels('youtube-live', country, {
      status,
    });
    const channels = filterValidChannels(rawChannels);
    const data = channels.map((ch) => mapToFrontendShape(ch, 'youtube-live'));
    res.json({ success: true, data, fromCache: true });
  } catch (error) {
    console.error('YouTube Live fetch error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch YouTube Live channels' });
  }
});

// ─── Prasar Bharati ─────────────────────────────────────────

router.get('/prasar-bharati/regions', async (req, res) => {
  try {
    const regions = await externalSourceCacheService.getPrasarBharatiRegions();
    res.json({ success: true, data: regions });
  } catch (error) {
    console.error('Prasar Bharati regions error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch Prasar Bharati regions' });
  }
});

router.get('/prasar-bharati/channels', async (req, res) => {
  try {
    const country = (req.query.country || 'in').toLowerCase();
    if (!validateRegion(country)) {
      return res
        .status(400)
        .json({ success: false, error: 'Invalid country code. Must be a 2-letter code' });
    }
    const status = req.query.status;
    const rawChannels = await externalSourceCacheService.getChannels('prasar-bharati', country, {
      status,
    });
    const channels = filterValidChannels(rawChannels);
    const data = channels.map((ch) => mapToFrontendShape(ch, 'prasar-bharati'));
    res.json({ success: true, data, fromCache: true });
  } catch (error) {
    console.error('Prasar Bharati fetch error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch Prasar Bharati channels' });
  }
});

// ─── Seed Channels (admin CRUD) ─────────────────────────────

router.get('/seed-channels', adminOnly, async (req, res) => {
  try {
    const query = {};
    if (req.query.source) {
      if (!SEED_SOURCES.includes(req.query.source)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid source. Must be one of: ' + SEED_SOURCES.join(', '),
        });
      }
      query.source = req.query.source;
    }
    const seeds = await SeedChannel.find(query).sort({ channelName: 1 }).lean();
    res.json({ success: true, data: seeds });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch seed channels' });
  }
});

router.post('/seed-channels', adminOnly, async (req, res) => {
  try {
    const { channelName, source, ytChannelId, directUrl, tvgLogo, groupTitle, language } = req.body;

    if (!channelName || !source) {
      return res.status(400).json({ success: false, error: 'channelName and source are required' });
    }
    if (!SEED_SOURCES.includes(source)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid source. Must be one of: ' + SEED_SOURCES.join(', '),
      });
    }
    if (!ytChannelId && !directUrl) {
      return res
        .status(400)
        .json({ success: false, error: 'Either ytChannelId or directUrl is required' });
    }

    const seed = await SeedChannel.create({
      channelName,
      source,
      ytChannelId: ytChannelId || null,
      directUrl: directUrl || null,
      tvgLogo: tvgLogo || '',
      groupTitle: groupTitle || 'Uncategorized',
      language: language || '',
      enabled: true,
    });

    audit({
      userId: req.user.id,
      action: 'create_seed_channel',
      resource: 'seed_channel',
      resourceId: seed._id.toString(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({ success: true, data: seed });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, error: 'Seed channel already exists' });
    }
    console.error('Create seed channel error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to create seed channel' });
  }
});

router.put('/seed-channels/:id', adminOnly, async (req, res) => {
  try {
    const allowed = [
      'channelName',
      'ytChannelId',
      'directUrl',
      'tvgLogo',
      'groupTitle',
      'language',
      'enabled',
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const seed = await SeedChannel.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true },
    );
    if (!seed) {
      return res.status(404).json({ success: false, error: 'Seed channel not found' });
    }

    audit({
      userId: req.user.id,
      action: 'update_seed_channel',
      resource: 'seed_channel',
      resourceId: seed._id.toString(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, data: seed });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, error: 'Duplicate seed channel' });
    }
    console.error('Update seed channel error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to update seed channel' });
  }
});

router.delete('/seed-channels/:id', adminOnly, async (req, res) => {
  try {
    const seed = await SeedChannel.findByIdAndDelete(req.params.id);
    if (!seed) {
      return res.status(404).json({ success: false, error: 'Seed channel not found' });
    }

    audit({
      userId: req.user.id,
      action: 'delete_seed_channel',
      resource: 'seed_channel',
      resourceId: seed._id.toString(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, message: 'Seed channel deleted' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete seed channel' });
  }
});

// ─── Liveness Endpoints ────────────────────────────────────

router.post('/check-liveness', adminOnly, async (req, res) => {
  try {
    const { source, region } = req.body;
    if (!source || !region) {
      return res.status(400).json({ success: false, error: 'source and region are required' });
    }
    if (!validateSource(source)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid source. Must be one of: ' + VALID_SOURCES.join(', '),
      });
    }
    if (!validateRegion(region)) {
      return res
        .status(400)
        .json({ success: false, error: 'Invalid region format. Must be a 2-letter country code' });
    }

    audit({
      userId: req.user.id,
      action: 'check_liveness_batch',
      resource: 'external_source_cache',
      resourceId: `${source}:${region}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // Fire and forget
    externalSourceCacheService
      .runBatchLivenessCheck(source, region)
      .catch((err) => console.error('[ext-cache] Batch liveness error:', err.message));

    res.json({
      success: true,
      message: `Batch liveness check started for ${source}:${region}`,
    });
  } catch {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/check-liveness/:docId', async (req, res) => {
  try {
    const result = await externalSourceCacheService.checkSingleStream(req.params.docId);
    if (!result) return res.status(404).json({ success: false, error: 'Channel not found' });
    audit({
      userId: req.user.id,
      action: 'check_liveness_single',
      resource: 'external_source_cache',
      resourceId: req.params.docId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({ success: true, data: result });
  } catch {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/liveness-status', async (req, res) => {
  try {
    const { source, region } = req.query;
    if (!source || !region) {
      return res.status(400).json({ success: false, error: 'source and region are required' });
    }
    if (!validateSource(source)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid source. Must be one of: ' + VALID_SOURCES.join(', '),
      });
    }
    if (!validateRegion(region)) {
      return res
        .status(400)
        .json({ success: false, error: 'Invalid region format. Must be a 2-letter country code' });
    }
    const meta = await externalSourceCacheService.getCacheMeta(source, region);
    res.json({
      success: true,
      data: {
        livenessStats: meta?.livenessStats || { alive: 0, dead: 0, unknown: 0 },
        livenessCheckInProgress: meta?.livenessCheckInProgress || false,
        lastLivenessCheckAt: meta?.lastLivenessCheckAt || null,
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/refresh-cache', adminOnly, async (req, res) => {
  try {
    const { source, region } = req.body;
    if (!source || !region) {
      return res.status(400).json({ success: false, error: 'source and region are required' });
    }
    if (!validateSource(source)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid source. Must be one of: ' + VALID_SOURCES.join(', '),
      });
    }
    if (!validateRegion(region)) {
      return res
        .status(400)
        .json({ success: false, error: 'Invalid region format. Must be a 2-letter country code' });
    }
    const result = await externalSourceCacheService.refreshRegion(source, region);
    audit({
      userId: req.user.id,
      action: 'refresh_cache',
      resource: 'external_source_cache',
      resourceId: `${source}:${region}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({ success: true, data: result });
  } catch {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ─── Import to System ──────────────────────────────────────
router.post('/import', adminOnly, async (req, res) => {
  try {
    const { channels, replaceExisting } = req.body;
    if (!channels || !Array.isArray(channels) || channels.length === 0) {
      return res.status(400).json({ success: false, error: 'No channels provided' });
    }
    if (channels.length > 10000) {
      return res.status(400).json({ success: false, error: 'Maximum 10,000 channels per import' });
    }

    if (replaceExisting) {
      if (!req.body.confirmDeleteAll) {
        return res.status(400).json({
          success: false,
          error: 'Set confirmDeleteAll: true to confirm replacing all channels',
        });
      }
      await Channel.deleteMany({});
    }

    const docs = channels.map((ch) => ({
      channelName: ch.channelName,
      channelUrl: ch.channelUrl,
      tvgLogo: ch.tvgLogo || '',
      tvgName: ch.tvgName || ch.channelName || '',
      channelGroup: ch.groupTitle || ch.channelGroup || 'Imported',
      channelId: ch.channelId || `imp_${crypto.randomUUID()}`,
      metadata: {
        country: ch.country || '',
        language: ch.language || '',
      },
    }));

    const result = await Channel.insertMany(docs, { ordered: false }).catch((err) => {
      if (err.insertedDocs) return err.insertedDocs;
      throw err;
    });

    const count = Array.isArray(result) ? result.length : 0;
    audit({
      userId: req.user.id,
      action: 'import_external_source',
      resource: 'channel',
      resourceId: `${count} channels`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({
      success: true,
      message: `Imported ${count} channels to system`,
      importedCount: count,
    });
  } catch (error) {
    console.error('External sources import error:', error.message);
    res.status(500).json({ success: false, error: 'Import failed' });
  }
});

// ─── Import to User Playlist ─────────────────────────────
router.post('/import-user', async (req, res) => {
  try {
    const { channels } = req.body;
    const userId = req.user.id;

    if (!channels || !Array.isArray(channels) || channels.length === 0) {
      return res.status(400).json({ success: false, error: 'Channels array is required' });
    }
    if (channels.length > 500) {
      return res.status(400).json({ success: false, error: 'Maximum 500 channels per import' });
    }

    const User = require('../models/User');
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const existingChannelIds = new Set(user.channels.map((id) => id.toString()));
    const channelIdsToAdd = [];

    for (const ch of channels) {
      if (!ch.channelUrl || typeof ch.channelUrl !== 'string') continue;
      try {
        const parsed = new URL(ch.channelUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) continue;
      } catch {
        continue;
      }
      try {
        let existingChannel = await Channel.findOne({
          channelUrl: ch.channelUrl,
        });

        if (existingChannel) {
          const channelIdStr = existingChannel._id.toString();
          if (!existingChannelIds.has(channelIdStr)) {
            channelIdsToAdd.push(existingChannel._id);
            existingChannelIds.add(channelIdStr);
          }
        } else {
          const newChannel = new Channel({
            channelId: ch.channelId || `ext_${crypto.randomUUID()}`,
            channelName: ch.channelName,
            channelUrl: ch.channelUrl,
            channelImg: ch.tvgLogo || '',
            tvgLogo: ch.tvgLogo || '',
            channelGroup: ch.groupTitle || 'Imported',
            tvgName: ch.channelName || '',
            metadata: {
              country: ch.country || '',
              language: ch.language || '',
            },
          });

          await newChannel.save();
          channelIdsToAdd.push(newChannel._id);
          existingChannelIds.add(newChannel._id.toString());
        }
      } catch (error) {
        console.error('Error processing channel:', ch.channelName, error.message);
      }
    }

    let totalChannels = user.channels.length;
    if (channelIdsToAdd.length > 0) {
      // Use atomic $addToSet to prevent lost updates under concurrent requests
      const updated = await User.findByIdAndUpdate(
        userId,
        { $addToSet: { channels: { $each: channelIdsToAdd } } },
        { new: true },
      );
      totalChannels = updated ? updated.channels.length : totalChannels;
    }

    audit({
      userId: req.user.id,
      action: 'import_external_source_user',
      resource: 'channel',
      resourceId: `${channelIdsToAdd.length} channels`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({
      success: true,
      addedCount: channelIdsToAdd.length,
      totalChannels,
      message: `Added ${channelIdsToAdd.length} channels to your list`,
    });
  } catch (error) {
    console.error('Error importing external channels for user:', error);
    res.status(500).json({ success: false, error: 'Failed to import channels' });
  }
});

// ─── Clear Cache ───────────────────────────────────────────
router.post('/clear-cache', adminOnly, async (req, res) => {
  try {
    const { source, region } = req.body || {};
    if (source && !validateSource(source)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid source. Must be one of: ' + VALID_SOURCES.join(', '),
      });
    }
    if (region && !validateRegion(region)) {
      return res
        .status(400)
        .json({ success: false, error: 'Invalid region format. Must be a 2-letter country code' });
    }
    await externalSourceCacheService.clearCache(source, region);
    audit({
      userId: req.user.id,
      action: 'clear_cache',
      resource: 'external_source_cache',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({ success: true, message: 'Cache cleared' });
  } catch {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
