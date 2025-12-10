import type { Collection } from "mongodb";
import type { SagaStore, SagaState } from "@saga-bus/core";
import { ConcurrencyError } from "@saga-bus/core";
import type { MongoSagaStoreOptions, SagaInstanceDocument } from "./types.js";

/**
 * MongoDB-backed saga store.
 *
 * @example
 * ```typescript
 * import { MongoClient } from "mongodb";
 *
 * const client = new MongoClient("mongodb://localhost:27017");
 * await client.connect();
 * const db = client.db("saga_bus");
 *
 * const store = new MongoSagaStore<OrderState>({ db });
 * await store.ensureIndexes();
 * ```
 */
export class MongoSagaStore<TState extends SagaState>
  implements SagaStore<TState>
{
  private readonly collection: Collection<SagaInstanceDocument>;

  constructor(options: MongoSagaStoreOptions) {
    const collectionName = options.collectionName ?? "saga_instances";
    this.collection =
      options.db.collection<SagaInstanceDocument>(collectionName);
  }

  /**
   * Create indexes for optimal query performance.
   * Call once during application startup.
   */
  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex(
      { sagaName: 1, correlationId: 1 },
      { unique: true }
    );
    await this.collection.createIndex({
      sagaName: 1,
      isCompleted: 1,
      updatedAt: 1,
    });
    await this.collection.createIndex({ sagaName: 1, sagaId: 1 });
  }

  private makeId(sagaName: string, sagaId: string): string {
    return `${sagaName}:${sagaId}`;
  }

  async getById(sagaName: string, sagaId: string): Promise<TState | null> {
    const doc = await this.collection.findOne({
      _id: this.makeId(sagaName, sagaId),
    });

    if (!doc) {
      return null;
    }

    return this.documentToState(doc);
  }

  async getByCorrelationId(
    sagaName: string,
    correlationId: string
  ): Promise<TState | null> {
    const doc = await this.collection.findOne({
      sagaName,
      correlationId,
    });

    if (!doc) {
      return null;
    }

    return this.documentToState(doc);
  }

  async insert(sagaName: string, state: TState): Promise<void> {
    const { sagaId, version, isCompleted, createdAt, updatedAt } =
      state.metadata;

    const correlationId =
      (state as unknown as { correlationId?: string }).correlationId ?? sagaId;

    const doc: SagaInstanceDocument = {
      _id: this.makeId(sagaName, sagaId),
      sagaName,
      sagaId,
      correlationId,
      version,
      isCompleted,
      state: state as unknown,
      createdAt,
      updatedAt,
    };

    await this.collection.insertOne(doc);
  }

  async update(
    sagaName: string,
    state: TState,
    expectedVersion: number
  ): Promise<void> {
    const { sagaId, version, isCompleted, updatedAt } = state.metadata;

    const result = await this.collection.updateOne(
      {
        _id: this.makeId(sagaName, sagaId),
        version: expectedVersion,
      },
      {
        $set: {
          version,
          isCompleted,
          state: state as unknown,
          updatedAt,
        },
      }
    );

    if (result.matchedCount === 0) {
      const existing = await this.getById(sagaName, sagaId);
      if (existing) {
        throw new ConcurrencyError(
          sagaId,
          expectedVersion,
          existing.metadata.version
        );
      } else {
        throw new Error(`Saga ${sagaId} not found`);
      }
    }
  }

  async delete(sagaName: string, sagaId: string): Promise<void> {
    await this.collection.deleteOne({
      _id: this.makeId(sagaName, sagaId),
    });
  }

  private documentToState(doc: SagaInstanceDocument): TState {
    const state = doc.state as TState;

    return {
      ...state,
      metadata: {
        ...state.metadata,
        sagaId: doc.sagaId,
        version: doc.version,
        isCompleted: doc.isCompleted,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      },
    };
  }

  // ============ Query Helpers ============

  /**
   * Find sagas by name with pagination.
   */
  async findByName(
    sagaName: string,
    options?: {
      limit?: number;
      offset?: number;
      completed?: boolean;
    }
  ): Promise<TState[]> {
    const filter: Record<string, unknown> = { sagaName };

    if (options?.completed !== undefined) {
      filter.isCompleted = options.completed;
    }

    const cursor = this.collection
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(options?.offset ?? 0)
      .limit(options?.limit ?? 100);

    const docs = await cursor.toArray();
    return docs.map((doc) => this.documentToState(doc));
  }

  /**
   * Count sagas by name.
   */
  async countByName(
    sagaName: string,
    options?: { completed?: boolean }
  ): Promise<number> {
    const filter: Record<string, unknown> = { sagaName };

    if (options?.completed !== undefined) {
      filter.isCompleted = options.completed;
    }

    return this.collection.countDocuments(filter);
  }

  /**
   * Delete completed sagas older than a given date.
   */
  async deleteCompletedBefore(sagaName: string, before: Date): Promise<number> {
    const result = await this.collection.deleteMany({
      sagaName,
      isCompleted: true,
      updatedAt: { $lt: before },
    });

    return result.deletedCount;
  }
}
