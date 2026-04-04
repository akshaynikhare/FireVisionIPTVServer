import { execFile } from 'child_process';

const YT_DLP_TIMEOUT = 30_000;
const YT_DLP_CONCURRENCY = parseInt(process.env.YT_DLP_CONCURRENCY || '3', 10);
const STREAM_EXPIRY_HOURS = 5;

interface ResolveResult {
  url: string;
  expiresAt: Date;
}

class YtDlpResolver {
  async resolveStreamUrl(ytChannelId: string): Promise<ResolveResult | null> {
    // Validate channel ID: alphanumeric, hyphens, underscores, optional leading @
    const VALID_CHANNEL_ID = /^@?[a-zA-Z0-9_-]+$/;
    if (!ytChannelId || !VALID_CHANNEL_ID.test(ytChannelId)) {
      console.warn(`[yt-dlp] Invalid channel ID rejected: ${ytChannelId}`);
      return null;
    }

    // Support both channel IDs (UC...) and handles (@AajTak)
    const videoUrl = ytChannelId.startsWith('@')
      ? `https://www.youtube.com/${ytChannelId}/live`
      : `https://www.youtube.com/channel/${ytChannelId}/live`;
    return new Promise((resolve) => {
      const proc = execFile(
        'yt-dlp',
        ['-f', 'b[protocol=m3u8]/b', '-g', '--no-warnings', videoUrl],
        { timeout: YT_DLP_TIMEOUT },
        (error, stdout, _stderr) => {
          if (error) {
            console.warn(`[yt-dlp] Failed to resolve ${ytChannelId}:`, error.message);
            return resolve(null);
          }
          const url = stdout.trim().split('\n')[0];
          if (!url || !url.startsWith('http')) {
            console.warn(`[yt-dlp] No valid URL for ${ytChannelId}:`, stdout.trim());
            return resolve(null);
          }
          const expiresAt = new Date(Date.now() + STREAM_EXPIRY_HOURS * 60 * 60 * 1000);
          resolve({ url, expiresAt });
        },
      );

      // Kill on timeout (execFile timeout sends SIGTERM but we want cleanup)
      proc.on('error', () => resolve(null));
    });
  }

  async resolveBatch(channelIds: string[]): Promise<Map<string, ResolveResult>> {
    const results = new Map<string, ResolveResult>();
    const queue = [...channelIds];
    const workers: Promise<void>[] = [];

    for (let i = 0; i < Math.min(YT_DLP_CONCURRENCY, queue.length); i++) {
      workers.push(
        (async () => {
          while (queue.length > 0) {
            const id = queue.shift()!;
            const result = await this.resolveStreamUrl(id);
            if (result) {
              results.set(id, result);
            }
          }
        })(),
      );
    }

    await Promise.all(workers);
    return results;
  }
}

export const ytDlpResolver = new YtDlpResolver();
