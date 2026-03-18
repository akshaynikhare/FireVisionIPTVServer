import { iptvOrgCacheService } from './iptv-org-cache';
import { externalSourceCacheService } from './external-source-cache';
import { epgService } from './epg-service';
import { streamHealthService } from './stream-health-service';
import { ExternalSourceCacheMeta } from '../models/ExternalSourceCache';

export interface SubtaskResult {
  name: string;
  status: 'completed' | 'failed';
  durationMs: number;
  result?: any;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface TaskResult {
  summary: any;
  subtasks: SubtaskResult[];
}

export interface TaskDefinition {
  name: string;
  displayName: string;
  description: string;
  intervalMs: number;
  handler: () => Promise<TaskResult>;
}

const LIVENESS_INTERVAL = parseInt(process.env.LIVENESS_CHECK_INTERVAL_MS || '86400000', 10);
const EPG_INTERVAL = parseInt(process.env.EPG_REFRESH_INTERVAL_MS || '21600000', 10);
const CACHE_INTERVAL = parseInt(process.env.CACHE_REFRESH_INTERVAL_MS || '3600000', 10);
const STREAM_HEALTH_INTERVAL = parseInt(
  process.env.STREAM_HEALTH_CHECK_INTERVAL_MS || '14400000',
  10,
);

async function livenessHandler(): Promise<TaskResult> {
  const subtasks: SubtaskResult[] = [];

  // IPTV-org batch
  const iptvStart = Date.now();
  try {
    const result = await iptvOrgCacheService.runBatchLivenessCheck();
    subtasks.push({
      name: 'iptv-org',
      status: 'completed',
      durationMs: Date.now() - iptvStart,
      result,
    });
  } catch (err: any) {
    subtasks.push({
      name: 'iptv-org',
      status: 'failed',
      durationMs: Date.now() - iptvStart,
      error: err.message,
    });
  }

  // External sources — sequential per source+region
  try {
    const metas = await ExternalSourceCacheMeta.find({}, { source: 1, region: 1 }).lean();
    for (const { source, region } of metas) {
      const extStart = Date.now();
      try {
        const result = await externalSourceCacheService.runBatchLivenessCheck(source, region);
        subtasks.push({
          name: `${source}:${region}`,
          status: 'completed',
          durationMs: Date.now() - extStart,
          result,
        });
      } catch (err: any) {
        subtasks.push({
          name: `${source}:${region}`,
          status: 'failed',
          durationMs: Date.now() - extStart,
          error: err.message,
        });
      }
    }
  } catch (err: any) {
    subtasks.push({
      name: 'external-sources-query',
      status: 'failed',
      durationMs: 0,
      error: err.message,
    });
  }

  const completed = subtasks.filter((s) => s.status === 'completed').length;
  const failed = subtasks.filter((s) => s.status === 'failed').length;

  return {
    summary: { totalSubtasks: subtasks.length, completed, failed },
    subtasks,
  };
}

async function epgHandler(): Promise<TaskResult> {
  const start = Date.now();
  try {
    await epgService.refreshEpg();
    return {
      summary: { refreshed: true },
      subtasks: [{ name: 'epg-refresh', status: 'completed', durationMs: Date.now() - start }],
    };
  } catch (err: any) {
    return {
      summary: { refreshed: false },
      subtasks: [
        {
          name: 'epg-refresh',
          status: 'failed',
          durationMs: Date.now() - start,
          error: err.message,
        },
      ],
    };
  }
}

async function cacheRefreshHandler(): Promise<TaskResult> {
  const start = Date.now();
  try {
    const result = await iptvOrgCacheService.refreshCache();
    return {
      summary: result,
      subtasks: [
        { name: 'iptv-org-cache', status: 'completed', durationMs: Date.now() - start, result },
      ],
    };
  } catch (err: any) {
    return {
      summary: { refreshed: false },
      subtasks: [
        {
          name: 'iptv-org-cache',
          status: 'failed',
          durationMs: Date.now() - start,
          error: err.message,
        },
      ],
    };
  }
}

async function streamHealthHandler(): Promise<TaskResult> {
  const start = Date.now();
  try {
    const result = await streamHealthService.runHealthCheck();
    return {
      summary: result,
      subtasks: [
        {
          name: 'stream-health-check',
          status: 'completed',
          durationMs: Date.now() - start,
          result,
        },
      ],
    };
  } catch (err: any) {
    return {
      summary: { error: err.message },
      subtasks: [
        {
          name: 'stream-health-check',
          status: 'failed',
          durationMs: Date.now() - start,
          error: err.message,
        },
      ],
    };
  }
}

const tasks: TaskDefinition[] = [
  {
    name: 'liveness-check',
    displayName: 'Channel Liveness Check',
    description: 'Probe all cached streams to check if they are alive or dead',
    intervalMs: LIVENESS_INTERVAL,
    handler: livenessHandler,
  },
  {
    name: 'epg-refresh',
    displayName: 'EPG Guide Refresh',
    description: 'Fetch and update electronic program guide data',
    intervalMs: EPG_INTERVAL,
    handler: epgHandler,
  },
  {
    name: 'cache-refresh',
    displayName: 'IPTV-org Cache Refresh',
    description: 'Refresh the IPTV-org channel and stream cache from upstream',
    intervalMs: CACHE_INTERVAL,
    handler: cacheRefreshHandler,
  },
  {
    name: 'stream-health-check',
    displayName: 'Stream Health Check & Auto-Promotion',
    description:
      'Check primary streams with alternates, auto-promote alive alternates when primary is dead/flagged',
    intervalMs: STREAM_HEALTH_INTERVAL,
    handler: streamHealthHandler,
  },
];

export function getAllTasks(): TaskDefinition[] {
  return tasks;
}

export function getTask(name: string): TaskDefinition | undefined {
  return tasks.find((t) => t.name === name);
}

module.exports = { getAllTasks, getTask };
