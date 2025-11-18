const express = require('express');
const router = express.Router();
const axios = require('axios');
const Channel = require('../models/Channel');
const { requireAuth } = require('./auth');

// Apply authentication to all routes
router.use(requireAuth);

// IPTV-org API base URL
const IPTV_ORG_API_BASE = 'https://iptv-org.github.io/api';

// Cache for API data (to avoid repeated fetches)
let channelsCache = { data: null, timestamp: null };
let streamsCache = { data: null, timestamp: null };
const CACHE_TTL = 3600000; // 1 hour

// Fetch channels metadata from IPTV-org API
router.get('/api/channels', async (req, res) => {
    try {
        // Check cache
        if (channelsCache.data && (Date.now() - channelsCache.timestamp) < CACHE_TTL) {
            return res.json({
                success: true,
                count: channelsCache.data.length,
                cached: true,
                data: channelsCache.data
            });
        }

        // Fetch from API
        const response = await axios.get(`${IPTV_ORG_API_BASE}/channels.json`, {
            timeout: 30000
        });

        channelsCache.data = response.data;
        channelsCache.timestamp = Date.now();

        res.json({
            success: true,
            count: response.data.length,
            cached: false,
            data: response.data
        });
    } catch (error) {
        console.error('Error fetching IPTV-org channels:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch channels from IPTV-org API'
        });
    }
});

// Fetch streams from IPTV-org API
router.get('/api/streams', async (req, res) => {
    try {
        const { country, category, limit } = req.query;

        // Check cache
        if (streamsCache.data && (Date.now() - streamsCache.timestamp) < CACHE_TTL) {
            let streams = streamsCache.data;

            // Filter if needed
            if (country || category) {
                streams = await filterStreams(streams, country, category);
            }

            // Limit results
            if (limit) {
                streams = streams.slice(0, parseInt(limit));
            }

            return res.json({
                success: true,
                count: streams.length,
                cached: true,
                data: streams
            });
        }

        // Fetch from API
        const response = await axios.get(`${IPTV_ORG_API_BASE}/streams.json`, {
            timeout: 30000
        });

        streamsCache.data = response.data;
        streamsCache.timestamp = Date.now();

        let streams = response.data;

        // Filter if needed
        if (country || category) {
            streams = await filterStreams(streams, country, category);
        }

        // Limit results
        if (limit) {
            streams = streams.slice(0, parseInt(limit));
        }

        res.json({
            success: true,
            count: streams.length,
            cached: false,
            data: streams
        });
    } catch (error) {
        console.error('Error fetching IPTV-org streams:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch streams from IPTV-org API'
        });
    }
});

// Get enriched channels (merged channels + streams data)
router.get('/api/enriched', async (req, res) => {
    try {
        const { country, category, limit = 100 } = req.query;

        // Fetch both channels and streams
        const [channelsData, streamsData] = await Promise.all([
            fetchChannelsData(),
            fetchStreamsData()
        ]);

        // Create a map of channels by ID for quick lookup
        const channelsMap = new Map();
        channelsData.forEach(channel => {
            channelsMap.set(channel.id, channel);
        });

        // Merge streams with channel metadata
        let enrichedChannels = streamsData.map(stream => {
            const channelMeta = channelsMap.get(stream.channel) || {};

            return {
                // Stream info
                streamUrl: stream.url,
                streamTitle: stream.title,
                streamQuality: stream.quality,
                streamUserAgent: stream.user_agent,
                streamReferrer: stream.referrer,

                // Channel metadata
                channelId: stream.channel,
                channelName: channelMeta.name || stream.title || 'Unknown',
                channelCountry: channelMeta.country,
                channelCategories: channelMeta.categories || [],
                channelWebsite: channelMeta.website,
                channelNetwork: channelMeta.network,
                channelIsNsfw: channelMeta.is_nsfw || false,
                channelLaunched: channelMeta.launched,
                channelLogo: null, // Will be enriched from other sources if available

                // Combined data for easy use
                tvgId: stream.channel,
                tvgName: channelMeta.name || stream.title,
                tvgLogo: null,
                groupTitle: channelMeta.categories?.[0] || 'Uncategorized'
            };
        });

        // Filter by country
        if (country) {
            enrichedChannels = enrichedChannels.filter(ch =>
                ch.channelCountry?.toUpperCase() === country.toUpperCase()
            );
        }

        // Filter by category
        if (category) {
            enrichedChannels = enrichedChannels.filter(ch =>
                ch.channelCategories?.some(cat =>
                    cat.toLowerCase().includes(category.toLowerCase())
                )
            );
        }

        // Limit results
        enrichedChannels = enrichedChannels.slice(0, parseInt(limit));

        res.json({
            success: true,
            count: enrichedChannels.length,
            data: enrichedChannels
        });
    } catch (error) {
        console.error('Error fetching enriched channels:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch enriched channels'
        });
    }
});

// Helper function to fetch channels data (with caching)
async function fetchChannelsData() {
    if (channelsCache.data && (Date.now() - channelsCache.timestamp) < CACHE_TTL) {
        return channelsCache.data;
    }

    const response = await axios.get(`${IPTV_ORG_API_BASE}/channels.json`, {
        timeout: 30000
    });

    channelsCache.data = response.data;
    channelsCache.timestamp = Date.now();

    return response.data;
}

// Helper function to fetch streams data (with caching)
async function fetchStreamsData() {
    if (streamsCache.data && (Date.now() - streamsCache.timestamp) < CACHE_TTL) {
        return streamsCache.data;
    }

    const response = await axios.get(`${IPTV_ORG_API_BASE}/streams.json`, {
        timeout: 30000
    });

    streamsCache.data = response.data;
    streamsCache.timestamp = Date.now();

    return response.data;
}

// Helper function to filter streams
async function filterStreams(streams, country, category) {
    if (!country && !category) return streams;

    const channelsData = await fetchChannelsData();
    const channelsMap = new Map();
    channelsData.forEach(ch => channelsMap.set(ch.id, ch));

    return streams.filter(stream => {
        const channel = channelsMap.get(stream.channel);
        if (!channel) return false;

        if (country && channel.country?.toUpperCase() !== country.toUpperCase()) {
            return false;
        }

        if (category && !channel.categories?.some(cat =>
            cat.toLowerCase().includes(category.toLowerCase())
        )) {
            return false;
        }

        return true;
    });
}

// Fetch available playlists from IPTV-org
router.get('/playlists', async (req, res) => {
    try {
        // IPTV-org provides categorized playlists
        const playlists = [
            {
                id: 'index.m3u',
                name: 'All Channels',
                description: 'Complete list of all channels',
                url: 'https://iptv-org.github.io/iptv/index.m3u',
                count: null
            },
            {
                id: 'index.country.m3u',
                name: 'By Country',
                description: 'Channels grouped by country',
                url: 'https://iptv-org.github.io/iptv/index.country.m3u',
                count: null
            },
            {
                id: 'index.category.m3u',
                name: 'By Category',
                description: 'Channels grouped by category',
                url: 'https://iptv-org.github.io/iptv/index.category.m3u',
                count: null
            },
            {
                id: 'index.language.m3u',
                name: 'By Language',
                description: 'Channels grouped by language',
                url: 'https://iptv-org.github.io/iptv/index.language.m3u',
                count: null
            }
        ];

        res.json({
            success: true,
            data: playlists
        });
    } catch (error) {
        console.error('Error fetching playlists:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch playlists'
        });
    }
});

// Fetch and parse a specific playlist
router.get('/fetch', async (req, res) => {
    try {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL parameter is required'
            });
        }

        // Fetch the M3U content
        const m3uContent = await fetchUrl(url);

        // Parse M3U content
        const channels = parseM3U(m3uContent);

        res.json({
            success: true,
            count: channels.length,
            data: channels
        });
    } catch (error) {
        console.error('Error fetching IPTV-org playlist:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch playlist'
        });
    }
});

// Import selected channels from IPTV-org
router.post('/import', async (req, res) => {
    try {
        const { channels, replaceExisting } = req.body;

        if (!channels || !Array.isArray(channels)) {
            return res.status(400).json({
                success: false,
                error: 'Channels array is required'
            });
        }

        let imported = 0;
        let skipped = 0;
        let errors = [];

        if (replaceExisting) {
            // Delete existing channels
            await Channel.deleteMany({});
        }

        for (const channelData of channels) {
            try {
                const channel = new Channel({
                    channelId: channelData.channelId || `iptv_${Date.now()}_${Math.random()}`,
                    channelName: channelData.channelName,
                    channelUrl: channelData.channelUrl,
                    channelImg: channelData.channelImg || channelData.tvgLogo || '',
                    channelGroup: channelData.channelGroup || 'Uncategorized',
                    tvgName: channelData.tvgName || '',
                    tvgLogo: channelData.tvgLogo || '',
                    isActive: true,
                    order: imported
                });

                await channel.save();
                imported++;
            } catch (error) {
                if (error.code === 11000) {
                    // Duplicate key, skip
                    skipped++;
                } else {
                    errors.push({
                        channel: channelData.channelName,
                        error: error.message
                    });
                }
            }
        }

        res.json({
            success: true,
            imported,
            skipped,
            errors: errors.length > 0 ? errors : undefined,
            message: `Successfully imported ${imported} channels, skipped ${skipped} duplicates`
        });
    } catch (error) {
        console.error('Error importing channels:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to import channels'
        });
    }
});

// Helper function to fetch URL content
async function fetchUrl(url) {
    const response = await axios.get(url, {
        timeout: 30000,
        responseType: 'text'
    });
    return response.data;
}

// Helper function to parse M3U content
function parseM3U(m3uContent) {
    const lines = m3uContent.split('\n');
    const channels = [];
    let currentChannel = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith('#EXTINF:')) {
            // Parse channel metadata
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
                channelName: channelNameMatch ? channelNameMatch[1].trim() : 'Unknown'
            };
        } else if (line && !line.startsWith('#') && currentChannel) {
            // This is the stream URL
            currentChannel.channelUrl = line;

            // Generate ID if not present
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
