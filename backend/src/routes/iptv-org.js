const express = require('express');
const router = express.Router();
const axios = require('axios');
const Channel = require('../models/Channel');
const { requireAuth, requireAdmin } = require('./auth');
const { iptvOrgCacheService } = require('../services/iptv-org-cache');
const { audit } = require('../services/audit-log');

// Apply authentication to all routes
router.use(requireAuth);

// Middleware: admin-only for destructive/administrative operations
const adminOnly = requireAdmin;

// IPTV-org API base URL (only used for languages passthrough)
const IPTV_ORG_API_BASE = 'https://iptv-org.github.io/api';

// ─── Cache Management ─────────────────────────────────────

// Clear cache (explicit admin action — deletes all cached data)
router.post('/clear-cache', adminOnly, async (req, res) => {
  try {
    await iptvOrgCacheService.clearCache();
    audit({
      userId: req.user.id,
      action: 'clear_cache',
      resource: 'iptv_org_cache',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({ success: true, message: 'Cache cleared successfully' });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ success: false, error: 'Failed to clear cache' });
  }
});

// Force refresh cache (admin action — upserts, never deletes)
router.post('/refresh-cache', adminOnly, async (req, res) => {
  try {
    const result = await iptvOrgCacheService.refreshCache();
    audit({
      userId: req.user.id,
      action: 'refresh_cache',
      resource: 'iptv_org_cache',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({
      success: true,
      message: `Refreshed ${result.enrichedCount} channels in ${result.durationMs}ms`,
      ...result,
    });
  } catch (error) {
    console.error('Error refreshing cache:', error);
    res.status(500).json({ success: false, error: 'Failed to refresh cache' });
  }
});

// Get cache status
router.get('/cache-status', async (req, res) => {
  try {
    const meta = await iptvOrgCacheService.getCacheMeta();
    res.json({
      success: true,
      data: meta || {
        lastRefreshedAt: null,
        enrichedCount: 0,
        refreshInProgress: false,
        livenessCheckInProgress: false,
        livenessStats: { alive: 0, dead: 0, unknown: 0 },
      },
    });
  } catch (error) {
    console.error('Error getting cache status:', error);
    res.status(500).json({ success: false, error: 'Failed to get cache status' });
  }
});

// ─── Liveness Endpoints ───────────────────────────────────

// Trigger batch liveness check (admin action, runs in background)
router.post('/check-liveness', adminOnly, async (req, res) => {
  try {
    audit({
      userId: req.user.id,
      action: 'check_liveness_batch',
      resource: 'iptv_org_cache',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // Start in background, respond immediately
    res.json({
      success: true,
      message: 'Batch liveness check started in background',
    });

    // Run after response is sent
    iptvOrgCacheService
      .runBatchLivenessCheck()
      .catch((err) => console.error('Batch liveness check failed:', err.message));
  } catch (error) {
    console.error('Error starting liveness check:', error);
    res.status(500).json({ success: false, error: 'Failed to start liveness check' });
  }
});

// Check liveness of a single channel (on-demand)
router.post('/check-liveness/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    const { streamUrl } = req.body;

    if (!streamUrl) {
      return res.status(400).json({ success: false, error: 'streamUrl is required in body' });
    }

    const result = await iptvOrgCacheService.checkSingleStream(channelId, streamUrl);

    if (!result) {
      return res.status(404).json({ success: false, error: 'Channel not found in cache' });
    }

    audit({
      userId: req.user.id,
      action: 'check_liveness_single',
      resource: 'iptv_org_cache',
      resourceId: channelId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error checking single stream:', error);
    res.status(500).json({ success: false, error: 'Failed to check stream liveness' });
  }
});

// Get liveness stats
router.get('/liveness-status', async (req, res) => {
  try {
    const meta = await iptvOrgCacheService.getCacheMeta();
    res.json({
      success: true,
      data: {
        livenessStats: meta?.livenessStats || { alive: 0, dead: 0, unknown: 0 },
        livenessCheckInProgress: meta?.livenessCheckInProgress || false,
        lastLivenessCheckAt: meta?.lastLivenessCheckAt || null,
      },
    });
  } catch (error) {
    console.error('Error getting liveness status:', error);
    res.status(500).json({ success: false, error: 'Failed to get liveness status' });
  }
});

// ─── Data Endpoints ───────────────────────────────────────

// Fetch channels from cache (raw channel metadata view)
router.get('/api/channels', async (req, res) => {
  try {
    const { channels, total } = await iptvOrgCacheService.getEnrichedChannels({});
    res.json({ success: true, count: total, data: channels });
  } catch (error) {
    console.error('Error fetching channels:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch channels' });
  }
});

// Fetch streams from cache
router.get('/api/streams', async (req, res) => {
  try {
    const { country, category, limit } = req.query;
    const { channels, total } = await iptvOrgCacheService.getEnrichedChannels({
      country,
      category,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    res.json({ success: true, count: total, data: channels });
  } catch (error) {
    console.error('Error fetching streams:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch streams' });
  }
});

// Get enriched channels (merged channels + streams data)
router.get('/api/enriched', async (req, res) => {
  try {
    const { country, category, language, limit = 100, status } = req.query;
    const { channels, total } = await iptvOrgCacheService.getEnrichedChannels({
      country,
      category,
      language,
      status,
      limit: parseInt(limit, 10),
    });

    // Map to frontend-compatible shape
    const data = channels.map(mapToFrontendShape);

    res.json({ success: true, count: total, data });
  } catch (error) {
    console.error('Error fetching enriched channels:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch enriched channels' });
  }
});

// Get enriched channels grouped by channelId (for smart import)
router.get('/api/grouped', async (req, res) => {
  try {
    const {
      country,
      category,
      language,
      languages,
      limit = 50,
      skip = 0,
      status,
      search,
    } = req.query;

    let languageFilters = [];
    if (languages) {
      try {
        languageFilters = Array.isArray(languages)
          ? languages
          : languages.includes(',')
            ? languages.split(',').map((l) => l.trim().toLowerCase())
            : JSON.parse(languages).map((l) => l.toLowerCase());
      } catch {
        languageFilters = [languages.toLowerCase()];
      }
    } else if (language) {
      languageFilters = [language.toLowerCase()];
    }

    const { channels, total, stale } = await iptvOrgCacheService.getGroupedChannels({
      country: country || undefined,
      languages: languageFilters.length > 0 ? languageFilters : undefined,
      category: category || undefined,
      status: status || undefined,
      search: search || undefined,
      limit: parseInt(limit, 10),
      skip: parseInt(skip, 10),
    });

    res.json({
      success: true,
      count: total,
      data: channels,
      stale,
    });
  } catch (error) {
    console.error('Error fetching grouped channels:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch grouped channels' });
  }
});

// Fetch languages from IPTV-org API (small data, passthrough)
router.get('/api/languages', async (req, res) => {
  try {
    const response = await axios.get(`${IPTV_ORG_API_BASE}/languages.json`, {
      timeout: 30000,
    });
    res.json({ success: true, count: response.data.length, data: response.data });
  } catch (error) {
    console.error('Error fetching IPTV-org languages:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch languages from IPTV-org API' });
  }
});

// Fetch distinct countries with channel counts from cached data
router.get('/countries', async (req, res) => {
  try {
    const { IptvOrgChannel } = require('../models/IptvOrgCache');
    const results = await IptvOrgChannel.aggregate([
      { $match: { country: { $nin: [null, ''] } } },
      { $group: { _id: '$country', channelCount: { $sum: 1 } } },
      { $sort: { channelCount: -1 } },
    ]);
    const data = results.map((r) => ({ code: r._id, channelCount: r.channelCount }));
    res.json({ success: true, count: data.length, data });
  } catch (error) {
    console.error('Error fetching IPTV-org countries:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch countries' });
  }
});

// Fetch available playlists from IPTV-org
router.get('/playlists', async (req, res) => {
  try {
    const playlists = [
      {
        id: 'india-all',
        name: 'India - All',
        description: 'Indian channels (Hindi, English, Marathi)',
        type: 'custom',
        filter: { country: 'IN', languages: ['hin', 'eng', 'mar'] },
      },
      {
        id: 'kids-hindi',
        name: 'Kids (Hindi & English)',
        description: 'Kids channels in Hindi',
        type: 'custom',
        filter: { category: 'kids', languages: ['hin'] },
      },
      {
        id: 'kids-english',
        name: 'Kids (Hindi & English)',
        description: 'Kids channels in English',
        type: 'custom',
        filter: { category: 'kids', languages: ['eng'] },
      },
      {
        id: 'news-india',
        name: 'News - India',
        description: 'Indian news (Hindi, English, Marathi)',
        type: 'custom',
        filter: { country: 'IN', category: 'news', languages: ['hin', 'eng', 'mar'] },
      },
      {
        id: 'news-english',
        name: 'News - English',
        description: 'English news channels',
        type: 'custom',
        filter: { category: 'news', language: 'eng' },
      },
      {
        id: 'india-hindi',
        name: 'India - Hindi',
        description: 'Indian Hindi channels',
        type: 'country-language',
        filter: { country: 'IN', language: 'hin' },
      },
      {
        id: 'india-english',
        name: 'India - English',
        description: 'Indian English channels',
        type: 'country-language',
        filter: { country: 'IN', language: 'eng' },
      },
      {
        id: 'india-marathi',
        name: 'India - Marathi',
        description: 'Indian Marathi channels',
        type: 'country-language',
        filter: { country: 'IN', language: 'mar' },
      },
      {
        id: 'movies-hindi',
        name: 'Movies - Hindi',
        description: 'Hindi movie channels',
        type: 'category-language',
        filter: { category: 'movies', language: 'hin' },
      },
      {
        id: 'entertainment-hindi',
        name: 'Entertainment - Hindi',
        description: 'Hindi entertainment channels',
        type: 'category-language',
        filter: { category: 'entertainment', language: 'hin' },
      },
      {
        id: 'sports-india',
        name: 'Sports - India',
        description: 'Indian sports channels',
        type: 'country-category',
        filter: { country: 'IN', category: 'sports' },
      },
      {
        id: 'music-india',
        name: 'Music - India',
        description: 'Indian music channels',
        type: 'country-category',
        filter: { country: 'IN', category: 'music' },
      },
    ];

    res.json({ success: true, count: playlists.length, data: playlists });
  } catch (error) {
    console.error('Error fetching playlists:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch playlists' });
  }
});

// Fetch and parse a specific playlist with enriched metadata
router.get('/fetch', async (req, res) => {
  try {
    const { country, language, languages, category, status } = req.query;

    // Parse languages array
    let languageFilters = [];
    if (languages) {
      try {
        languageFilters = Array.isArray(languages)
          ? languages
          : languages.includes(',')
            ? languages.split(',').map((l) => l.trim().toLowerCase())
            : JSON.parse(languages).map((l) => l.toLowerCase());
      } catch {
        languageFilters = [languages.toLowerCase()];
      }
    } else if (language) {
      languageFilters = [language.toLowerCase()];
    }

    const { channels, total, stale } = await iptvOrgCacheService.getEnrichedChannels({
      country: country || undefined,
      languages: languageFilters.length > 0 ? languageFilters : undefined,
      language: undefined, // handled via languages array above
      category: category || undefined,
      status: status || undefined,
    });

    // Map to frontend-compatible shape
    const data = channels.map(mapToFrontendShape);

    res.json({
      success: true,
      count: total,
      data,
      filters: {
        country: country || null,
        languages: languageFilters,
        category: category || null,
        status: status || null,
      },
      stale,
    });
  } catch (error) {
    console.error('Error fetching IPTV-org playlist:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch playlist' });
  }
});

// ─── Import Routes (unchanged — work with Channel model) ──

// Import selected channels from IPTV-org (admin only)
router.post('/import', adminOnly, async (req, res) => {
  try {
    const { channels, replaceExisting } = req.body;

    if (!channels || !Array.isArray(channels)) {
      return res.status(400).json({ success: false, error: 'Channels array is required' });
    }

    let imported = 0;
    let skipped = 0;
    let errors = [];

    if (replaceExisting) {
      const session = await Channel.startSession();
      try {
        await session.withTransaction(async () => {
          await Channel.deleteMany({}, { session });
          const docs = channels.map((channelData, i) => ({
            channelId: channelData.channelId || `iptv_${Date.now()}_${i}`,
            channelName: channelData.channelName,
            channelUrl: channelData.channelUrl,
            channelImg: channelData.channelImg || channelData.tvgLogo || '',
            channelGroup: channelData.channelGroup || channelData.groupTitle || 'Uncategorized',
            tvgId: channelData.tvgId || channelData.channelId || '',
            tvgName: channelData.tvgName || '',
            tvgLogo: channelData.tvgLogo || '',
            order: i,
            metadata: {
              country: channelData.country || '',
              language: channelData.language || '',
              quality: channelData.streamQuality || '',
              network: channelData.channelNetwork || '',
              website: channelData.channelWebsite || '',
            },
          }));
          await Channel.insertMany(docs, { session, ordered: false });
        });
        return res.json({
          success: true,
          imported: channels.length,
          skipped: 0,
          message: `Successfully replaced with ${channels.length} channels`,
        });
      } finally {
        session.endSession();
      }
    }

    for (const channelData of channels) {
      try {
        const channel = new Channel({
          channelId: channelData.channelId || `iptv_${Date.now()}_${Math.random()}`,
          channelName: channelData.channelName,
          channelUrl: channelData.channelUrl,
          channelImg: channelData.channelImg || channelData.tvgLogo || '',
          channelGroup: channelData.channelGroup || channelData.groupTitle || 'Uncategorized',
          tvgId: channelData.tvgId || channelData.channelId || '',
          tvgName: channelData.tvgName || '',
          tvgLogo: channelData.tvgLogo || '',
          order: imported,
          metadata: {
            country: channelData.country || '',
            language: channelData.language || '',
            quality: channelData.streamQuality || '',
            network: channelData.channelNetwork || '',
            website: channelData.channelWebsite || '',
          },
        });

        await channel.save();
        imported++;
      } catch (error) {
        if (error.code === 11000) {
          skipped++;
        } else {
          errors.push({ channel: channelData.channelName, error: error.message });
        }
      }
    }

    audit({
      userId: req.user.id,
      action: 'import_iptv_org',
      resource: 'channel',
      resourceId: `${imported} channels`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      imported,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully imported ${imported} channels, skipped ${skipped} duplicates`,
    });
  } catch (error) {
    console.error('Error importing channels:', error);
    res.status(500).json({ success: false, error: 'Failed to import channels' });
  }
});

// Import grouped channels from IPTV-org with alternate streams (admin only)
router.post('/import-grouped', adminOnly, async (req, res) => {
  try {
    const { channels, replaceExisting } = req.body;

    if (!channels || !Array.isArray(channels)) {
      return res.status(400).json({ success: false, error: 'Channels array is required' });
    }

    let imported = 0;
    let skipped = 0;
    const errors = [];

    if (replaceExisting) {
      const session = await Channel.startSession();
      try {
        await session.withTransaction(async () => {
          await Channel.deleteMany({}, { session });
          const docs = channels.map((ch, i) => ({
            channelId: ch.channelId || `iptv_${Date.now()}_${i}`,
            channelName: ch.channelName,
            channelUrl: ch.selectedStreamUrl || ch.channelUrl,
            channelImg: ch.channelImg || ch.tvgLogo || '',
            channelGroup: ch.channelGroup || 'Uncategorized',
            tvgId: ch.tvgId || ch.channelId || '',
            tvgName: ch.tvgName || '',
            tvgLogo: ch.tvgLogo || '',
            order: i,
            metadata: ch.metadata || {},
            alternateStreams: (ch.alternateStreams || []).map((alt) => ({
              streamUrl: alt.streamUrl,
              quality: alt.quality || null,
              liveness: alt.liveness || { status: 'unknown' },
              flaggedBad: { isFlagged: false },
              userAgent: alt.userAgent || null,
              referrer: alt.referrer || null,
              source: 'iptv-org',
            })),
          }));
          await Channel.insertMany(docs, { session, ordered: false });
        });
        return res.json({
          success: true,
          imported: channels.length,
          skipped: 0,
          message: `Successfully replaced with ${channels.length} channels`,
        });
      } finally {
        session.endSession();
      }
    }

    for (const ch of channels) {
      try {
        const channel = new Channel({
          channelId: ch.channelId || `iptv_${Date.now()}_${Math.random()}`,
          channelName: ch.channelName,
          channelUrl: ch.selectedStreamUrl || ch.channelUrl,
          channelImg: ch.channelImg || ch.tvgLogo || '',
          channelGroup: ch.channelGroup || 'Uncategorized',
          tvgId: ch.tvgId || ch.channelId || '',
          tvgName: ch.tvgName || '',
          tvgLogo: ch.tvgLogo || '',
          order: imported,
          metadata: ch.metadata || {},
          alternateStreams: (ch.alternateStreams || []).map((alt) => ({
            streamUrl: alt.streamUrl,
            quality: alt.quality || null,
            liveness: alt.liveness || { status: 'unknown' },
            flaggedBad: { isFlagged: false },
            userAgent: alt.userAgent || null,
            referrer: alt.referrer || null,
            source: 'iptv-org',
          })),
        });

        await channel.save();
        imported++;
      } catch (error) {
        if (error.code === 11000) {
          skipped++;
        } else {
          errors.push({ channel: ch.channelName, error: error.message });
        }
      }
    }

    audit({
      userId: req.user.id,
      action: 'import_iptv_org_grouped',
      resource: 'channel',
      resourceId: `${imported} channels`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      imported,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully imported ${imported} channels with alternates, skipped ${skipped} duplicates`,
    });
  } catch (error) {
    console.error('Error importing grouped channels:', error);
    res.status(500).json({ success: false, error: 'Failed to import grouped channels' });
  }
});

// Import grouped channels with alternate streams to user's playlist
router.post('/import-grouped-user', async (req, res) => {
  try {
    const { channels } = req.body;
    const userId = req.user.id;

    if (!channels || !Array.isArray(channels)) {
      return res.status(400).json({ success: false, error: 'Channels array is required' });
    }

    const User = require('../models/User');
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const existingChannelIds = new Set(user.channels.map((id) => id.toString()));
    const channelIdsToAdd = [];
    let updatedCount = 0;

    for (const ch of channels) {
      try {
        const url = ch.selectedStreamUrl || ch.channelUrl;
        const name = ch.channelName;
        const logo = ch.tvgLogo || '';
        const id = ch.channelId || `iptv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const group = ch.channelGroup || 'Imported';

        let existingChannel = await Channel.findOne({ channelUrl: url });

        if (existingChannel) {
          // Merge incoming alternateStreams into the existing channel
          const incomingAlts = (ch.alternateStreams || []).map((alt) => ({
            streamUrl: alt.streamUrl,
            quality: alt.quality || null,
            liveness: alt.liveness || { status: 'unknown' },
            flaggedBad: { isFlagged: false },
            userAgent: alt.userAgent || null,
            referrer: alt.referrer || null,
            source: 'iptv-org',
          }));

          if (incomingAlts.length > 0) {
            const existingUrls = new Set([
              existingChannel.channelUrl,
              ...(existingChannel.alternateStreams || []).map((a) => a.streamUrl),
            ]);
            const newAlts = incomingAlts.filter((a) => !existingUrls.has(a.streamUrl));
            if (newAlts.length > 0) {
              await Channel.updateOne(
                { _id: existingChannel._id },
                { $push: { alternateStreams: { $each: newAlts } } },
              );
              updatedCount++;
            }
          }

          const channelIdStr = existingChannel._id.toString();
          if (!existingChannelIds.has(channelIdStr)) {
            channelIdsToAdd.push(existingChannel._id);
            existingChannelIds.add(channelIdStr);
          }
        } else {
          const newChannel = new Channel({
            channelId: id,
            channelName: name,
            channelUrl: url,
            channelImg: logo,
            tvgLogo: logo,
            channelGroup: group,
            tvgName: name || '',
            metadata: ch.metadata || {},
            alternateStreams: (ch.alternateStreams || []).map((alt) => ({
              streamUrl: alt.streamUrl,
              quality: alt.quality || null,
              liveness: alt.liveness || { status: 'unknown' },
              flaggedBad: { isFlagged: false },
              userAgent: alt.userAgent || null,
              referrer: alt.referrer || null,
              source: 'iptv-org',
            })),
          });

          await newChannel.save();
          channelIdsToAdd.push(newChannel._id);
          existingChannelIds.add(newChannel._id.toString());
        }
      } catch (error) {
        console.error('Error processing grouped channel:', ch.channelName, error.message);
      }
    }

    // Collect all alternate stream URLs across all imported channels
    // to remove duplicate standalone channels from the user's list
    const allAlternateUrls = new Set();
    for (const ch of channels) {
      for (const alt of ch.alternateStreams || []) {
        if (alt.streamUrl) allAlternateUrls.add(alt.streamUrl);
      }
    }

    // Find channels in user's list whose primary URL is now an alternate
    let deduplicatedCount = 0;
    if (allAlternateUrls.size > 0) {
      const redundantChannels = await Channel.find({
        channelUrl: { $in: [...allAlternateUrls] },
        _id: { $in: user.channels },
      }).select('_id');
      const redundantIds = redundantChannels.map((c) => c._id);
      if (redundantIds.length > 0) {
        await User.updateOne({ _id: userId }, { $pull: { channels: { $in: redundantIds } } });
        deduplicatedCount = redundantIds.length;
      }
    }

    if (channelIdsToAdd.length > 0) {
      await User.updateOne(
        { _id: userId },
        { $addToSet: { channels: { $each: channelIdsToAdd } } },
      );
    }

    audit({
      userId: req.user.id,
      action: 'import_iptv_org_grouped_user',
      resource: 'channel',
      resourceId: `${channelIdsToAdd.length} channels`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    const updatedUser = await User.findById(userId);
    const parts = [];
    if (channelIdsToAdd.length > 0)
      parts.push(
        `Added ${channelIdsToAdd.length} channel${channelIdsToAdd.length !== 1 ? 's' : ''}`,
      );
    if (updatedCount > 0)
      parts.push(
        `Updated ${updatedCount} channel${updatedCount !== 1 ? 's' : ''} with alternate streams`,
      );
    if (deduplicatedCount > 0)
      parts.push(`Merged ${deduplicatedCount} duplicate${deduplicatedCount !== 1 ? 's' : ''}`);
    const message = parts.length > 0 ? parts.join('. ') : 'Channels already in your list';

    res.json({
      success: true,
      addedCount: channelIdsToAdd.length,
      updatedCount,
      totalChannels: updatedUser.channels.length,
      message,
    });
  } catch (error) {
    console.error('Error importing grouped channels for user:', error);
    res.status(500).json({ success: false, error: 'Failed to import grouped channels' });
  }
});

// Import selected channels from IPTV-org to user's playlist
router.post('/import-user', async (req, res) => {
  try {
    const { channels } = req.body;
    const userId = req.user.id;

    if (!channels || !Array.isArray(channels)) {
      return res.status(400).json({ success: false, error: 'Channels array is required' });
    }

    const User = require('../models/User');

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const existingChannelIds = new Set(user.channels.map((id) => id.toString()));
    const channelIdsToAdd = [];

    for (const ch of channels) {
      try {
        const url = ch.channelUrl || ch.url;
        const name = ch.channelName || ch.name;
        const logo = ch.tvgLogo || ch.logo || '';
        const id =
          ch.channelId || ch.id || `iptv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const group = ch.channelGroup || ch.category || 'IPTV-org';

        let existingChannel = await Channel.findOne({ channelUrl: url });

        if (existingChannel) {
          const channelIdStr = existingChannel._id.toString();
          if (!existingChannelIds.has(channelIdStr)) {
            channelIdsToAdd.push(existingChannel._id);
            existingChannelIds.add(channelIdStr);
          }
        } else {
          const newChannel = new Channel({
            channelId: id,
            channelName: name,
            channelUrl: url,
            channelImg: logo,
            tvgLogo: logo,
            channelGroup: group,
            tvgName: name || '',
            metadata: {
              country: ch.country || '',
              language: ch.language || '',
              quality: ch.streamQuality || '',
              network: ch.channelNetwork || '',
              website: ch.channelWebsite || '',
            },
          });

          await newChannel.save();
          channelIdsToAdd.push(newChannel._id);
          existingChannelIds.add(newChannel._id.toString());
        }
      } catch (error) {
        console.error('Error processing channel:', ch.name, error.message);
      }
    }

    if (channelIdsToAdd.length > 0) {
      user.channels.push(...channelIdsToAdd);
      await user.save();
    }

    audit({
      userId: req.user.id,
      action: 'import_iptv_org_user',
      resource: 'channel',
      resourceId: `${channelIdsToAdd.length} channels`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      addedCount: channelIdsToAdd.length,
      totalChannels: user.channels.length,
      message: `Added ${channelIdsToAdd.length} channels to your list`,
    });
  } catch (error) {
    console.error('Error importing channels for user:', error);
    res.status(500).json({ success: false, error: 'Failed to import channels' });
  }
});

// ─── Helpers ──────────────────────────────────────────────

// Map IptvOrgChannel doc to frontend-compatible shape
function mapToFrontendShape(doc) {
  return {
    channelId: doc.channelId,
    channelName: doc.channelName,
    channelUrl: doc.streamUrl,
    tvgId: doc.channelId,
    tvgName: doc.channelName,
    tvgLogo: doc.tvgLogo,
    channelGroup: doc.channelGroup,
    groupTitle: doc.channelGroup,
    tvgCountry: doc.country,
    country: doc.country,
    countryCode: doc.country,
    tvgLanguage: doc.languageNames?.join(', ') || null,
    language: doc.languageNames?.join(', ') || null,
    languages: doc.languageNames || [],
    languageCodes: doc.languageCodes || [],
    channelImg: doc.tvgLogo,
    streamQuality: doc.streamQuality,
    streamUserAgent: doc.streamUserAgent,
    streamReferrer: doc.streamReferrer,
    channelCategories: doc.categories || [],
    channelWebsite: doc.channelWebsite,
    channelNetwork: doc.channelNetwork,
    channelIsNsfw: doc.channelIsNsfw || false,
    categories: doc.categories || [],
    // Liveness data for frontend badges
    liveness: doc.liveness || { status: 'unknown' },
  };
}

module.exports = router;
