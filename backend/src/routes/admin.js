const express = require('express');
const router = express.Router();
const Channel = require('../models/Channel');
const AppVersion = require('../models/AppVersion');
const User = require('../models/User');
const Session = require('../models/Session');
const PairingRequest = require('../models/PairingRequest');
const { requireAuth, requireAdmin } = require('./auth');

// Apply session authentication and admin role check to all admin routes
router.use(requireAuth);
router.use(requireAdmin);

// ============ CHANNEL MANAGEMENT ============

// Create new channel
router.post('/channels', async (req, res) => {
  try {
    const channel = new Channel(req.body);
    await channel.save();

    res.status(201).json({
      success: true,
      data: channel
    });
  } catch (error) {
    console.error('Error creating channel:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create channel'
    });
  }
});

// Update channel
router.put('/channels/:id', async (req, res) => {
  try {
    const channel = await Channel.findByIdAndUpdate(
      req.params.id,
      req.body,
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
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update channel'
    });
  }
});

// Delete channel
router.delete('/channels/:id', async (req, res) => {
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

// Delete all channels
router.delete('/channels', async (req, res) => {
  try {
    const deleteResult = await Channel.deleteMany({});

    res.json({
      success: true,
      message: `Successfully deleted ${deleteResult.deletedCount} channels`,
      deletedCount: deleteResult.deletedCount
    });
  } catch (error) {
    console.error('Error deleting all channels:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete all channels'
    });
  }
});

// Bulk import channels from M3U
router.post('/channels/import-m3u', async (req, res) => {
  try {
    const { m3uContent, clearExisting } = req.body;

    if (!m3uContent) {
      return res.status(400).json({
        success: false,
        error: 'M3U content is required'
      });
    }

    // Clear existing channels if requested
    if (clearExisting) {
      await Channel.deleteMany({});
    }

    // Parse M3U content
    const lines = m3uContent.split('\n');
    const channels = [];
    let currentChannel = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('#EXTINF:')) {
        // Parse channel metadata
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
          order: channels.length
        };
      } else if (line && !line.startsWith('#') && currentChannel) {
        // This is the stream URL
        currentChannel.channelUrl = line;
        channels.push(currentChannel);
        currentChannel = null;
      }
    }

    // Insert channels into database
    const insertedChannels = await Channel.insertMany(channels, { ordered: false });

    res.json({
      success: true,
      message: `Successfully imported ${insertedChannels.length} channels`,
      count: insertedChannels.length
    });
  } catch (error) {
    console.error('Error importing M3U:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to import M3U'
    });
  }
});

// Get all channels (for admin)
router.get('/channels', async (req, res) => {
  try {
    const { group } = req.query;
    const filter = {};

    if (group) filter.channelGroup = group;

    const channels = await Channel.find(filter)
      .sort({ channelGroup: 1, order: 1 });

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

// ============ STATISTICS ============

// Detailed statistics endpoint
router.get('/stats/detailed', async (req, res) => {
  try {
    // Channel statistics
    const totalChannels = await Channel.countDocuments();
    const activeChannels = await Channel.countDocuments({ isActive: true });
    const inactiveChannels = await Channel.countDocuments({ isActive: false });
    const channelsByGroup = await Channel.aggregate([
      { $group: { _id: '$channelGroup', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // App version statistics
    const totalVersions = await AppVersion.countDocuments();
    const latestVersion = await AppVersion.getLatestVersion();

    // User statistics
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const recentUsers = await User.find()
      .select('username email role profilePicture createdAt lastLogin')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Session statistics
    const now = new Date();
    const activeSessions = await Session.find({ expiresAt: { $gt: now } })
      .populate('userId', 'username email profilePicture')
      .sort({ lastActivity: -1 })
      .limit(20)
      .lean();
    
    const totalSessions = await Session.countDocuments();
    const activeSessionCount = await Session.countDocuments({ expiresAt: { $gt: now } });

    // Sessions by location (based on IP)
    const sessionsByLocation = await Session.aggregate([
      { $match: { expiresAt: { $gt: now } } },
      { $group: { _id: { $ifNull: ['$location', 'Unknown'] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Pairing statistics
    const totalPairings = await PairingRequest.countDocuments();
    const pendingPairings = await PairingRequest.countDocuments({ status: 'pending', expiresAt: { $gt: now } });
    const completedPairings = await PairingRequest.countDocuments({ status: 'completed' });
    
    // Today's pairings count
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayPairingsCount = await PairingRequest.countDocuments({ createdAt: { $gte: startOfToday } });

    // Recent pairings
    const recentPairings = await PairingRequest.find()
      .populate('userId', 'username email')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Recent activity (combine various activities)
    const activities = [];

    // Add recent logins
    const recentLogins = await Session.find()
      .populate('userId', 'username')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    
    recentLogins.forEach(session => {
      activities.push({
        type: 'login',
        title: 'User Login',
        description: `${session.username || session.userId?.username || 'Unknown'} logged in`,
        timestamp: session.createdAt
      });
    });

    // Add recent registrations
    const recentRegistrations = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    
    recentRegistrations.forEach(user => {
      activities.push({
        type: 'register',
        title: 'New User',
        description: `${user.username} registered`,
        timestamp: user.createdAt
      });
    });

    // Add recent pairings to activity
    recentPairings.slice(0, 5).forEach(pairing => {
      activities.push({
        type: 'pairing',
        title: 'Device Pairing',
        description: `${pairing.deviceName || 'Device'} ${pairing.status} by ${pairing.userId?.username || 'Unknown'}`,
        timestamp: pairing.createdAt
      });
    });

    // Sort activities by timestamp
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Format active sessions with user info
    const formattedSessions = activeSessions.map(session => ({
      username: session.userId?.username || session.username,
      email: session.userId?.email || session.email,
      profilePicture: session.userId?.profilePicture,
      lastActivity: session.lastActivity,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      location: session.location || 'Unknown'
    }));

    // Format recent pairings with user info
    const formattedPairings = recentPairings.map(pairing => ({
      deviceName: pairing.deviceName,
      deviceModel: pairing.deviceModel,
      status: pairing.status,
      username: pairing.userId?.username,
      createdAt: pairing.createdAt,
      pairedAt: pairing.updatedAt
    }));

    res.json({
      success: true,
      data: {
        channels: {
          total: totalChannels,
          active: activeChannels,
          inactive: inactiveChannels,
          byGroup: channelsByGroup
        },
        app: {
          totalVersions,
          latestVersion
        },
        users: {
          total: totalUsers,
          active: activeUsers,
          recent: recentUsers
        },
        sessions: {
          total: totalSessions,
          active: activeSessionCount,
          activeSessions: formattedSessions,
          byLocation: sessionsByLocation
        },
        pairings: {
          total: totalPairings,
          pending: pendingPairings,
          completed: completedPairings,
          todayCount: todayPairingsCount,
          recent: formattedPairings
        },
        activity: activities.slice(0, 15)
      }
    });
  } catch (error) {
    console.error('Error fetching detailed stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch detailed statistics'
    });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const totalChannels = await Channel.countDocuments();
    const activeChannels = await Channel.countDocuments({ isActive: true });
    const inactiveChannels = await Channel.countDocuments({ isActive: false });
    const channelsByGroup = await Channel.aggregate([
      {
        $group: {
          _id: '$channelGroup',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    const totalVersions = await AppVersion.countDocuments();
    const latestVersion = await AppVersion.getLatestVersion();

    res.json({
      success: true,
      data: {
        channels: {
          total: totalChannels,
          active: activeChannels,
          inactive: inactiveChannels,
          byGroup: channelsByGroup
        },
        app: {
          totalVersions,
          latestVersion
        }
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

module.exports = router;
