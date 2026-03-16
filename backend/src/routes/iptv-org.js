const express = require('express');
const router = express.Router();
const axios = require('axios');
const Channel = require('../models/Channel');
const { requireAuth, requireAdmin } = require('./auth');
const { iptvOrgCacheService } = require('../services/iptv-org-cache');

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
        // Start in background, respond immediately
        res.json({
            success: true,
            message: 'Batch liveness check started in background',
        });

        // Run after response is sent
        iptvOrgCacheService.runBatchLivenessCheck().catch((err) =>
            console.error('Batch liveness check failed:', err.message),
        );
    } catch (error) {
        console.error('Error starting liveness check:', error);
        res.status(500).json({ success: false, error: 'Failed to start liveness check' });
    }
});

// Check liveness of a single channel (on-demand)
router.post('/check-liveness/:channelId', adminOnly, async (req, res) => {
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
            limit: limit ? parseInt(limit) : undefined,
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
            limit: parseInt(limit),
        });

        // Map to frontend-compatible shape
        const data = channels.map(mapToFrontendShape);

        res.json({ success: true, count: total, data });
    } catch (error) {
        console.error('Error fetching enriched channels:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch enriched channels' });
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
            } catch (e) {
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
                        channelGroup: channelData.channelGroup || 'Uncategorized',
                        tvgId: channelData.tvgId || channelData.channelId || '',
                        tvgName: channelData.tvgName || '',
                        tvgLogo: channelData.tvgLogo || '',
                        order: i,
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
                    channelGroup: channelData.channelGroup || 'Uncategorized',
                    tvgId: channelData.tvgId || channelData.channelId || '',
                    tvgName: channelData.tvgName || '',
                    tvgLogo: channelData.tvgLogo || '',
                    order: imported,
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

// Import selected channels from IPTV-org to user's playlist
router.post('/import-user', async (req, res) => {
    try {
        const { channels } = req.body;
        const userId = req.user.id;

        if (!channels || !Array.isArray(channels)) {
            return res.status(400).json({ success: false, error: 'Channels array is required' });
        }

        const User = require('../models/User');
        const mongoose = require('mongoose');

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const existingChannelIds = new Set(user.channels.map((id) => id.toString()));
        const channelIdsToAdd = [];

        for (const ch of channels) {
            try {
                let existingChannel = await Channel.findOne({ channelUrl: ch.url });

                if (existingChannel) {
                    const channelIdStr = existingChannel._id.toString();
                    if (!existingChannelIds.has(channelIdStr)) {
                        channelIdsToAdd.push(existingChannel._id);
                        existingChannelIds.add(channelIdStr);
                    }
                } else {
                    const newChannel = new Channel({
                        channelId: ch.id || `iptv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        channelName: ch.name,
                        channelUrl: ch.url,
                        channelImg: ch.logo || '',
                        tvgLogo: ch.logo || '',
                        channelGroup: ch.category || 'IPTV-org',
                        tvgName: ch.name || '',
                        metadata: { country: ch.country, language: ch.language },
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

// Helper function to parse M3U content (kept for potential future use)
function parseM3U(m3uContent) {
    const lines = m3uContent.split('\n');
    const channels = [];
    let currentChannel = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith('#EXTINF:')) {
            const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
            const tvgNameMatch = line.match(/tvg-name="([^"]*)"/);
            const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/);
            const groupTitleMatch = line.match(/group-title="([^"]*)"/);
            const channelNameMatch = line.match(/,(.+)$/);

            currentChannel = {
                channelId: tvgIdMatch ? tvgIdMatch[1] : null,
                tvgName: tvgNameMatch ? tvgNameMatch[1] : '',
                channelImg: tvgLogoMatch ? tvgLogoMatch[1] : '',
                tvgLogo: tvgLogoMatch ? tvgLogoMatch[1] : '',
                channelGroup: groupTitleMatch ? groupTitleMatch[1] : 'Uncategorized',
                channelName: channelNameMatch ? channelNameMatch[1].trim() : 'Unknown',
            };
        } else if (line && !line.startsWith('#') && currentChannel) {
            currentChannel.channelUrl = line;
            if (!currentChannel.channelId) {
                currentChannel.channelId = `iptv_${channels.length}_${Date.now()}`;
            }
            channels.push(currentChannel);
            currentChannel = null;
        }
    }

    return channels;
}

module.exports = router;
