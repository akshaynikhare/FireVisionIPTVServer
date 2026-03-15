const express = require('express');
const router = express.Router();

// Get public configuration defaults
router.get('/defaults', async (req, res) => {
    try {
        const defaults = {
            defaultTvCode: process.env.DEFAULT_TV_CODE || process.env.SUPER_ADMIN_CHANNEL_LIST_CODE || '5T6FEP',
            defaultServerUrl: process.env.DEFAULT_SERVER_URL || 'https://tv.cadnative.com',
            pairingPinExpiryMinutes: parseInt(process.env.PAIRING_PIN_EXPIRY_MINUTES || '10', 10),
            appName: 'FireVision IPTV',
            version: '1.0.0'
        };
        
        res.json({
            success: true,
            data: defaults
        });
    } catch (error) {
        console.error('Error fetching config defaults:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch configuration'
        });
    }
});

// Get server info (public endpoint)
router.get('/info', async (req, res) => {
    try {
        const info = {
            name: 'FireVision IPTV Server',
            version: '1.0.0',
            status: 'online',
            features: {
                channelStreaming: true,
                pinBasedPairing: true,
                autoUpdates: true,
                userManagement: true
            }
        };
        
        res.json({
            success: true,
            data: info
        });
    } catch (error) {
        console.error('Error fetching server info:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch server info'
        });
    }
});

module.exports = router;
