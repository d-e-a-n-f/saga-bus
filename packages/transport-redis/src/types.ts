import type { Redis, RedisOptions } from "ioredis";

/**
 * Configuration options for Redis Streams transport.
 */
export interface RedisTransportOptions {
  /**
   * Redis client instance.
   * Either redis or connection must be provided.
   */
  redis?: Redis;

  /**
   * Redis connection options.
   * Used to create a new Redis client if redis is not provided.
   */
  connection?: RedisOptions;

  /**
   * Prefix for all stream keys.
   * @default "saga-bus:"
   */
  keyPrefix?: string;

  /**
   * Consumer group name.
   * Required for subscribing.
   */
  consumerGroup?: string;

  /**
   * Consumer name within the group.
   * @default Auto-generated UUID
   */
  consumerName?: string;

  /**
   * Whether to create consumer groups automatically.
   * @default true
   */
  autoCreateGroup?: boolean;

  /**
   * Maximum number of messages to fetch per read.
   * @default 10
   */
  batchSize?: number;

  /**
   * Block timeout in milliseconds when waiting for messages.
   * @default 5000
   */
  blockTimeoutMs?: number;

  /**
   * Maximum stream length (MAXLEN for XADD).
   * Set to 0 for unlimited.
   * @default 0
   */
  maxStreamLength?: number;

  /**
   * Whether to use approximate MAXLEN (~).
   * More efficient but less precise.
   * @default true
   */
  approximateMaxLen?: boolean;

  /**
   * How often to check for delayed messages in milliseconds.
   * @default 1000
   */
  delayedPollIntervalMs?: number;

  /**
   * Key for the delayed messages sorted set.
   * @default "saga-bus:delayed"
   */
  delayedSetKey?: string;

  /**
   * How often to claim pending messages in milliseconds.
   * Set to 0 to disable.
   * @default 30000
   */
  pendingClaimIntervalMs?: number;

  /**
   * Minimum idle time before claiming a pending message in milliseconds.
   * @default 60000
   */
  minIdleTimeMs?: number;
}

/**
 * Internal subscription registration.
 */
export interface StreamSubscription {
  streamKey: string;
  handler: (envelope: unknown) => Promise<void>;
  concurrency: number;
}

/**
 * Delayed message entry stored in sorted set.
 */
export interface DelayedMessageEntry {
  streamKey: string;
  envelope: string; // JSON serialized
  deliverAt: number; // Unix timestamp ms
}
