import Redis from 'ioredis';
import { env } from './env';

// In-memory fallback for when no Redis is available
const memoryStore = new Map<string, { value: any; expiry: number | null }>();

let localRedis: Redis | null = null;
let upstashRedis: any = null;

// Priority: Local Docker Redis > Upstash > In-memory fallback
if (env.redisUrl) {
  try {
    localRedis = new Redis(env.redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });
    localRedis.on('error', (err: any) => {
      console.warn('[Redis] Local Redis error:', err.message);
    });
    localRedis.on('connect', () => {
      console.log('[Redis] ✅ Connected to local Docker Redis');
    });
  } catch (err: any) {
    console.warn('[Redis] Local Redis init warning:', err.message);
  }
} else if (env.upstashRedisUrl && env.upstashRedisToken) {
  try {
    const { Redis: UpstashRedis } = require('@upstash/redis');
    upstashRedis = new UpstashRedis({
      url: env.upstashRedisUrl,
      token: env.upstashRedisToken,
    });
    console.log('[Redis] ✅ Using Upstash Redis');
  } catch (err: any) {
    console.warn('[Redis] Upstash Redis init warning:', err.message);
  }
} else {
  console.warn('[Redis] ⚠️ No Redis configured. Using in-memory fallback. Set REDIS_URL for local Docker Redis.');
}

// Fast in-memory L1 cache to avoid repeated Upstash REST network calls
const l1Cache = new Map<string, { value: any; expiry: number }>();
const L1_MAX_TTL_MS = 30 * 1000; // 30s L1 cache

export const redisClient = {
  async get<T = any>(key: string): Promise<T | null> {
    const now = Date.now();
    // 0. Check fast in-memory L1 cache first (< 0.1ms)
    const l1 = l1Cache.get(key);
    if (l1 && l1.expiry > now) {
      return l1.value as T;
    }

    // Try local Redis first
    if (localRedis) {
      try {
        const data = await localRedis.get(key);
        if (data === null) return null;
        let parsed: T;
        try { parsed = JSON.parse(data) as T; } catch { parsed = data as unknown as T; }
        l1Cache.set(key, { value: parsed, expiry: now + L1_MAX_TTL_MS });
        return parsed;
      } catch (err) {
        console.warn(`[Redis] get error for ${key}:`, (err as Error).message);
      }
    }
    // Try Upstash
    if (upstashRedis) {
      try {
        const val = (await upstashRedis.get(key)) as T;
        if (val !== null && val !== undefined) {
          l1Cache.set(key, { value: val, expiry: now + L1_MAX_TTL_MS });
        }
        return val;
      } catch (err) {
        console.warn(`[Redis] Upstash get error for ${key}:`, (err as Error).message);
      }
    }
    // In-memory fallback
    const item = memoryStore.get(key);
    if (!item) return null;
    if (item.expiry && Date.now() > item.expiry) {
      memoryStore.delete(key);
      return null;
    }
    return item.value as T;
  },

  async set(key: string, value: any, options?: { ex?: number } | number): Promise<'OK'> {
    const opts = typeof options === 'number' ? { ex: options } : options;
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);

    // Try local Redis first
    if (localRedis) {
      try {
        if (opts?.ex) {
          await localRedis.setex(key, opts.ex, serialized);
        } else {
          await localRedis.set(key, serialized);
        }
        return 'OK';
      } catch (err) {
        console.warn(`[Redis] set error for ${key}:`, (err as Error).message);
      }
    }
    // Try Upstash
    if (upstashRedis) {
      try {
        if (opts?.ex) {
          await upstashRedis.set(key, value, { ex: opts.ex });
        } else {
          await upstashRedis.set(key, value);
        }
        return 'OK';
      } catch (err) {
        console.warn(`[Redis] Upstash set error for ${key}:`, (err as Error).message);
      }
    }
    // In-memory fallback
    const expiry = opts?.ex ? Date.now() + opts.ex * 1000 : null;
    memoryStore.set(key, { value, expiry });

    // Update fast L1 cache
    const l1Ttl = opts?.ex ? Math.min(opts.ex * 1000, L1_MAX_TTL_MS) : L1_MAX_TTL_MS;
    l1Cache.set(key, { value, expiry: Date.now() + l1Ttl });
    return 'OK';
  },

  async del(key: string): Promise<number> {
    l1Cache.delete(key);
    if (localRedis) {
      try { return await localRedis.del(key); } catch {}
    }
    if (upstashRedis) {
      try { return await upstashRedis.del(key); } catch {}
    }
    const existed = memoryStore.has(key);
    memoryStore.delete(key);
    return existed ? 1 : 0;
  },

  async keys(pattern: string): Promise<string[]> {
    if (localRedis) {
      try { return await localRedis.keys(pattern); } catch {}
    }
    if (upstashRedis) {
      try { return await upstashRedis.keys(pattern); } catch {}
    }
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Array.from(memoryStore.keys()).filter((k) => regex.test(k));
  },

  async publish(channel: string, message: string): Promise<number> {
    if (localRedis) {
      try { return await localRedis.publish(channel, message); } catch {}
    }
    // Upstash doesn't support pub/sub natively via REST, skip
    return 0;
  },

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    if (localRedis) {
      const subscriber = localRedis.duplicate();
      await subscriber.subscribe(channel);
      subscriber.on('message', (_ch: string, msg: string) => {
        if (_ch === channel) callback(msg);
      });
    }
  },

  // Get the raw ioredis instance for advanced operations (pub/sub)
  getRawClient(): Redis | null {
    return localRedis;
  },

  isConnected(): boolean {
    return localRedis !== null || upstashRedis !== null;
  },
};
