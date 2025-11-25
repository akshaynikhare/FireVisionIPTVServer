const express = require('express');
const router = express.Router();
const Channel = require('../models/Channel');

// Get all channels (for Android app sync)
router.get('/', async (req, res) => {
  try {
    const channels = await Channel.find({})
      .sort({ channelGroup: 1, order: 1 })
      .select('-__v -createdAt -updatedAt')
      .lean();

    res.json({
      success: true,
      count: channels.length,
      data: channels
    });
  } catch (error) {
    console.error('Error fetching channels:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch channels'
    });
  }
});

// Get channels grouped by category
router.get('/grouped', async (req, res) => {
  try {
    const channels = await Channel.find({})
      .sort({ channelGroup: 1, order: 1 })
      .lean();

    // Group by channelGroup
    const grouped = channels.reduce((acc, channel) => {
      const group = channel.channelGroup || 'Uncategorized';
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(channel);
      return acc;
    }, {});

    res.json({
      success: true,
      data: grouped
    });
  } catch (error) {
    console.error('Error fetching grouped channels:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch grouped channels'
    });
  }
});

// Get M3U playlist (requires playlist code)
router.get('/playlist.m3u', async (req, res) => {
  try {
    // Check for playlist code in query parameter or header
    const providedCode = req.query.code || req.headers['x-playlist-code'];
    const requiredCode = process.env.PLAYLIST_CODE;

    // Validate playlist code
    if (!requiredCode) {
      console.error('PLAYLIST_CODE not configured in environment variables');
      return res.status(500).json({
        success: false,
        error: 'Playlist access not configured'
      });
    }

    if (!providedCode) {
      return res.status(401).json({
        success: false,
        error: 'Playlist code required. Provide code via ?code=YOUR_CODE or X-Playlist-Code header'
      });
    }

    if (providedCode !== requiredCode) {
      return res.status(403).json({
        success: false,
        error: 'Invalid playlist code'
      });
    }

    // Generate and send playlist
    const m3uContent = await Channel.generateM3UPlaylist();

    res.setHeader('Content-Type', 'application/x-mpegurl');
    res.setHeader('Content-Disposition', 'attachment; filename="playlist.m3u"');
    res.send(m3uContent);
  } catch (error) {
    console.error('Error generating M3U playlist:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate M3U playlist'
    });
  }
});

// Search channels
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const channels = await Channel.find({
      $or: [
        { channelName: { $regex: q, $options: 'i' } },
        { channelGroup: { $regex: q, $options: 'i' } },
        { channelId: { $regex: q, $options: 'i' } }
      ]
    })
      .sort({ channelGroup: 1, order: 1 })
      .select('-__v -createdAt -updatedAt')
      .lean();

    res.json({
      success: true,
      count: channels.length,
      data: channels
    });
  } catch (error) {
    console.error('Error searching channels:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search channels'
    });
  }
});

// Get channel by ID
router.get('/:id', async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.id).lean();

    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }

    res.json({
      success: true,
      data: channel
    });
  } catch (error) {
    console.error('Error fetching channel:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch channel'
    });
  }
});

module.exports = router;
