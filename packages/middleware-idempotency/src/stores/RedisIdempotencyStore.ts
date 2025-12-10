import type { IdempotencyStore } from "../types.js";

// Use a type-only import for Redis to make it optional
type Redis = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, duration?: number): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<string>;
  del(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
};

/**
 * Options for the Redis idempotency store.
 */
export interface RedisIdempotencyStoreOptions {
  /**
   * Redis client instance (ioredis).
   */
  redis: Redis;

  /**
   * Key prefix for all idempotency keys.
   * @default "idempotency:"
   */
  keyPrefix?: string;
}

/**
 * Redis-backed idempotency store for distributed systems.
 * Requires ioredis as a peer dependency.
 */
export class RedisIdempotencyStore implements IdempotencyStore {
  private readonly redis: Redis;
  private readonly keyPrefix: string;

  constructor(options: RedisIdempotencyStoreOptions) {
    this.redis = options.redis;
    this.keyPrefix = options.keyPrefix ?? "idempotency:";
  }

  private key(messageId: string): string {
    return `${this.keyPrefix}${messageId}`;
  }

  async has(messageId: string): Promise<boolean> {
    const result = await this.redis.get(this.key(messageId));
    return result !== null;
  }

  async set(messageId: string, ttlMs?: number): Promise<void> {
    const key = this.key(messageId);
    if (ttlMs != null) {
      // Convert ms to seconds (Redis SETEX uses seconds)
      const ttlSeconds = Math.ceil(ttlMs / 1000);
      await this.redis.setex(key, ttlSeconds, "1");
    } else {
      await this.redis.set(key, "1");
    }
  }

  async delete(messageId: string): Promise<void> {
    await this.redis.del(this.key(messageId));
  }

  async clear(): Promise<void> {
    // Get all keys with our prefix and delete them
    const keys = await this.redis.keys(`${this.keyPrefix}*`);
    if (keys.length > 0) {
      for (const key of keys) {
        await this.redis.del(key);
      }
    }
  }
}
