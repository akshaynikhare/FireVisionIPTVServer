const express = require('express');
const router = express.Router();

// Get public configuration defaults
router.get('/defaults', async (req, res) => {
  try {
    // Only expose a code from an explicit, dedicated demo/public env var.
    // Never fall back to a real Admin account's channelListCode (a live credential).
    const defaultTvCode = process.env.DEFAULT_TV_CODE || process.env.DEMO_CHANNEL_LIST_CODE || '';

    const defaults = {
      defaultTvCode,
      defaultServerUrl: process.env.DEFAULT_SERVER_URL || 'https://tv.cadnative.com',
      pairingPinExpiryMinutes: parseInt(process.env.PAIRING_PIN_EXPIRY_MINUTES || '10', 10),
      appName: 'FireVision IPTV',
      version: '1.0.0',
      recaptchaSiteKey: process.env.GOOGLE_RECAPTCHA_SITE_KEY || null,
    };

    res.json({
      success: true,
      data: defaults,
    });
  } catch (error) {
    console.error('Error fetching config defaults:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch configuration',
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
        userManagement: true,
      },
    };

    res.json({
      success: true,
      data: info,
    });
  } catch (error) {
    console.error('Error fetching server info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch server info',
    });
  }
});

module.exports = router;
