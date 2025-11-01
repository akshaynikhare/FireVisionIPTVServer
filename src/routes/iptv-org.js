const express = require('express');
const router = express.Router();
const https = require('https');
const Channel = require('../models/Channel');
const { requireAuth } = require('./auth');

// Apply authentication to all routes
router.use(requireAuth);

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
function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
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
