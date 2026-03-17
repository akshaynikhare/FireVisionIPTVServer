const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('./auth');
const { schedulerService } = require('../services/scheduler-service');
const { audit } = require('../services/audit-log');

// All scheduler routes require admin
router.use(requireAuth);
router.use(requireAdmin);

// List all tasks with last run info + schedule config
router.get('/tasks', async (req, res) => {
  try {
    const tasks = await schedulerService.getTasksWithStatus();
    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error('Error fetching scheduler tasks:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tasks' });
  }
});

// Paginated run history
router.get('/runs', async (req, res) => {
  try {
    const { page, pageSize, taskName } = req.query;
    const result = await schedulerService.getRuns({
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
      taskName: taskName || undefined,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error fetching scheduler runs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch runs' });
  }
});

// Single run detail
router.get('/runs/:id', async (req, res) => {
  try {
    const run = await schedulerService.getRunById(req.params.id);
    if (!run) {
      return res.status(404).json({ success: false, error: 'Run not found' });
    }
    res.json({ success: true, data: run });
  } catch (error) {
    console.error('Error fetching run detail:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch run' });
  }
});

// Manual trigger
router.post('/trigger/:taskName', async (req, res) => {
  try {
    const { taskName } = req.params;

    audit({
      userId: req.user.id,
      action: 'trigger_scheduled_task',
      resource: 'scheduler',
      resourceId: taskName,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // Start execution in background, respond immediately
    const runPromise = schedulerService.executeTask(taskName, 'manual', req.user.id);

    // Wait briefly to catch immediate errors (unknown task, already running)
    const result = await Promise.race([
      runPromise.then((r) => ({ started: true, result: r })),
      new Promise((resolve) => setTimeout(() => resolve({ started: true, pending: true }), 500)),
    ]);

    res.json({ success: true, message: `Task '${taskName}' triggered`, data: result });
  } catch (error) {
    if (error.message?.includes('already running')) {
      return res.status(409).json({ success: false, error: error.message });
    }
    if (error.message?.includes('Unknown task')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    console.error('Error triggering task:', error);
    res.status(500).json({ success: false, error: 'Failed to trigger task' });
  }
});

module.exports = router;
