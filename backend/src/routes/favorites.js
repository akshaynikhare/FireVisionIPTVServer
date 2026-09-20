const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { requireTvOrSessionAuth } = require('../middleware/requireTvOrSessionAuth');

// Sync favorites from TV app or web UI
router.post('/', requireTvOrSessionAuth, async (req, res) => {
  try {
    const { channel_ids, device_id, revision } = req.body;

    if (!Array.isArray(channel_ids)) {
      return res.status(400).json({
        success: false,
        error: 'channel_ids must be an array',
      });
    }

    // Ordering is by a server-issued revision, never by client wall clocks — devices whose
    // clocks disagree would otherwise silently discard each other's legitimate updates.
    // Omitting `revision` keeps the old last-write-wins behaviour for existing TV clients.
    if (revision !== undefined && (!Number.isSafeInteger(revision) || revision < 0)) {
      return res
        .status(400)
        .json({ success: false, error: 'revision must be a non-negative integer' });
    }

    const filter = { _id: req.user.id };
    if (revision !== undefined) {
      filter.$or =
        revision === 0
          ? [
              { 'metadata.favoritesRevision': { $exists: false } },
              { 'metadata.favoritesRevision': 0 },
            ]
          : [{ 'metadata.favoritesRevision': revision }];
    }

    const now = Date.now();
    const user = await User.findOneAndUpdate(
      filter,
      {
        $set: {
          'metadata.favorites': channel_ids,
          'metadata.favoritesLastModified': now,
          ...(device_id ? { 'metadata.favoritesDeviceId': device_id } : {}),
        },
        $inc: { 'metadata.favoritesRevision': 1 },
      },
      { new: true },
    );

    if (!user) {
      const current = await User.findById(req.user.id);
      if (!current) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      // Conflict, not success — the caller has to reconcile rather than keep its own state.
      return res.status(409).json({
        success: false,
        error: 'Favorites were modified by another device',
        channel_ids: current.metadata?.favorites || [],
        revision: current.metadata?.favoritesRevision || 0,
        timestamp: current.metadata?.favoritesLastModified || null,
      });
    }

    res.json({
      success: true,
      message: 'Favorites synced',
      revision: user.metadata?.favoritesRevision || 0,
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
      revision: user.metadata?.favoritesRevision || 0,
      timestamp: user.metadata?.favoritesLastModified || null,
    });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch favorites' });
  }
});

module.exports = router;
