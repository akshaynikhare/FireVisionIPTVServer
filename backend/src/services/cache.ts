import { getRedisClient } from './redis';

/**
 * Generic cache service backed by Redis.
 * All operations are no-ops when Redis is unavailable.
 */
export class CacheService {
  private prefix: string;
  private defaultTTL: number;

  /**
   * @param prefix Key prefix (e.g., 'fv:ch:')
   * @param defaultTTL Default TTL in seconds
   */
  constructor(prefix = 'fv:', defaultTTL = 300) {
    this.prefix = prefix;
    this.defaultTTL = defaultTTL;
  }

  private key(k: string): string {
    return `${this.prefix}${k}`;
  }

  /**
   * Get a cached value by key
   */
  async get<T>(key: string): Promise<T | null> {
    const redis = getRedisClient();
    if (!redis) return null;

    try {
      const data = await redis.get(this.key(key));
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  /**
   * Set a value in cache with optional TTL
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const redis = getRedisClient();
    if (!redis) return;

    try {
      const serialized = JSON.stringify(value);
      const seconds = ttl ?? this.defaultTTL;
      await redis.set(this.key(key), serialized, 'EX', seconds);
    } catch {
      // Cache write failure is non-fatal
    }
  }

  /**
   * Delete a specific key from cache
   */
  async delete(key: string): Promise<void> {
    const redis = getRedisClient();
    if (!redis) return;

    try {
      await redis.del(this.key(key));
    } catch {
      // Non-fatal
    }
  }

  /**
   * Delete all keys matching a pattern (uses SCAN to avoid blocking)
   */
  async deletePattern(pattern: string): Promise<number> {
    const redis = getRedisClient();
    if (!redis) return 0;

    let deleted = 0;
    try {
      const fullPattern = this.key(pattern);
      let cursor = '0';

      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', fullPattern, 'COUNT', 20);
        cursor = nextCursor;

        if (keys.length > 0) {
          const pipeline = redis.pipeline();
          for (const key of keys) {
            pipeline.del(key);
          }
          await pipeline.exec();
          deleted += keys.length;
        }

        // Yield to the event loop between iterations
        if (cursor !== '0') {
          await new Promise((resolve) => setImmediate(resolve));
        }
      } while (cursor !== '0');
    } catch {
      // Non-fatal
    }

    return deleted;
  }

  /**
   * Check if a key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    const redis = getRedisClient();
    if (!redis) return false;

    try {
      return (await redis.exists(this.key(key))) === 1;
    } catch {
      return false;
    }
  }

  /**
   * Increment a counter
   */
  async increment(key: string, amount = 1): Promise<number> {
    const redis = getRedisClient();
    if (!redis) return 0;

    try {
      return await redis.incrby(this.key(key), amount);
    } catch {
      return 0;
    }
  }
}

// Pre-configured cache instances for different domains
export const channelCache = new CacheService('fv:ch:', 600); // 10 min
export const userCache = new CacheService('fv:user:', 300); // 5 min
export const statsCache = new CacheService('fv:stats:', 300); // 5 min
export const releaseCache = new CacheService('fv:release:', 300); // 5 min

module.exports = { CacheService, channelCache, userCache, statsCache, releaseCache };
