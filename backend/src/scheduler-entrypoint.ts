import path from 'path';
import mongoose from 'mongoose';

// Load env vars (same path resolution as server.js)
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/firevision-iptv';

async function main() {
  console.log('[scheduler-entrypoint] Starting scheduler service...');

  // Connect to MongoDB
  await mongoose.connect(MONGODB_URI, {
    maxPoolSize: 5,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });
  console.log('[scheduler-entrypoint] Connected to MongoDB');

  // Initialize Redis (optional)
  try {
    const { getRedisClient } = require('./services/redis');
    getRedisClient();
  } catch {
    console.log('[scheduler-entrypoint] Redis not available, continuing without it');
  }

  // Start the scheduler (also recovers stale runs from previous crashes)
  const { schedulerService } = require('./services/scheduler-service');
  await schedulerService.start();

  console.log('[scheduler-entrypoint] Scheduler service running');
}

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`[scheduler-entrypoint] ${signal} received, shutting down...`);
  try {
    const { schedulerService } = require('./services/scheduler-service');
    schedulerService.stop();
  } catch {
    /* ignore */
  }
  try {
    const { closeRedis } = require('./services/redis');
    await closeRedis();
  } catch {
    /* ignore */
  }
  await mongoose.connection.close();
  console.log('[scheduler-entrypoint] Connections closed');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

main().catch((err) => {
  console.error('[scheduler-entrypoint] Fatal error:', err);
  process.exit(1);
});
