const express = require('express');
const router = express.Router();
const { requireAuth } = require('./auth');
const { requireAdmin } = require('../middleware/requireAdmin');
const { epgService } = require('../services/epg-service');

router.use(requireAuth);
router.use(requireAdmin);

// Get EPG status and stats
router.get('/status', async (req, res) => {
    try {
        const stats = await epgService.getStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('Error fetching EPG stats:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch EPG stats' });
    }
});

// Trigger immediate EPG refresh
router.post('/refresh', async (req, res) => {
    try {
        // Start refresh in background, respond immediately
        epgService.refreshEpg().catch((err) => {
            console.error('Manual EPG refresh failed:', err.message);
        });

        res.json({
            success: true,
            message: 'EPG refresh started. Check /status for progress.',
        });
    } catch (error) {
        console.error('Error triggering EPG refresh:', error);
        res.status(500).json({ success: false, error: 'Failed to trigger EPG refresh' });
    }
});

// Get discovered EPG sources (for debugging/visibility)
router.get('/sources', async (req, res) => {
    try {
        const sources = await epgService.discoverEpgSources();
        res.json({
            success: true,
            count: sources.length,
            data: sources.map((s) => ({
                url: s.url,
                source: s.source,
                coveredChannels: s.coveredChannelIds.length,
            })),
        });
    } catch (error) {
        console.error('Error discovering EPG sources:', error);
        res.status(500).json({ success: false, error: 'Failed to discover EPG sources' });
    }
});

module.exports = router;
