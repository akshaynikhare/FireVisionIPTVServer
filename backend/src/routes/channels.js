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

// Get M3U playlist (requires global playlist code - LEGACY ENDPOINT)
// Note: This is a legacy global playlist endpoint. 
// Users should use /api/v1/user-playlist/me/playlist.m3u with authentication instead.
// This endpoint uses PLAYLIST_CODE for backward compatibility.
router.get('/playlist.m3u', async (req, res) => {
  try {
    // Check for playlist code in query parameter or header
    const providedCode = req.query.code || req.headers['x-playlist-code'];
    const requiredCode = process.env.PLAYLIST_CODE || process.env.SUPER_ADMIN_CHANNEL_LIST_CODE;

    // Validate playlist code
    if (!requiredCode) {
      console.error('PLAYLIST_CODE or SUPER_ADMIN_CHANNEL_LIST_CODE not configured in environment variables');
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

// Create new channel
router.post('/', async (req, res) => {
  try {
    const channelData = req.body;
    
    // Check if channel with same ID already exists
    if (channelData.channelId) {
      const existing = await Channel.findOne({ channelId: channelData.channelId });
      if (existing) {
        return res.status(400).json({
          success: false,
          error: 'Channel with this ID already exists'
        });
      }
    }

    const channel = new Channel(channelData);
    await channel.save();

    res.status(201).json({
      success: true,
      data: channel
    });
  } catch (error) {
    console.error('Error creating channel:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create channel'
    });
  }
});

// Update channel
router.put('/:id', async (req, res) => {
  try {
    const channel = await Channel.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

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
    console.error('Error updating channel:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update channel'
    });
  }
});

// Delete channel
router.delete('/:id', async (req, res) => {
  try {
    const channel = await Channel.findByIdAndDelete(req.params.id);

    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }

    res.json({
      success: true,
      message: 'Channel deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting channel:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete channel'
    });
  }
});

// Test channel stream
router.post('/:id/test', async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.id);

    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }

    // Test the channel stream
    const axios = require('axios');
    let isWorking = false;
    let error = null;

    try {
      const response = await axios.head(channel.channelUrl, {
        timeout: 10000,
        maxRedirects: 5,
        validateStatus: (status) => status < 500
      });
      
      isWorking = response.status >= 200 && response.status < 400;
    } catch (err) {
      error = err.message;
      isWorking = false;
    }

    // Update channel test status
    channel.metadata = channel.metadata || {};
    channel.metadata.isWorking = isWorking;
    channel.metadata.lastTested = new Date();
    if (error) {
      channel.metadata.testError = error;
    } else {
      delete channel.metadata.testError;
    }
    
    await channel.save();

    res.json({
      success: true,
      data: {
        channelId: channel._id,
        channelName: channel.channelName,
        isWorking,
        testedAt: channel.metadata.lastTested,
        error: error || undefined
      }
    });
  } catch (error) {
    console.error('Error testing channel:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test channel'
    });
  }
});

// Get test status (for lock checking)
router.get('/test-status', async (req, res) => {
  try {
    // Simple implementation - can be enhanced with Redis for multi-instance deployments
    res.json({
      success: true,
      isLocked: false
    });
  } catch (error) {
    console.error('Error checking test status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check test status'
    });
  }
});

module.exports = router;
