const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { requireTvOrSessionAuth } = require('../middleware/requireTvOrSessionAuth');

// Sync favorites from TV app
router.post('/', requireTvOrSessionAuth, async (req, res) => {
  try {
    const { channel_ids, device_id } = req.body;

    if (!Array.isArray(channel_ids)) {
      return res.status(400).json({
        success: false,
        error: 'channel_ids must be an array',
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    user.metadata = user.metadata || {};
    user.metadata.favorites = channel_ids;
    if (device_id) {
      user.metadata.favoritesDeviceId = device_id;
    }
    user.markModified('metadata');
    await user.save();

    res.json({ success: true, message: 'Favorites synced' });
  } catch (error) {
    console.error('Error syncing favorites:', error);
    res.status(500).json({ success: false, error: 'Failed to sync favorites' });
  }
});

// Get favorites for current user
router.get('/', requireTvOrSessionAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({
      success: true,
      channel_ids: user.metadata?.favorites || [],
    });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch favorites' });
  }
});

module.exports = router;
