const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Channel = require('../models/Channel');
const { requireAuth } = require('./auth');

// Get current user's channels
router.get('/me/channels', requireAuth, async (req, res) => {
  try {
    console.log('🔵 GET /me/channels called for user:', req.user.id);
    const user = await User.findById(req.user.id).populate('channels', 'channelName channelGroup channelUrl tvgLogo channelImg metadata');
    if (!user) {
      console.error('❌ User not found:', req.user.id);
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    console.log(`✅ User: ${user.username}, Role: ${user.role}, Channels: ${user.channels?.length || 0}`);
    console.log('📋 Channel IDs in user.channels:', user.channels?.map(ch => ch._id || ch).slice(0, 3));
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
    if (!Array.isArray(channelIds)) return res.status(400).json({ success: false, error: 'channelIds must be an array' });

    // Validate channel IDs
    const channels = await Channel.find({ _id: { $in: channelIds } });
    if (channels.length !== channelIds.length) {
      return res.status(400).json({ success: false, error: 'Some channel IDs are invalid' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    user.channels = channelIds.map(id => new mongoose.Types.ObjectId(id));
    await user.save();

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
    if (!Array.isArray(channelIds)) return res.status(400).json({ success: false, error: 'channelIds must be an array' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const existingIds = new Set(user.channels.map(id => id.toString()));
    const validChannels = await Channel.find({ _id: { $in: channelIds } }).select('_id');
    const validIds = validChannels.map(c => c._id.toString());

    const toAdd = validIds.filter(id => !existingIds.has(id));
    user.channels.push(...toAdd.map(id => new mongoose.Types.ObjectId(id)));
    await user.save();

    res.json({ success: true, message: `Added ${toAdd.length} channels`, count: user.channels.length, addedCount: toAdd.length });
  } catch (error) {
    console.error('Add my channels error:', error);
    res.status(500).json({ success: false, error: 'Failed to add channels' });
  }
});

// Remove channels from current user
router.post('/me/channels/remove', requireAuth, async (req, res) => {
  try {
    const { channelIds } = req.body;
    if (!Array.isArray(channelIds)) return res.status(400).json({ success: false, error: 'channelIds must be an array' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const before = user.channels.length;
    const removeSet = new Set(channelIds.map(id => id.toString()));
    user.channels = user.channels.filter(id => !removeSet.has(id.toString()));
    await user.save();
    const removed = before - user.channels.length;

    res.json({ success: true, message: `Removed ${removed} channels`, count: user.channels.length, removedCount: removed });
  } catch (error) {
    console.error('Remove my channels error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove channels' });
  }
});

// Get current user's channel list as M3U
router.get('/me/playlist.m3u', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).send('#EXTM3U\n#ERROR:User not found');

    const m3u = await user.generateUserPlaylist();
    res.setHeader('Content-Type', 'audio/x-mpegurl');
    res.setHeader('Content-Disposition', `attachment; filename="${user.username}-channels.m3u"`);
    return res.send(m3u);
  } catch (error) {
    console.error('Generate user channels M3U error:', error);
    return res.status(500).send('#EXTM3U\n#ERROR:Internal server error');
  }
});

module.exports = router;
