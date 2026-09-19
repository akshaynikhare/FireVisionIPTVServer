const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { requireTvOrSessionAuth } = require('../middleware/requireTvOrSessionAuth');

// Sync favorites from TV app or web UI
router.post('/', requireTvOrSessionAuth, async (req, res) => {
  try {
    const { channel_ids, device_id, timestamp: clientTimestamp } = req.body;

    if (!Array.isArray(channel_ids)) {
      return res.status(400).json({
        success: false,
        error: 'channel_ids must be an array',
      });
    }

    const timestamp = Number(clientTimestamp || Date.now());
    if (!Number.isSafeInteger(timestamp) || timestamp <= 0) {
      return res
        .status(400)
        .json({ success: false, error: 'timestamp must be a positive integer' });
    }

    const now = Date.now();
    const user = await User.findOneAndUpdate(
      {
        _id: req.user.id,
        $or: [
          { 'metadata.favoritesClientModified': { $exists: false } },
          { 'metadata.favoritesClientModified': { $lt: timestamp } },
        ],
      },
      {
        $set: {
          'metadata.favorites': channel_ids,
          'metadata.favoritesLastModified': now,
          'metadata.favoritesClientModified': timestamp,
          ...(device_id ? { 'metadata.favoritesDeviceId': device_id } : {}),
        },
      },
      { new: true },
    );
    if (!user && !(await User.exists({ _id: req.user.id }))) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({
      success: true,
      applied: Boolean(user),
      message: user ? 'Favorites synced' : 'Ignored stale favorites update',
      timestamp: now,
    });
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
      timestamp: user.metadata?.favoritesLastModified || null,
    });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch favorites' });
  }
});

module.exports = router;
