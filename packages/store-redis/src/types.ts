import type { Redis, RedisOptions } from "ioredis";

/**
 * Configuration options for the Redis saga store.
 */
export interface RedisSagaStoreOptions {
  /** Existing Redis client */
  redis?: Redis;

  /** Connection options for creating new client */
  connection?: RedisOptions;

  /** Key prefix for all saga keys (default: "saga-bus:") */
  keyPrefix?: string;

  /** TTL in seconds for completed sagas (0 = no expiry, default: 0) */
  completedTtlSeconds?: number;

  /** TTL in seconds for all sagas (0 = no expiry, default: 0) */
  defaultTtlSeconds?: number;

  /** Maximum retries for optimistic locking conflicts (default: 3) */
  maxRetries?: number;

  /** Delay between retries in milliseconds (default: 100) */
  retryDelayMs?: number;
}
