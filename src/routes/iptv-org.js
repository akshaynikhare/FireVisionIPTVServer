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
let languagesCache = { data: null, timestamp: null };
let guidesCache = { data: null, timestamp: null };
let feedsCache = { data: null, timestamp: null };
const CACHE_TTL = 3600000; // 1 hour

// Clear cache endpoint
router.post('/clear-cache', async (req, res) => {
    try {
        channelsCache = { data: null, timestamp: null };
        streamsCache = { data: null, timestamp: null };
        languagesCache = { data: null, timestamp: null };
        guidesCache = { data: null, timestamp: null };
        feedsCache = { data: null, timestamp: null };

        res.json({
            success: true,
            message: 'Cache cleared successfully'
        });
    } catch (error) {
        console.error('Error clearing cache:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to clear cache'
        });
    }
});

// Get cache status
router.get('/cache-status', async (req, res) => {
    try {
        const now = Date.now();
        res.json({
            success: true,
            data: {
                channels: {
                    cached: !!channelsCache.data,
                    age: channelsCache.timestamp ? now - channelsCache.timestamp : null,
                    count: channelsCache.data ? channelsCache.data.length : 0
                },
                streams: {
                    cached: !!streamsCache.data,
                    age: streamsCache.timestamp ? now - streamsCache.timestamp : null,
                    count: streamsCache.data ? streamsCache.data.length : 0
                },
                languages: {
                    cached: !!languagesCache.data,
                    age: languagesCache.timestamp ? now - languagesCache.timestamp : null,
                    count: languagesCache.data ? languagesCache.data.length : 0
                },
                guides: {
                    cached: !!guidesCache.data,
                    age: guidesCache.timestamp ? now - guidesCache.timestamp : null,
                    count: guidesCache.data ? guidesCache.data.length : 0
                },
                feeds: {
                    cached: !!feedsCache.data,
                    age: feedsCache.timestamp ? now - feedsCache.timestamp : null,
                    count: feedsCache.data ? feedsCache.data.length : 0
                },
                ttl: CACHE_TTL
            }
        });
    } catch (error) {
        console.error('Error getting cache status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get cache status'
        });
    }
});

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
        const { country, category, language, limit = 100 } = req.query;

        // Fetch channels, streams, and languages data
        const [channelsData, streamsData, languagesData] = await Promise.all([
            fetchChannelsData(),
            fetchStreamsData(),
            fetchLanguagesData()
        ]);

        // Create maps for quick lookup
        const channelsMap = new Map();
        channelsData.forEach(channel => {
            channelsMap.set(channel.id, channel);
        });

        const languagesMap = new Map();
        languagesData.forEach(lang => {
            languagesMap.set(lang.code, lang);
        });

        // Merge streams with channel metadata
        let enrichedChannels = streamsData.map(stream => {
            const channelMeta = channelsMap.get(stream.channel) || {};

            // Get language names from codes
            const languageNames = channelMeta.languages?.map(langCode => {
                const lang = languagesMap.get(langCode);
                return lang ? lang.name : langCode;
            }) || [];

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
                channelLanguages: channelMeta.languages || [],
                channelLanguageNames: languageNames,
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

        // Filter by language (supports both language codes and names)
        if (language) {
            enrichedChannels = enrichedChannels.filter(ch => {
                const langLower = language.toLowerCase();
                // Check language codes
                const hasLangCode = ch.channelLanguages?.some(code =>
                    code.toLowerCase() === langLower
                );
                // Check language names
                const hasLangName = ch.channelLanguageNames?.some(name =>
                    name.toLowerCase().includes(langLower)
                );
                return hasLangCode || hasLangName;
            });
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

// Helper function to fetch languages data (with caching)
async function fetchLanguagesData() {
    if (languagesCache.data && (Date.now() - languagesCache.timestamp) < CACHE_TTL) {
        return languagesCache.data;
    }

    const response = await axios.get(`${IPTV_ORG_API_BASE}/languages.json`, {
        timeout: 30000
    });

    languagesCache.data = response.data;
    languagesCache.timestamp = Date.now();

    return response.data;
}

// Helper function to fetch guides data (with caching)
async function fetchGuidesData() {
    if (guidesCache.data && (Date.now() - guidesCache.timestamp) < CACHE_TTL) {
        return guidesCache.data;
    }

    console.log('Fetching guides.json from IPTV-org API...');
    const response = await axios.get(`${IPTV_ORG_API_BASE}/guides.json`, {
        timeout: 60000, // Longer timeout as this is a large file
        maxContentLength: 100 * 1024 * 1024, // 100MB limit
        maxBodyLength: 100 * 1024 * 1024
    });

    guidesCache.data = response.data;
    guidesCache.timestamp = Date.now();
    console.log(`Fetched ${response.data.length} guide entries`);

    return response.data;
}

// Helper function to fetch feeds data (with caching)
async function fetchFeedsData() {
    if (feedsCache.data && (Date.now() - feedsCache.timestamp) < CACHE_TTL) {
        return feedsCache.data;
    }

    console.log('Fetching feeds.json from IPTV-org API...');
    const response = await axios.get(`${IPTV_ORG_API_BASE}/feeds.json`, {
        timeout: 30000
    });

    feedsCache.data = response.data;
    feedsCache.timestamp = Date.now();
    console.log(`Fetched ${response.data.length} feed entries`);

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

// Fetch languages from IPTV-org API
router.get('/api/languages', async (req, res) => {
    try {
        const response = await axios.get(`${IPTV_ORG_API_BASE}/languages.json`, {
            timeout: 30000
        });

        res.json({
            success: true,
            count: response.data.length,
            data: response.data
        });
    } catch (error) {
        console.error('Error fetching IPTV-org languages:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch languages from IPTV-org API'
        });
    }
});

// Fetch available playlists from IPTV-org
router.get('/playlists', async (req, res) => {
    try {
        // We use the IPTV-org API (channels.json, streams.json, languages.json)
        // and filter on the backend. These playlists define the filter parameters.
        // Reference: https://github.com/iptv-org/api

        const playlists = [
            // 1. India playlist with Hindi, English, and Marathi content
            {
                id: 'india-all',
                name: 'India - All',
                description: 'Indian channels (Hindi, English, Marathi)',
                type: 'custom',
                filter: { country: 'IN', languages: ['hin', 'eng', 'mar'] }
            },

            // 2. Kids content in Hindi and English
            {
                id: 'kids-hindi',
                name: 'Kids (Hindi & English)',
                description: 'Kids channels in Hindi',
                type: 'custom',
                filter: { category: 'kids', languages: ['hin'] }
            },
            {
                id: 'kids-english',
                name: 'Kids (Hindi & English)',
                description: 'Kids channels in English',
                type: 'custom',
                filter: { category: 'kids', languages: ['eng'] }
            },

            // 3. News in Hindi, English, and Marathi for India
            {
                id: 'news-india',
                name: 'News - India',
                description: 'Indian news (Hindi, English, Marathi)',
                type: 'custom',
                filter: { country: 'IN', category: 'news', languages: ['hin', 'eng', 'mar'] }
            },

            // 4. News in English (all countries)
            {
                id: 'news-english',
                name: 'News - English',
                description: 'English news channels',
                type: 'custom',
                filter: { category: 'news', language: 'eng' }
            },

            // Additional useful playlists
            {
                id: 'india-hindi',
                name: 'India - Hindi',
                description: 'Indian Hindi channels',
                type: 'country-language',
                filter: { country: 'IN', language: 'hin' }
            },
            {
                id: 'india-english',
                name: 'India - English',
                description: 'Indian English channels',
                type: 'country-language',
                filter: { country: 'IN', language: 'eng' }
            },
            {
                id: 'india-marathi',
                name: 'India - Marathi',
                description: 'Indian Marathi channels',
                type: 'country-language',
                filter: { country: 'IN', language: 'mar' }
            },
            {
                id: 'movies-hindi',
                name: 'Movies - Hindi',
                description: 'Hindi movie channels',
                type: 'category-language',
                filter: { category: 'movies', language: 'hin' }
            },
            {
                id: 'entertainment-hindi',
                name: 'Entertainment - Hindi',
                description: 'Hindi entertainment channels',
                type: 'category-language',
                filter: { category: 'entertainment', language: 'hin' }
            },
            {
                id: 'sports-india',
                name: 'Sports - India',
                description: 'Indian sports channels',
                type: 'country-category',
                filter: { country: 'IN', category: 'sports' }
            },
            {
                id: 'music-india',
                name: 'Music - India',
                description: 'Indian music channels',
                type: 'country-category',
                filter: { country: 'IN', category: 'music' }
            }
        ];

        res.json({
            success: true,
            count: playlists.length,
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

// Fetch and parse a specific playlist with enriched metadata
router.get('/fetch', async (req, res) => {
    try {
        // Accept filters via query parameters
        const { country, language, languages, category } = req.query;

        const countryFilter = country ? country.toUpperCase() : null;

        // Support both single language and multiple languages
        let languageFilters = [];
        if (languages) {
            // Parse languages array from query string (comma-separated or JSON)
            try {
                languageFilters = Array.isArray(languages) ? languages :
                                 languages.includes(',') ? languages.split(',').map(l => l.trim().toLowerCase()) :
                                 JSON.parse(languages).map(l => l.toLowerCase());
            } catch (e) {
                languageFilters = [languages.toLowerCase()];
            }
        } else if (language) {
            languageFilters = [language.toLowerCase()];
        }

        const categoryFilter = category ? category.toLowerCase() : null;

        if (countryFilter) {
            console.log(`Filtering by country: ${countryFilter}`);
        }
        if (languageFilters.length > 0) {
            console.log(`Filtering by languages: ${languageFilters.join(', ')}`);
        }
        if (categoryFilter) {
            console.log(`Filtering by category: ${categoryFilter}`);
        }

        // Fetch enriched data from our API
        const [channelsData, streamsData, languagesData, guidesData, feedsData] = await Promise.all([
            fetchChannelsData(),
            fetchStreamsData(),
            fetchLanguagesData(),
            fetchGuidesData(),
            fetchFeedsData()
        ]);

        // Brief data summary logging
        console.log(`Data loaded: ${channelsData.length} channels, ${streamsData.length} streams, ${languagesData.length} languages`);

        // Create maps for quick lookup
        const channelsMap = new Map();
        channelsData.forEach(channel => {
            channelsMap.set(channel.id, channel);
        });

        const languagesMap = new Map();
        languagesData.forEach(lang => {
            languagesMap.set(lang.code, lang);
        });

        // Create a map of channel ID to languages from guides data
        // The guides.json contains entries like: {"channel":"ChannelID.country","lang":"en"}
        const channelToLanguagesMap = new Map();
        guidesData.forEach(guide => {
            if (guide.channel && guide.lang) {
                if (!channelToLanguagesMap.has(guide.channel)) {
                    channelToLanguagesMap.set(guide.channel, new Set());
                }
                channelToLanguagesMap.get(guide.channel).add(guide.lang);
            }
        });

        console.log(`Built language mapping for ${channelToLanguagesMap.size} channels from guides data`);

        // Create a map of channel ID to languages from feeds data
        // The feeds.json contains entries like: {"channel":"France3.fr","languages":["fra"]}
        const feedsLanguagesMap = new Map();
        feedsData.forEach(feed => {
            if (feed.channel && feed.languages && Array.isArray(feed.languages)) {
                if (!feedsLanguagesMap.has(feed.channel)) {
                    feedsLanguagesMap.set(feed.channel, new Set());
                }
                feed.languages.forEach(lang => {
                    feedsLanguagesMap.get(feed.channel).add(lang);
                });
            }
        });

        console.log(`Built language mapping for ${feedsLanguagesMap.size} channels from feeds data`);

        // Map 2-letter language codes to 3-letter ISO 639-3 codes
        const lang2to3Map = {
            'en': 'eng', 'hi': 'hin', 'es': 'spa', 'fr': 'fra', 'de': 'deu',
            'it': 'ita', 'pt': 'por', 'ru': 'rus', 'ja': 'jpn', 'ko': 'kor',
            'zh': 'zho', 'ar': 'ara', 'tr': 'tur', 'nl': 'nld', 'pl': 'pol',
            'sv': 'swe', 'no': 'nor', 'da': 'dan', 'fi': 'fin', 'cs': 'ces',
            'el': 'ell', 'he': 'heb', 'id': 'ind', 'ms': 'msa', 'th': 'tha',
            'vi': 'vie', 'uk': 'ukr', 'ro': 'ron', 'hu': 'hun', 'sk': 'slk',
            'bg': 'bul', 'hr': 'hrv', 'sr': 'srp', 'sl': 'slv', 'et': 'est',
            'lv': 'lav', 'lt': 'lit', 'ur': 'urd', 'bn': 'ben', 'ta': 'tam',
            'te': 'tel', 'mr': 'mar', 'ml': 'mal', 'kn': 'kan', 'gu': 'guj',
            'pa': 'pan', 'tl': 'tgl', 'fa': 'fas', 'ka': 'kat', 'hy': 'hye'
        };

        // Enrich streams with all metadata
        let enrichedChannels = streamsData
            .filter(stream => stream.channel) // Only include streams with valid channel ID
            .map(stream => {
                const channelMeta = channelsMap.get(stream.channel) || {};

                // Get language codes using multiple sources with priority order
                let languageCodes = [];

                // 1. Try to get languages from feeds data (most accurate, already 3-letter codes)
                if (feedsLanguagesMap.has(stream.channel)) {
                    languageCodes = Array.from(feedsLanguagesMap.get(stream.channel));
                }

                // 2. Try to get languages from guides data (2-letter codes, need conversion)
                if (languageCodes.length === 0 && channelToLanguagesMap.has(stream.channel)) {
                    const guideLangs = Array.from(channelToLanguagesMap.get(stream.channel));
                    // Convert 2-letter codes to 3-letter codes
                    languageCodes = guideLangs.map(lang2 => lang2to3Map[lang2] || lang2);
                }

                // 3. Fallback to channel metadata if available
                if (languageCodes.length === 0 && channelMeta.languages) {
                    languageCodes = channelMeta.languages;
                }

                // Get language names from codes
                const languageNames = languageCodes.map(langCode => {
                    const lang = languagesMap.get(langCode);
                    return lang ? lang.name : langCode;
                });

                return {
                    // For compatibility with existing frontend
                    channelId: stream.channel || `stream_${Math.random()}`,
                    channelName: channelMeta.name || stream.title || 'Unknown',
                    channelUrl: stream.url,
                    tvgId: stream.channel,
                    tvgName: channelMeta.name || stream.title,
                    tvgLogo: channelMeta.logo || null,

                    // Group/Category - Frontend expects 'channelGroup'
                    channelGroup: channelMeta.categories?.[0] || 'Uncategorized',
                    groupTitle: channelMeta.categories?.[0] || 'Uncategorized',

                    // Country - Frontend expects 'tvgCountry'
                    tvgCountry: channelMeta.country || null,
                    country: channelMeta.country || null,
                    countryCode: channelMeta.country || null,

                    // Language - Frontend expects 'tvgLanguage'
                    tvgLanguage: languageNames.join(', ') || null,
                    language: languageNames.join(', ') || null,
                    languages: languageNames,
                    languageCodes: languageCodes,

                    // Additional metadata
                    channelImg: channelMeta.logo || null,
                    streamQuality: stream.quality,
                    streamUserAgent: stream.user_agent,
                    streamReferrer: stream.referrer,
                    channelCategories: channelMeta.categories || [],
                    channelWebsite: channelMeta.website,
                    channelNetwork: channelMeta.network,
                    channelIsNsfw: channelMeta.is_nsfw || false,

                    // All categories for filtering
                    categories: channelMeta.categories || []
                };
            });

        // Debug: Count how many channels got languages from each source
        const channelsWithFeedsLangs = enrichedChannels.filter(ch =>
            feedsLanguagesMap.has(ch.channelId)
        ).length;
        const channelsWithGuideLangs = enrichedChannels.filter(ch =>
            !feedsLanguagesMap.has(ch.channelId) && channelToLanguagesMap.has(ch.channelId)
        ).length;
        const channelsWithMetadata = enrichedChannels.filter(ch =>
            !feedsLanguagesMap.has(ch.channelId) && !channelToLanguagesMap.has(ch.channelId) && ch.languageCodes.length > 0
        ).length;
        const channelsWithNoLanguage = enrichedChannels.filter(ch => ch.languageCodes.length === 0).length;
        console.log(`Language sources: ${channelsWithFeedsLangs} from feeds, ${channelsWithGuideLangs} from guides, ${channelsWithMetadata} from channel metadata, ${channelsWithNoLanguage} without language info`);

        // Apply filters based on URL
        const totalBeforeFilter = enrichedChannels.length;

        if (countryFilter) {
            enrichedChannels = enrichedChannels.filter(ch =>
                ch.tvgCountry?.toUpperCase() === countryFilter
            );
            console.log(`Country filter (${countryFilter}): ${totalBeforeFilter} -> ${enrichedChannels.length} channels`);
        }

        if (languageFilters.length > 0) {
            const beforeLangFilter = enrichedChannels.length;

            enrichedChannels = enrichedChannels.filter(ch => {
                // Channel matches if it has ANY of the requested languages
                const hasLang = ch.languageCodes?.some(code =>
                    languageFilters.includes(code.toLowerCase())
                );
                return hasLang;
            });
            console.log(`Language filter (${languageFilters.join(', ')}): ${beforeLangFilter} -> ${enrichedChannels.length} channels`);
        }

        if (categoryFilter) {
            const beforeCatFilter = enrichedChannels.length;
            enrichedChannels = enrichedChannels.filter(ch => {
                // Match if category name matches or contains the filter
                const hasCategory = ch.channelCategories?.some(cat => {
                    const normalizedCat = cat.toLowerCase().replace(/\s+/g, '-');
                    const catLower = cat.toLowerCase();
                    return normalizedCat === categoryFilter ||
                           catLower === categoryFilter ||
                           catLower.includes(categoryFilter) ||
                           categoryFilter.includes(catLower);
                });
                return hasCategory;
            });
            console.log(`Category filter (${categoryFilter}): ${beforeCatFilter} -> ${enrichedChannels.length} channels`);
        }

        res.json({
            success: true,
            count: enrichedChannels.length,
            data: enrichedChannels,
            filters: {
                country: countryFilter,
                languages: languageFilters,
                category: categoryFilter
            }
        });
    } catch (error) {
        console.error('Error fetching IPTV-org playlist:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch playlist'
        });
    }
});

// Import selected channels from IPTV-org (admin only)
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

// Import selected channels from IPTV-org to user's playlist
router.post('/import-user', async (req, res) => {
    console.log('🔵 /import-user endpoint called');
    console.log('👤 User ID:', req.user?.id);
    console.log('📦 Request body:', req.body);
    
    try {
        const { channels } = req.body;
        const userId = req.user.id;

        if (!channels || !Array.isArray(channels)) {
            console.error('❌ Channels validation failed:', { channels: channels?.length });
            return res.status(400).json({
                success: false,
                error: 'Channels array is required'
            });
        }

        console.log(`📋 Processing ${channels.length} channels for user ${userId}`);

        const User = require('../models/User');
        const mongoose = require('mongoose');

        const user = await User.findById(userId);
        if (!user) {
            console.error('❌ User not found:', userId);
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        console.log(`✅ User found: ${user.username}, existing channels: ${user.channels.length}`);

        const existingChannelIds = new Set(user.channels.map(id => id.toString()));
        const channelIdsToAdd = [];

        for (const ch of channels) {
            try {
                // Check if channel already exists in system by URL
                let existingChannel = await Channel.findOne({ channelUrl: ch.url });

                if (existingChannel) {
                    // Channel exists, add its ID to user's list if not already there
                    const channelIdStr = existingChannel._id.toString();
                    if (!existingChannelIds.has(channelIdStr)) {
                        channelIdsToAdd.push(existingChannel._id);
                        existingChannelIds.add(channelIdStr);
                        console.log(`♻️ Reusing existing channel: ${ch.name}`);
                    } else {
                        console.log(`⏭️ Skipping duplicate: ${ch.name}`);
                    }
                } else {
                    // Create new channel in system
                    const newChannel = new Channel({
                        channelId: ch.id || `iptv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        channelName: ch.name,
                        channelUrl: ch.url,
                        channelImg: ch.logo || '',
                        tvgLogo: ch.logo || '',
                        channelGroup: ch.category || 'IPTV-org',
                        tvgName: ch.name || '',
                        metadata: {
                            country: ch.country,
                            language: ch.language
                        }
                    });

                    await newChannel.save();
                    channelIdsToAdd.push(newChannel._id);
                    existingChannelIds.add(newChannel._id.toString());
                    console.log(`➕ Created new channel: ${ch.name}`);
                }
            } catch (error) {
                console.error('❌ Error processing channel:', ch.name, error.message);
                // Continue with next channel
            }
        }

        // Add all new channels to user's list
        if (channelIdsToAdd.length > 0) {
            console.log(`📝 Before save - user channels count: ${user.channels.length}`);
            user.channels.push(...channelIdsToAdd);
            console.log(`📝 After push - user channels count: ${user.channels.length}`);
            await user.save();
            console.log(`✅ Saved! User ${user.username} now has ${user.channels.length} channels`);
            
            // Verify the save worked
            const verifyUser = await User.findById(userId);
            console.log(`✅ Verification: User ${verifyUser.username} has ${verifyUser.channels.length} channels in DB`);
        } else {
            console.log('⚠️ No new channels to add');
        }

        res.json({
            success: true,
            addedCount: channelIdsToAdd.length,
            totalChannels: user.channels.length,
            message: `Added ${channelIdsToAdd.length} channels to your list`
        });
    } catch (error) {
        console.error('❌ Error importing channels for user:', error);
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
