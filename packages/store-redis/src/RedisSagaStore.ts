import { Redis } from "ioredis";
import type { SagaStore, SagaState } from "@saga-bus/core";
import { ConcurrencyError } from "@saga-bus/core";
import type { RedisSagaStoreOptions } from "./types.js";

/**
 * Redis-backed saga store for saga-bus.
 *
 * Uses WATCH/MULTI for optimistic concurrency control.
 *
 * @example
 * ```typescript
 * import { RedisSagaStore } from "@saga-bus/store-redis";
 *
 * const store = new RedisSagaStore<OrderState>({
 *   connection: { host: "localhost", port: 6379 },
 *   completedTtlSeconds: 86400, // 1 day
 * });
 *
 * await store.initialize();
 * ```
 */
export class RedisSagaStore<TState extends SagaState>
  implements SagaStore<TState>
{
  private redis: Redis | null = null;
  private readonly options: Required<
    Pick<
      RedisSagaStoreOptions,
      | "keyPrefix"
      | "completedTtlSeconds"
      | "defaultTtlSeconds"
      | "maxRetries"
      | "retryDelayMs"
    >
  > &
    RedisSagaStoreOptions;
  private readonly ownsRedis: boolean;

  constructor(options: RedisSagaStoreOptions) {
    if (!options.redis && !options.connection) {
      throw new Error("Either redis or connection must be provided");
    }

    this.options = {
      keyPrefix: "saga-bus:",
      completedTtlSeconds: 0,
      defaultTtlSeconds: 0,
      maxRetries: 3,
      retryDelayMs: 100,
      ...options,
    };

    this.ownsRedis = !options.redis;
  }

  async initialize(): Promise<void> {
    if (this.options.redis) {
      this.redis = this.options.redis;
    } else {
      this.redis = new Redis(this.options.connection!);
    }
  }

  async close(): Promise<void> {
    if (this.ownsRedis && this.redis) {
      await this.redis.quit();
    }
    this.redis = null;
  }

  async getById(sagaName: string, sagaId: string): Promise<TState | null> {
    if (!this.redis) throw new Error("Store not initialized");

    // Lookup correlation ID from index
    const indexKey = this.buildIdIndexKey(sagaName, sagaId);
    const correlationId = await this.redis.get(indexKey);

    if (!correlationId) return null;

    return this.getByCorrelationId(sagaName, correlationId);
  }

  async getByCorrelationId(
    sagaName: string,
    correlationId: string
  ): Promise<TState | null> {
    if (!this.redis) throw new Error("Store not initialized");

    const key = this.buildKey(sagaName, correlationId);
    const data = await this.redis.get(key);

    if (!data) return null;

    return this.deserializeState(data);
  }

  async insert(
    sagaName: string,
    correlationId: string,
    state: TState
  ): Promise<void> {
    if (!this.redis) throw new Error("Store not initialized");

    const key = this.buildKey(sagaName, correlationId);
    const indexKey = this.buildIdIndexKey(sagaName, state.metadata.sagaId);

    // Check if saga already exists
    const existing = await this.redis.get(key);
    if (existing) {
      throw new Error(
        `Saga ${sagaName} with correlation ID ${correlationId} already exists`
      );
    }

    // Serialize and save
    const serialized = this.serializeState(state);

    // Determine TTL
    let ttl = this.options.defaultTtlSeconds;
    if (state.metadata.isCompleted && this.options.completedTtlSeconds > 0) {
      ttl = this.options.completedTtlSeconds;
    }

    const multi = this.redis.multi();

    if (ttl > 0) {
      multi.setex(key, ttl, serialized);
      multi.setex(indexKey, ttl, correlationId);
    } else {
      multi.set(key, serialized);
      multi.set(indexKey, correlationId);
    }

    await multi.exec();
  }

  async update(
    sagaName: string,
    state: TState,
    expectedVersion: number
  ): Promise<void> {
    if (!this.redis) throw new Error("Store not initialized");

    // We need to find the correlation ID for this saga
    const indexKey = this.buildIdIndexKey(sagaName, state.metadata.sagaId);
    const correlationId = await this.redis.get(indexKey);

    if (!correlationId) {
      throw new Error(`Saga ${state.metadata.sagaId} not found`);
    }

    const key = this.buildKey(sagaName, correlationId);

    for (let attempt = 0; attempt < this.options.maxRetries; attempt++) {
      // Watch the key for changes
      await this.redis.watch(key);

      try {
        // Check current version
        const existing = await this.redis.get(key);
        if (!existing) {
          await this.redis.unwatch();
          throw new Error(`Saga ${state.metadata.sagaId} not found`);
        }

        const currentState = this.deserializeState(existing);
        if (currentState.metadata.version !== expectedVersion) {
          await this.redis.unwatch();
          throw new ConcurrencyError(
            state.metadata.sagaId,
            expectedVersion,
            currentState.metadata.version
          );
        }

        // Start transaction
        const multi = this.redis.multi();

        // Serialize and save
        const serialized = this.serializeState(state);

        // Determine TTL
        let ttl = this.options.defaultTtlSeconds;
        if (state.metadata.isCompleted && this.options.completedTtlSeconds > 0) {
          ttl = this.options.completedTtlSeconds;
        }

        if (ttl > 0) {
          multi.setex(key, ttl, serialized);
          multi.setex(indexKey, ttl, correlationId);
        } else {
          multi.set(key, serialized);
          multi.set(indexKey, correlationId);
        }

        // Execute transaction
        const result = await multi.exec();

        if (result === null) {
          // Transaction aborted due to WATCH - retry
          if (attempt < this.options.maxRetries - 1) {
            await this.delay(this.options.retryDelayMs);
            continue;
          }
          throw new ConcurrencyError(
            state.metadata.sagaId,
            expectedVersion,
            -1 // Unknown current version due to race
          );
        }

        return; // Success
      } catch (error) {
        await this.redis.unwatch();
        throw error;
      }
    }
  }

  async delete(sagaName: string, sagaId: string): Promise<void> {
    if (!this.redis) throw new Error("Store not initialized");

    // Lookup correlation ID from index
    const indexKey = this.buildIdIndexKey(sagaName, sagaId);
    const correlationId = await this.redis.get(indexKey);

    if (!correlationId) return;

    const key = this.buildKey(sagaName, correlationId);
    await this.redis.del(key, indexKey);
  }

  private buildKey(sagaName: string, correlationId: string): string {
    return `${this.options.keyPrefix}saga:${sagaName}:${correlationId}`;
  }

  private buildIdIndexKey(sagaName: string, sagaId: string): string {
    return `${this.options.keyPrefix}saga:${sagaName}:idx:id:${sagaId}`;
  }

  private serializeState(state: TState): string {
    return JSON.stringify({
      ...state,
      metadata: {
        ...state.metadata,
        createdAt: state.metadata.createdAt.toISOString(),
        updatedAt: state.metadata.updatedAt.toISOString(),
        archivedAt: state.metadata.archivedAt?.toISOString() ?? null,
        timeoutExpiresAt: state.metadata.timeoutExpiresAt?.toISOString() ?? null,
      },
    });
  }

  private deserializeState(data: string): TState {
    const parsed = JSON.parse(data);
    return {
      ...parsed,
      metadata: {
        ...parsed.metadata,
        createdAt: new Date(parsed.metadata.createdAt),
        updatedAt: new Date(parsed.metadata.updatedAt),
        archivedAt: parsed.metadata.archivedAt
          ? new Date(parsed.metadata.archivedAt)
          : null,
        timeoutExpiresAt: parsed.metadata.timeoutExpiresAt
          ? new Date(parsed.metadata.timeoutExpiresAt)
          : null,
      },
    } as TState;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============ Query Helpers ============

  /**
   * Get the underlying Redis client for advanced operations.
   */
  getRedis(): Redis | null {
    return this.redis;
  }
}
