import Redis from 'ioredis';

let redisClient: Redis | null = null;

/**
 * Get or create the Redis client singleton.
 * Returns null if REDIS_URL is not configured (app works without Redis).
 */
export function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;

  const url = process.env.REDIS_URL;
  if (!url) {
    console.log('REDIS_URL not set - caching disabled');
    return null;
  }

  try {
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > 10) return null; // Stop retrying
        return Math.min(times * 100, 3000);
      },
      lazyConnect: true,
    });

    redisClient.on('error', (err) => {
      console.error('Redis connection error:', err.message);
    });

    redisClient.on('connect', () => {
      console.log('Redis connected');
    });

    redisClient.on('close', () => {
      console.log('Redis connection closed');
    });

    // Connect asynchronously
    redisClient.connect().catch((err) => {
      console.error('Redis initial connect failed:', err.message);
    });

    return redisClient;
  } catch (err) {
    console.error('Failed to create Redis client:', (err as Error).message);
    return null;
  }
}

/**
 * Close the Redis connection gracefully
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

/**
 * Check if Redis is connected and ready
 */
export function isRedisReady(): boolean {
  return redisClient?.status === 'ready' || false;
}

module.exports = { getRedisClient, closeRedis, isRedisReady };
