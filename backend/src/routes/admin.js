const express = require('express');
const router = express.Router();
const Channel = require('../models/Channel');
const AppVersion = require('../models/AppVersion');
const User = require('../models/User');
const Session = require('../models/Session');
const PairingRequest = require('../models/PairingRequest');
const { requireAuth, requireAdmin } = require('./auth');
const { escapeRegex } = require('../utils/escapeRegex');
const { audit } = require('../services/audit-log');
const AuditLog = require('../models/AuditLog');
const { ExternalSourceChannel } = require('../models/ExternalSourceCache');
const { ScheduledTaskRun } = require('../models/ScheduledTaskRun');

// Apply session authentication and admin role check to all admin routes
router.use(requireAuth);
router.use(requireAdmin);

// ============ CHANNEL MANAGEMENT ============

// Create new channel (with field whitelist to prevent mass assignment)
router.post('/channels', async (req, res) => {
  try {
    const {
      channelId,
      channelName,
      channelUrl,
      channelImg,
      tvgLogo,
      tvgName,
      tvgId,
      channelGroup,
      channelDrmKey,
      order,
      isActive,
      metadata,
    } = req.body;
    const channel = new Channel({
      channelId,
      channelName,
      channelUrl,
      channelImg,
      tvgLogo,
      tvgName,
      tvgId,
      channelGroup,
      channelDrmKey,
      order,
      isActive,
      metadata,
    });
    await channel.save();
    audit({
      userId: req.user.id,
      action: 'create_channel',
      resource: 'channel',
      resourceId: channel.channelId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      success: true,
      data: channel,
    });
  } catch (error) {
    console.error('Error creating channel:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to create channel',
    });
  }
});

// Update channel
router.put('/channels/:id', async (req, res) => {
  try {
    const {
      channelId,
      channelName,
      channelUrl,
      channelImg,
      tvgLogo,
      tvgName,
      tvgId,
      channelGroup,
      channelDrmKey,
      order,
      isActive,
      metadata,
      alternateStreams,
      flaggedBad,
    } = req.body;
    const allowedUpdates = {};
    if (channelId !== undefined) allowedUpdates.channelId = channelId;
    if (channelName !== undefined) allowedUpdates.channelName = channelName;
    if (channelUrl !== undefined) allowedUpdates.channelUrl = channelUrl;
    if (channelImg !== undefined) allowedUpdates.channelImg = channelImg;
    if (tvgLogo !== undefined) allowedUpdates.tvgLogo = tvgLogo;
    if (tvgName !== undefined) allowedUpdates.tvgName = tvgName;
    if (tvgId !== undefined) allowedUpdates.tvgId = tvgId;
    if (channelGroup !== undefined) allowedUpdates.channelGroup = channelGroup;
    if (channelDrmKey !== undefined) allowedUpdates.channelDrmKey = channelDrmKey;
    if (order !== undefined) allowedUpdates.order = order;
    if (isActive !== undefined) allowedUpdates.isActive = isActive;
    if (alternateStreams !== undefined) allowedUpdates.alternateStreams = alternateStreams;
    if (flaggedBad !== undefined) allowedUpdates.flaggedBad = flaggedBad;
    if (metadata !== undefined) {
      // Merge metadata fields individually to preserve existing values (e.g. isWorking, lastTested)
      for (const [key, value] of Object.entries(metadata)) {
        allowedUpdates[`metadata.${key}`] = value;
      }
    }

    const channel = await Channel.findByIdAndUpdate(
      req.params.id,
      { $set: allowedUpdates },
      { new: true, runValidators: true },
    );

    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found',
      });
    }

    audit({
      userId: req.user.id,
      action: 'update_channel',
      resource: 'channel',
      resourceId: channel.channelId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      data: channel,
    });
  } catch (error) {
    console.error('Error updating channel:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to update channel',
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
        error: 'Channel not found',
      });
    }

    audit({
      userId: req.user.id,
      action: 'delete_channel',
      resource: 'channel',
      resourceId: channel.channelId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'Channel deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting channel:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete channel',
    });
  }
});

// Delete all channels
router.delete('/channels', async (req, res) => {
  try {
    const deleteResult = await Channel.deleteMany({});

    audit({
      userId: req.user.id,
      action: 'delete_all_channels',
      resource: 'channel',
      resourceId: `${deleteResult.deletedCount} channels`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: `Successfully deleted ${deleteResult.deletedCount} channels`,
      deletedCount: deleteResult.deletedCount,
    });
  } catch (error) {
    console.error('Error deleting all channels:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete all channels',
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
        error: 'M3U content is required',
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
          order: channels.length,
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

    audit({
      userId: req.user.id,
      action: 'import_m3u',
      resource: 'channel',
      resourceId: `${insertedChannels.length} channels`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: `Successfully imported ${insertedChannels.length} channels`,
      count: insertedChannels.length,
    });
  } catch (error) {
    console.error('Error importing M3U:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to import M3U',
    });
  }
});

// Diagnostic: alternate streams stats
router.get('/channels/alternates-stats', async (req, res) => {
  try {
    const [stats] = await Channel.aggregate([
      {
        $project: {
          hasAlternates: {
            $gt: [{ $size: { $ifNull: ['$alternateStreams', []] } }, 0],
          },
          alternateCount: { $size: { $ifNull: ['$alternateStreams', []] } },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          withAlternates: { $sum: { $cond: ['$hasAlternates', 1, 0] } },
          totalAlternateStreams: { $sum: '$alternateCount' },
        },
      },
    ]);
    res.json({
      success: true,
      data: stats
        ? {
            totalChannels: stats.total,
            channelsWithAlternates: stats.withAlternates,
            channelsWithoutAlternates: stats.total - stats.withAlternates,
            totalAlternateStreams: stats.totalAlternateStreams,
          }
        : {
            totalChannels: 0,
            channelsWithAlternates: 0,
            channelsWithoutAlternates: 0,
            totalAlternateStreams: 0,
          },
    });
  } catch (error) {
    console.error('Error fetching alternates stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch alternates stats' });
  }
});

// Get distinct filter options for channels
router.get('/channels/filter-options', async (req, res) => {
  try {
    const [groups, languages, countries] = await Promise.all([
      Channel.distinct('channelGroup'),
      Channel.distinct('metadata.language'),
      Channel.distinct('metadata.country'),
    ]);
    const statuses = ['Live', 'Dead'];

    res.json({
      success: true,
      data: {
        group: groups.filter(Boolean).sort((a, b) => a.localeCompare(b)),
        status: statuses,
        language: languages.filter(Boolean).sort((a, b) => a.localeCompare(b)),
        country: countries.filter(Boolean).sort((a, b) => a.localeCompare(b)),
      },
    });
  } catch (error) {
    console.error('Error fetching channel filter options:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch filter options' });
  }
});

// Get all channels (for admin) with server-side filtering & pagination
router.get('/channels', async (req, res) => {
  try {
    const { group, status, language, country, search, page, pageSize } = req.query;
    const filter = {};

    // Multi-value group filter (comma-separated)
    if (group) {
      const groups = group
        .split(',')
        .map((g) => g.trim())
        .filter(Boolean);
      if (groups.length > 0) filter.channelGroup = { $in: groups };
    }

    // Status filter: Active = isWorking !== false, Down = isWorking === false
    if (status) {
      const statuses = status
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (statuses.length === 1) {
        if (statuses[0] === 'Dead') {
          filter['metadata.isWorking'] = false;
        } else if (statuses[0] === 'Live') {
          filter['metadata.isWorking'] = { $ne: false };
        }
      }
      // If both are selected, no filter needed (show all)
    }

    // Language filter
    if (language) {
      const langs = language
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean);
      if (langs.length > 0) filter['metadata.language'] = { $in: langs };
    }

    // Country filter
    if (country) {
      const countries = country
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
      if (countries.length > 0) filter['metadata.country'] = { $in: countries };
    }

    // Text search across name and group
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ channelName: regex }, { channelGroup: regex }];
    }

    const p = parseInt(page, 10) || 1;
    const ps = Math.min(parseInt(pageSize, 10) || 50, 200);

    const [channels, totalCount] = await Promise.all([
      Channel.find(filter)
        .sort({ channelGroup: 1, order: 1 })
        .skip((p - 1) * ps)
        .limit(ps),
      Channel.countDocuments(filter),
    ]);

    res.json({
      success: true,
      count: channels.length,
      totalCount,
      page: p,
      pageSize: ps,
      data: channels,
    });
  } catch (error) {
    console.error('Error fetching channels:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch channels',
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
      { $sort: { count: -1 } },
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
      { $limit: 10 },
    ]);

    // Pairing statistics
    const totalPairings = await PairingRequest.countDocuments();
    const pendingPairings = await PairingRequest.countDocuments({
      status: 'pending',
      expiresAt: { $gt: now },
    });
    const completedPairings = await PairingRequest.countDocuments({ status: 'completed' });

    // Today's pairings count
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayPairingsCount = await PairingRequest.countDocuments({
      createdAt: { $gte: startOfToday },
    });

    // Recent pairings
    const recentPairings = await PairingRequest.find()
      .populate('userId', 'username email')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Recent activity from audit log
    const auditLogs = await AuditLog.find()
      .populate('userId', 'username')
      .sort({ timestamp: -1 })
      .limit(15)
      .lean();

    const activities = auditLogs.map((log) => ({
      type: log.action,
      title: log.action,
      description: `${log.userId?.username || 'System'} — ${log.action.replace(/_/g, ' ')} (${log.resource}${log.resourceId ? ': ' + log.resourceId : ''})`,
      timestamp: log.timestamp,
    }));

    // Format active sessions with user info
    const formattedSessions = activeSessions.map((session) => ({
      username: session.userId?.username || session.username,
      email: session.userId?.email || session.email,
      profilePicture: session.userId?.profilePicture,
      lastActivity: session.lastActivity,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      location: session.location || 'Unknown',
    }));

    // Format recent pairings with user info
    const formattedPairings = recentPairings.map((pairing) => ({
      deviceName: pairing.deviceName,
      deviceModel: pairing.deviceModel,
      status: pairing.status,
      username: pairing.userId?.username,
      createdAt: pairing.createdAt,
      pairedAt: pairing.updatedAt,
    }));

    res.json({
      success: true,
      data: {
        channels: {
          total: totalChannels,
          active: activeChannels,
          inactive: inactiveChannels,
          byGroup: channelsByGroup,
        },
        app: {
          totalVersions,
          latestVersion,
        },
        users: {
          total: totalUsers,
          active: activeUsers,
          recent: recentUsers,
        },
        sessions: {
          total: totalSessions,
          active: activeSessionCount,
          activeSessions: formattedSessions,
          byLocation: sessionsByLocation,
        },
        pairings: {
          total: totalPairings,
          pending: pendingPairings,
          completed: completedPairings,
          todayCount: todayPairingsCount,
          recent: formattedPairings,
        },
        activity: activities.slice(0, 15),
      },
    });
  } catch (error) {
    console.error('Error fetching detailed stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch detailed statistics',
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
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
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
          byGroup: channelsByGroup,
        },
        app: {
          totalVersions,
          latestVersion,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
    });
  }
});

// ============ STATS TRENDS ============

router.get('/stats/trends/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const range = req.query.range || '30d';

    const rangeMap = { '7d': 7, '30d': 30, '90d': 90 };
    const days = rangeMap[range] || 30;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    let model;
    let dateField;

    switch (type) {
      case 'users':
        model = User;
        dateField = 'createdAt';
        break;
      case 'sessions':
        model = Session;
        dateField = 'createdAt';
        break;
      case 'pairings':
        model = PairingRequest;
        dateField = 'createdAt';
        break;
      default:
        return res
          .status(400)
          .json({ success: false, error: 'Invalid trend type. Use: users, sessions, pairings' });
    }

    const pipeline = [
      { $match: { [dateField]: { $gte: startDate } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: `$${dateField}` },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const results = await model.aggregate(pipeline);

    const dataMap = {};
    results.forEach((r) => {
      dataMap[r._id] = r.count;
    });

    const data = [];
    const cursor = new Date(startDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    while (cursor <= today) {
      const key = cursor.toISOString().slice(0, 10);
      data.push({ date: key, count: dataMap[key] || 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching trend stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch trend statistics' });
  }
});

// ============ STREAM HEALTH ============

router.get('/stats/stream-health', async (req, res) => {
  try {
    // Channel health (local channels)
    const [channelHealth] = await Channel.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          working: { $sum: { $cond: [{ $eq: ['$metadata.isWorking', true] }, 1, 0] } },
          failing: { $sum: { $cond: [{ $eq: ['$metadata.isWorking', false] }, 1, 0] } },
          untested: {
            $sum: { $cond: [{ $eq: ['$metadata.isWorking', null] }, 1, 0] },
          },
          avgResponseTime: { $avg: '$metadata.responseTime' },
          totalDeadCount: { $sum: { $ifNull: ['$metrics.deadCount', 0] } },
          totalAliveCount: { $sum: { $ifNull: ['$metrics.aliveCount', 0] } },
          totalUnresponsiveCount: { $sum: { $ifNull: ['$metrics.unresponsiveCount', 0] } },
          totalPlayCount: { $sum: { $ifNull: ['$metrics.playCount', 0] } },
          totalProxyPlayCount: { $sum: { $ifNull: ['$metrics.proxyPlayCount', 0] } },
        },
      },
    ]);

    // Streams ranked by failure frequency (top 10 most failing)
    const mostFailing = await Channel.find({ 'metrics.deadCount': { $gt: 0 } })
      .sort({ 'metrics.deadCount': -1 })
      .limit(10)
      .select('channelId channelName channelGroup metrics')
      .lean();

    // Streams ranked by popularity (top 10 most played)
    const mostPopular = await Channel.find({ 'metrics.playCount': { $gt: 0 } })
      .sort({ 'metrics.playCount': -1 })
      .limit(10)
      .select('channelId channelName channelGroup metrics')
      .lean();

    // Streams with high failures but zero plays (removal candidates)
    const removalCandidates = await Channel.find({
      'metrics.deadCount': { $gt: 0 },
      $or: [{ 'metrics.playCount': { $exists: false } }, { 'metrics.playCount': 0 }],
    })
      .sort({ 'metrics.deadCount': -1 })
      .limit(10)
      .select('channelId channelName channelGroup metrics')
      .lean();

    // Streams with unresponsive issues
    const unresponsiveStreams = await Channel.find({ 'metrics.unresponsiveCount': { $gt: 0 } })
      .sort({ 'metrics.unresponsiveCount': -1 })
      .limit(10)
      .select('channelId channelName channelGroup metrics')
      .lean();

    // External source health (aggregated per source)
    const externalHealth = await ExternalSourceChannel.aggregate([
      {
        $group: {
          _id: '$source',
          total: { $sum: 1 },
          alive: { $sum: { $cond: [{ $eq: ['$liveness.status', 'alive'] }, 1, 0] } },
          dead: { $sum: { $cond: [{ $eq: ['$liveness.status', 'dead'] }, 1, 0] } },
          unknown: { $sum: { $cond: [{ $eq: ['$liveness.status', 'unknown'] }, 1, 0] } },
          avgResponseTime: { $avg: '$liveness.responseTimeMs' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        channels: channelHealth || {
          total: 0,
          working: 0,
          failing: 0,
          untested: 0,
          avgResponseTime: null,
          totalDeadCount: 0,
          totalAliveCount: 0,
          totalUnresponsiveCount: 0,
          totalPlayCount: 0,
          totalProxyPlayCount: 0,
        },
        metrics: {
          mostFailing,
          mostPopular,
          removalCandidates,
          unresponsiveStreams,
        },
        external: externalHealth,
      },
    });
  } catch (error) {
    console.error('Error fetching stream health:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stream health' });
  }
});

// ============ SCHEDULER HISTORY ============

router.get('/stats/scheduler', async (req, res) => {
  try {
    // Get the most recent run for each task
    const latestRuns = await ScheduledTaskRun.aggregate([
      { $sort: { startedAt: -1 } },
      {
        $group: {
          _id: '$taskName',
          lastRun: { $first: '$$ROOT' },
        },
      },
      { $replaceRoot: { newRoot: '$lastRun' } },
      { $sort: { startedAt: -1 } },
    ]);

    // Get success/fail counts per task (last 50 runs each)
    const taskStats = await ScheduledTaskRun.aggregate([
      { $sort: { startedAt: -1 } },
      {
        $group: {
          _id: '$taskName',
          totalRuns: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
          avgDuration: { $avg: '$durationMs' },
        },
      },
    ]);

    const statsMap = {};
    taskStats.forEach((s) => {
      statsMap[s._id] = {
        totalRuns: s.totalRuns,
        completed: s.completed,
        failed: s.failed,
        avgDuration: s.avgDuration,
      };
    });

    const tasks = latestRuns.map((run) => ({
      taskName: run.taskName,
      lastStatus: run.status,
      lastStartedAt: run.startedAt,
      lastDurationMs: run.durationMs,
      lastError: run.error,
      ...(statsMap[run.taskName] || {}),
    }));

    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error('Error fetching scheduler stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch scheduler stats' });
  }
});

module.exports = router;
