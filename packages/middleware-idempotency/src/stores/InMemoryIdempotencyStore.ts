import type { IdempotencyStore } from "../types.js";

interface StoreEntry {
  expiresAt: number | null;
}

/**
 * In-memory idempotency store for development and testing.
 * Not suitable for distributed systems with multiple instances.
 */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly store = new Map<string, StoreEntry>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Create an in-memory idempotency store.
   * @param cleanupIntervalMs - How often to clean up expired entries (default: 60000ms)
   */
  constructor(cleanupIntervalMs: number = 60000) {
    if (cleanupIntervalMs > 0) {
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, cleanupIntervalMs);
      // Don't keep the process alive just for cleanup
      this.cleanupInterval.unref?.();
    }
  }

  async has(messageId: string): Promise<boolean> {
    const entry = this.store.get(messageId);
    if (!entry) {
      return false;
    }
    // Check if expired
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(messageId);
      return false;
    }
    return true;
  }

  async set(messageId: string, ttlMs?: number): Promise<void> {
    const expiresAt = ttlMs != null ? Date.now() + ttlMs : null;
    this.store.set(messageId, { expiresAt });
  }

  async delete(messageId: string): Promise<void> {
    this.store.delete(messageId);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  /**
   * Get the number of entries in the store (for testing).
   */
  get size(): number {
    return this.store.size;
  }

  /**
   * Stop the cleanup interval.
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Remove expired entries.
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt !== null && now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}
