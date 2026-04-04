const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const { escapeRegex } = require('../utils/escapeRegex');
const { requireAuth, requireAdmin } = require('./auth');

// All activity routes require admin
router.use(requireAuth, requireAdmin);

/**
 * GET /api/v1/activity
 * Paginated activity log with filters
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = '1',
      pageSize = '50',
      action,
      resource,
      userId,
      status,
      search,
      from,
      to,
    } = req.query;

    const filter = {};

    if (action) filter.action = action;
    if (resource) filter.resource = resource;
    if (userId) filter.userId = userId;
    if (status) filter.status = status;

    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(from);
      if (to) filter.timestamp.$lte = new Date(to);
    }

    if (search) {
      const escaped = escapeRegex(search);
      filter.$or = [
        { action: { $regex: escaped, $options: 'i' } },
        { resource: { $regex: escaped, $options: 'i' } },
        { resourceId: { $regex: escaped, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
    const limit = parseInt(pageSize, 10);

    const [logs, totalCount] = await Promise.all([
      AuditLog.find(filter)
        .populate('userId', 'username email profilePicture')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        logs,
        totalCount,
        page: parseInt(page, 10),
        pageSize: limit,
      },
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch activity logs' });
  }
});

/**
 * GET /api/v1/activity/recent
 * Recent activity for dashboard widget (last 15 entries)
 */
router.get('/recent', async (req, res) => {
  try {
    const logs = await AuditLog.find()
      .populate('userId', 'username email profilePicture')
      .sort({ timestamp: -1 })
      .limit(15)
      .lean();

    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch recent activity' });
  }
});

/**
 * GET /api/v1/activity/filter-options
 * Distinct values for filter dropdowns
 */
router.get('/filter-options', async (req, res) => {
  try {
    const [actions, resources] = await Promise.all([
      AuditLog.distinct('action'),
      AuditLog.distinct('resource'),
    ]);

    res.json({
      success: true,
      data: {
        action: actions.filter(Boolean).sort(),
        resource: resources.filter(Boolean).sort(),
        status: ['success', 'failure'],
      },
    });
  } catch (error) {
    console.error('Error fetching filter options:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch filter options' });
  }
});

module.exports = router;
