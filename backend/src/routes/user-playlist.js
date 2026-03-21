const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Channel = require('../models/Channel');
const { requireAuth } = require('./auth');
const { audit } = require('../services/audit-log');

// Get current user's channels
router.get('/me/channels', requireAuth, async (req, res) => {
  try {
    console.log('🔵 GET /me/channels called for user:', req.user.id);
    const user = await User.findById(req.user.id).populate(
      'channels',
      'channelName channelGroup channelUrl tvgLogo channelImg metadata metrics flaggedBad alternateStreams',
    );
    if (!user) {
      console.error('❌ User not found:', req.user.id);
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    console.log(
      `✅ User: ${user.username}, Role: ${user.role}, Channels: ${user.channels?.length || 0}`,
    );
    console.log(
      '📋 Channel IDs in user.channels:',
      user.channels?.map((ch) => ch._id || ch).slice(0, 3),
    );
    res.json({ success: true, channels: user.channels || [] });
  } catch (error) {
    console.error('❌ Get my channels error:', error);
    res.status(500).json({ success: false, error: 'Failed to get channels' });
  }
});

// Set current user's channels (replace)
router.put('/me/channels', requireAuth, async (req, res) => {
  try {
    const { channelIds } = req.body;
    if (!Array.isArray(channelIds))
      return res.status(400).json({ success: false, error: 'channelIds must be an array' });

    // Validate all IDs are valid ObjectIds
    const invalidIds = channelIds.filter((id) => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({ success: false, error: 'Invalid channel ID format' });
    }

    // Validate channel IDs
    const channels = await Channel.find({ _id: { $in: channelIds } });
    if (channels.length !== channelIds.length) {
      return res.status(400).json({ success: false, error: 'Some channel IDs are invalid' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    user.channels = channelIds.map((id) => new mongoose.Types.ObjectId(id));
    await user.save();
    audit({
      userId: req.user.id,
      action: 'set_channels',
      resource: 'user_playlist',
      resourceId: String(req.user.id),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, message: 'Channels updated', count: user.channels.length });
  } catch (error) {
    console.error('Set my channels error:', error);
    res.status(500).json({ success: false, error: 'Failed to update channels' });
  }
});

// Add channels to current user
router.post('/me/channels/add', requireAuth, async (req, res) => {
  try {
    const { channelIds } = req.body;
    if (!Array.isArray(channelIds))
      return res.status(400).json({ success: false, error: 'channelIds must be an array' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const existingIds = new Set(user.channels.map((id) => id.toString()));
    const validChannels = await Channel.find({ _id: { $in: channelIds } }).select('_id');
    const validIds = validChannels.map((c) => c._id.toString());

    const toAdd = validIds.filter((id) => !existingIds.has(id));
    user.channels.push(...toAdd.map((id) => new mongoose.Types.ObjectId(id)));
    await user.save();
    audit({
      userId: req.user.id,
      action: 'add_channels',
      resource: 'user_playlist',
      resourceId: `${toAdd.length} channels`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: `Added ${toAdd.length} channels`,
      count: user.channels.length,
      addedCount: toAdd.length,
    });
  } catch (error) {
    console.error('Add my channels error:', error);
    res.status(500).json({ success: false, error: 'Failed to add channels' });
  }
});

// Remove channels from current user
router.post('/me/channels/remove', requireAuth, async (req, res) => {
  try {
    const { channelIds } = req.body;
    if (!Array.isArray(channelIds))
      return res.status(400).json({ success: false, error: 'channelIds must be an array' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const before = user.channels.length;
    const removeSet = new Set(channelIds.map((id) => id.toString()));
    user.channels = user.channels.filter((id) => !removeSet.has(id.toString()));
    await user.save();
    const removed = before - user.channels.length;
    audit({
      userId: req.user.id,
      action: 'remove_channels',
      resource: 'user_playlist',
      resourceId: `${removed} channels`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: `Removed ${removed} channels`,
      count: user.channels.length,
      removedCount: removed,
    });
  } catch (error) {
    console.error('Remove my channels error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove channels' });
  }
});

// Get current user's channels with viable fallback streams (for Android app)
router.get('/me/channels-with-fallbacks', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate(
      'channels',
      'channelName channelGroup channelUrl tvgLogo channelImg metadata flaggedBad alternateStreams',
    );
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const channels = (user.channels || []).map((ch) => {
      const channelObj = ch.toObject ? ch.toObject() : ch;
      // Filter alternates: only alive + non-flagged
      channelObj.alternateStreams = (channelObj.alternateStreams || []).filter(
        (alt) => alt.liveness?.status !== 'dead' && alt.flaggedBad?.isFlagged !== true,
      );
      return channelObj;
    });

    res.json({ success: true, channels });
  } catch (error) {
    console.error('Get channels with fallbacks error:', error);
    res.status(500).json({ success: false, error: 'Failed to get channels' });
  }
});

// Get current user's channel list as M3U
router.get('/me/playlist.m3u', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).send('#EXTM3U\n#ERROR:User not found');

    const m3u = await user.generateUserPlaylist();
    res.setHeader('Content-Type', 'audio/x-mpegurl');
    const safeUsername = user.username.replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="${safeUsername}-channels.m3u"`);
    return res.send(m3u);
  } catch (error) {
    console.error('Generate user channels M3U error:', error);
    return res.status(500).send('#EXTM3U\n#ERROR:Internal server error');
  }
});

// Import M3U to user's playlist
router.post('/me/import-m3u', requireAuth, async (req, res) => {
  try {
    const { m3uContent } = req.body;

    if (!m3uContent) {
      return res.status(400).json({
        success: false,
        error: 'M3U content is required',
      });
    }

    // Parse M3U content (same logic as admin import)
    const lines = m3uContent.split('\n');
    const parsedChannels = [];
    let currentChannel = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('#EXTINF:')) {
        const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
        const tvgNameMatch = line.match(/tvg-name="([^"]*)"/);
        const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/);
        const groupTitleMatch = line.match(/group-title="([^"]*)"/);
        const channelNameMatch = line.match(/,(.+)$/);

        currentChannel = {
          channelId: tvgIdMatch ? tvgIdMatch[1] : `channel_${Date.now()}_${i}`,
          tvgName: tvgNameMatch ? tvgNameMatch[1] : '',
          channelImg: tvgLogoMatch ? tvgLogoMatch[1] : '',
          tvgLogo: tvgLogoMatch ? tvgLogoMatch[1] : '',
          channelGroup: groupTitleMatch ? groupTitleMatch[1] : 'Uncategorized',
          channelName: channelNameMatch ? channelNameMatch[1].trim() : 'Unknown',
          order: parsedChannels.length,
        };
      } else if (line && !line.startsWith('#') && currentChannel) {
        currentChannel.channelUrl = line;
        parsedChannels.push(currentChannel);
        currentChannel = null;
      }
    }

    if (parsedChannels.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid channels found in M3U content',
      });
    }

    // Find existing channels by URL to avoid duplicates
    const urls = parsedChannels.map((ch) => ch.channelUrl);
    const existingChannels = await Channel.find({ channelUrl: { $in: urls } }).select(
      '_id channelUrl',
    );
    const existingUrlMap = new Map(existingChannels.map((ch) => [ch.channelUrl, ch._id]));

    // Create channels that don't exist yet
    const toCreate = parsedChannels.filter((ch) => !existingUrlMap.has(ch.channelUrl));
    let createdChannels = [];
    if (toCreate.length > 0) {
      createdChannels = await Channel.insertMany(toCreate, { ordered: false });
    }

    // Collect all channel IDs
    const allChannelIds = [
      ...existingChannels.map((ch) => ch._id),
      ...createdChannels.map((ch) => ch._id),
    ];

    // Add to user's playlist (skip already-added)
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const userChannelIds = new Set(user.channels.map((id) => id.toString()));
    const toAdd = allChannelIds.filter((id) => !userChannelIds.has(id.toString()));
    user.channels.push(...toAdd.map((id) => new mongoose.Types.ObjectId(id)));
    await user.save();

    audit({
      userId: req.user.id,
      action: 'import_m3u',
      resource: 'user_playlist',
      resourceId: `${toAdd.length} channels`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: `Added ${toAdd.length} channels to your list`,
      added: toAdd.length,
      count: user.channels.length,
    });
  } catch (error) {
    console.error('User import M3U error:', error);
    res.status(500).json({ success: false, error: 'Failed to import M3U' });
  }
});

module.exports = router;
