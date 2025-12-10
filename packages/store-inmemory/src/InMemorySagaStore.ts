import type { SagaStore, SagaState } from "@saga-bus/core";
import { ConcurrencyError } from "@saga-bus/core";

/**
 * In-memory saga store implementation for testing and development.
 * Uses Maps for O(1) lookups by both sagaId and correlationId.
 */
export class InMemorySagaStore<TState extends SagaState>
  implements SagaStore<TState>
{
  /** Primary store: sagaName:sagaId -> state */
  private readonly store = new Map<string, TState>();

  /** Correlation index: "sagaName:correlationId" -> sagaId */
  private readonly correlationIndex = new Map<string, string>();

  /**
   * Build the correlation index key.
   */
  private getCorrelationKey(sagaName: string, correlationId: string): string {
    return `${sagaName}:${correlationId}`;
  }

  /**
   * Build the store key (sagaName:sagaId for isolation).
   */
  private getStoreKey(sagaName: string, sagaId: string): string {
    return `${sagaName}:${sagaId}`;
  }

  async getById(sagaName: string, sagaId: string): Promise<TState | null> {
    const key = this.getStoreKey(sagaName, sagaId);
    const state = this.store.get(key);
    return state ? this.clone(state) : null;
  }

  async getByCorrelationId(
    sagaName: string,
    correlationId: string
  ): Promise<TState | null> {
    const correlationKey = this.getCorrelationKey(sagaName, correlationId);
    const sagaId = this.correlationIndex.get(correlationKey);

    if (!sagaId) {
      return null;
    }

    return this.getById(sagaName, sagaId);
  }

  async insert(sagaName: string, state: TState): Promise<void> {
    const { sagaId } = state.metadata;
    const storeKey = this.getStoreKey(sagaName, sagaId);

    if (this.store.has(storeKey)) {
      throw new Error(`Saga ${sagaId} already exists`);
    }

    // Store the state (deep clone to prevent mutation)
    this.store.set(storeKey, this.clone(state));
  }

  /**
   * Index a saga by correlation ID.
   * Called separately from insert to allow custom correlation handling.
   */
  indexByCorrelationId(
    sagaName: string,
    correlationId: string,
    sagaId: string
  ): void {
    const correlationKey = this.getCorrelationKey(sagaName, correlationId);
    this.correlationIndex.set(correlationKey, sagaId);
  }

  async update(
    sagaName: string,
    state: TState,
    expectedVersion: number
  ): Promise<void> {
    const { sagaId, version } = state.metadata;
    const storeKey = this.getStoreKey(sagaName, sagaId);

    const existing = this.store.get(storeKey);

    if (!existing) {
      throw new Error(`Saga ${sagaId} not found`);
    }

    if (existing.metadata.version !== expectedVersion) {
      throw new ConcurrencyError(
        sagaId,
        expectedVersion,
        existing.metadata.version
      );
    }

    // Verify the new version is incremented
    if (version !== expectedVersion + 1) {
      throw new Error(
        `Invalid version: expected ${expectedVersion + 1}, got ${version}`
      );
    }

    // Store the updated state (deep clone to prevent mutation)
    this.store.set(storeKey, this.clone(state));
  }

  async delete(sagaName: string, sagaId: string): Promise<void> {
    const storeKey = this.getStoreKey(sagaName, sagaId);
    this.store.delete(storeKey);
  }

  /**
   * Deep clone a state object to prevent external mutations.
   */
  private clone(state: TState): TState {
    return JSON.parse(JSON.stringify(state)) as TState;
  }

  // ============ Testing Utilities ============

  /**
   * Get the total number of stored sagas.
   */
  get size(): number {
    return this.store.size;
  }

  /**
   * Clear all stored data.
   */
  clear(): void {
    this.store.clear();
    this.correlationIndex.clear();
  }

  /**
   * Get all stored states (for testing/debugging).
   */
  getAll(): TState[] {
    return Array.from(this.store.values()).map((s) => this.clone(s));
  }

  /**
   * Check if a saga exists by ID.
   */
  has(sagaName: string, sagaId: string): boolean {
    return this.store.has(this.getStoreKey(sagaName, sagaId));
  }
}
