import Channel from '../models/Channel';
import { probeStream } from './stream-prober';
import type { IChannelDocument } from '@firevision/shared';

const BATCH_SIZE = 200;
const CONCURRENCY = parseInt(process.env.STREAM_HEALTH_CONCURRENCY || '10', 10);

interface HealthCheckResult {
  checked: number;
  promoted: number;
  allDead: number;
  flaggedSkipped: number;
}

class StreamHealthService {
  async runHealthCheck(): Promise<HealthCheckResult> {
    const stats: HealthCheckResult = {
      checked: 0,
      promoted: 0,
      allDead: 0,
      flaggedSkipped: 0,
    };

    // Only process channels that have alternate streams
    const totalCount = await Channel.countDocuments({
      'alternateStreams.0': { $exists: true },
    });

    if (totalCount === 0) {
      console.log('[stream-health] No channels with alternate streams, skipping');
      return stats;
    }

    console.log(
      `[stream-health] Starting health check for ${totalCount} channels with alternates (concurrency: ${CONCURRENCY})`,
    );

    let lastId: unknown = null;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const query: Record<string, unknown> = {
        'alternateStreams.0': { $exists: true },
      };
      if (lastId) query._id = { $gt: lastId };

      const batch = await Channel.find(query).sort({ _id: 1 }).limit(BATCH_SIZE);

      if (batch.length === 0) break;
      lastId = batch[batch.length - 1]._id;

      // Process batch with concurrency limit
      await this.parallelMap(
        batch,
        async (channel: IChannelDocument) => {
          try {
            const result = await this.checkAndPromote(channel);
            stats.checked++;
            if (result === 'promoted') stats.promoted++;
            else if (result === 'all-dead') stats.allDead++;
            else if (result === 'flagged-skipped') stats.flaggedSkipped++;
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[stream-health] Error checking channel ${channel.channelId}:`, message);
            stats.checked++;
          }
        },
        CONCURRENCY,
      );

      console.log(
        `[stream-health] Progress: ${stats.checked}/${totalCount} (${stats.promoted} promoted, ${stats.allDead} all-dead)`,
      );
    }

    console.log(
      `[stream-health] Complete: ${stats.checked} checked, ${stats.promoted} promoted, ${stats.allDead} all-dead, ${stats.flaggedSkipped} flagged-skipped`,
    );

    return stats;
  }

  private async checkAndPromote(
    channel: IChannelDocument,
  ): Promise<'ok' | 'promoted' | 'all-dead' | 'flagged-skipped'> {
    // Check if primary is dead or flagged
    const primaryDead = channel.metadata?.isWorking === false;
    const primaryFlagged = channel.flaggedBad?.isFlagged === true;

    if (!primaryDead && !primaryFlagged) {
      // Primary seems fine — probe to confirm
      try {
        const probeResult = await probeStream(channel.channelUrl, { timeout: 10000 });
        // Update primary liveness
        channel.metadata = channel.metadata || {};
        channel.metadata.isWorking = probeResult.status === 'alive';
        channel.metadata.lastTested = new Date();
        channel.metadata.responseTime = probeResult.responseTimeMs;
        await channel.save();

        if (probeResult.status === 'alive') return 'ok';
      } catch {
        // Probe failed — treat as dead, continue to check alternates
      }
    }

    // Primary is dead/flagged — find best alive, non-flagged alternate
    const alternates = channel.alternateStreams || [];
    if (alternates.length === 0) return 'all-dead';

    // Probe alternates to find a viable one
    let bestAlternate: { index: number; responseTimeMs: number } | null = null;

    for (let i = 0; i < alternates.length; i++) {
      const alt = alternates[i];

      // Skip flagged alternates
      if (alt.flaggedBad?.isFlagged) continue;

      try {
        const result = await probeStream(alt.streamUrl, {
          timeout: 10000,
          userAgent: alt.userAgent || undefined,
          referrer: alt.referrer || undefined,
        });

        // Update alternate liveness
        alt.liveness = {
          status: result.status,
          lastCheckedAt: new Date(),
          responseTimeMs: result.responseTimeMs,
          error: result.error,
        };

        if (result.status === 'alive') {
          if (!bestAlternate || result.responseTimeMs < bestAlternate.responseTimeMs) {
            bestAlternate = { index: i, responseTimeMs: result.responseTimeMs };
          }
        }
      } catch {
        alt.liveness = {
          status: 'dead',
          lastCheckedAt: new Date(),
          responseTimeMs: null,
          error: 'Probe failed',
        };
      }
    }

    if (!bestAlternate) {
      // All alternates are dead or flagged — save updated liveness and return
      await channel.save();
      const allFlagged = alternates.every((a) => a.flaggedBad?.isFlagged);
      return allFlagged ? 'flagged-skipped' : 'all-dead';
    }

    // Promote: swap primary URL with best alternate
    const promotedAlt = alternates[bestAlternate.index];
    const oldPrimaryUrl = channel.channelUrl;

    // Move current primary to alternates
    alternates[bestAlternate.index] = {
      ...alternates[bestAlternate.index],
      streamUrl: oldPrimaryUrl,
      demotedAt: new Date(),
      liveness: {
        status: 'dead',
        lastCheckedAt: new Date(),
        responseTimeMs: null,
        error: 'Demoted from primary',
      },
    };

    // Set new primary
    channel.channelUrl = promotedAlt.streamUrl;
    channel.metadata = channel.metadata || {};
    channel.metadata.isWorking = true;
    channel.metadata.lastTested = new Date();
    channel.metadata.responseTime = bestAlternate.responseTimeMs;

    // Clear primary flaggedBad since this is a new URL
    channel.flaggedBad = {
      isFlagged: false,
      reason: null,
      flaggedBy: null,
      flaggedAt: null,
    };

    await channel.save();

    console.log(
      `[stream-health] Promoted alternate for ${channel.channelId}: ${promotedAlt.streamUrl}`,
    );

    return 'promoted';
  }

  private async parallelMap<T>(
    items: T[],
    fn: (item: T) => Promise<void>,
    concurrency: number,
  ): Promise<void> {
    let index = 0;

    async function worker() {
      while (index < items.length) {
        const i = index++;
        await fn(items[i]);
      }
    }

    const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
    await Promise.all(workers);
  }
}

export const streamHealthService = new StreamHealthService();

module.exports = { streamHealthService, StreamHealthService };
