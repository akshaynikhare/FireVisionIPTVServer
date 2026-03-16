const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Get public configuration defaults
router.get('/defaults', async (req, res) => {
    try {
        // Try env vars first, then fall back to the actual super admin's code from DB
        let defaultTvCode = process.env.DEFAULT_TV_CODE || process.env.SUPER_ADMIN_CHANNEL_LIST_CODE;
        if (!defaultTvCode) {
            const superAdmin = await User.findOne({ role: 'Admin', isActive: true }).sort({ createdAt: 1 });
            defaultTvCode = superAdmin?.channelListCode || '';
        }

        const defaults = {
            defaultTvCode,
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
