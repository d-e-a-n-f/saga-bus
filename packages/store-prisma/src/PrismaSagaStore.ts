import type { SagaStore, SagaState } from "@saga-bus/core";
import { ConcurrencyError } from "@saga-bus/core";
import type {
  PrismaSagaStoreOptions,
  PrismaClientLike,
  SagaInstanceRecord,
} from "./types.js";

/**
 * Prisma-backed saga store.
 *
 * @example
 * ```typescript
 * import { PrismaClient } from "@prisma/client";
 *
 * const prisma = new PrismaClient();
 * const store = new PrismaSagaStore<OrderState>({ prisma });
 *
 * const bus = await createBus({
 *   transport,
 *   sagas: [{ definition: orderSaga, store }],
 * });
 * ```
 */
export class PrismaSagaStore<TState extends SagaState>
  implements SagaStore<TState>
{
  private readonly prisma: PrismaClientLike;

  constructor(options: PrismaSagaStoreOptions) {
    this.prisma = options.prisma;
  }

  async getById(sagaName: string, sagaId: string): Promise<TState | null> {
    const record = await this.prisma.sagaInstance.findUnique({
      where: { sagaName_id: { sagaName, id: sagaId } },
    });

    if (!record) {
      return null;
    }

    return this.recordToState(record);
  }

  async getByCorrelationId(
    sagaName: string,
    correlationId: string
  ): Promise<TState | null> {
    const record = await this.prisma.sagaInstance.findFirst({
      where: {
        sagaName,
        correlationId,
      },
    });

    if (!record) {
      return null;
    }

    return this.recordToState(record);
  }

  async insert(sagaName: string, state: TState): Promise<void> {
    const { sagaId, version, isCompleted, createdAt, updatedAt } =
      state.metadata;

    // Extract correlation ID from state if available
    const correlationId =
      (state as unknown as { correlationId?: string }).correlationId ?? sagaId;

    await this.prisma.sagaInstance.create({
      data: {
        id: sagaId,
        sagaName,
        correlationId,
        version,
        isCompleted,
        state: state as unknown,
        createdAt,
        updatedAt,
      },
    });
  }

  /**
   * Insert a saga with explicit correlation ID.
   */
  async insertWithCorrelation(
    sagaName: string,
    correlationId: string,
    state: TState
  ): Promise<void> {
    const { sagaId, version, isCompleted, createdAt, updatedAt } =
      state.metadata;

    await this.prisma.sagaInstance.create({
      data: {
        id: sagaId,
        sagaName,
        correlationId,
        version,
        isCompleted,
        state: state as unknown,
        createdAt,
        updatedAt,
      },
    });
  }

  async update(
    sagaName: string,
    state: TState,
    expectedVersion: number
  ): Promise<void> {
    const { sagaId, version, isCompleted, updatedAt } = state.metadata;

    // Use updateMany with version check for optimistic concurrency
    const result = await this.prisma.sagaInstance.updateMany({
      where: {
        sagaName,
        id: sagaId,
        version: expectedVersion,
      },
      data: {
        version,
        isCompleted,
        state: state as unknown,
        updatedAt,
      },
    });

    if (result.count === 0) {
      // Either saga doesn't exist or version mismatch
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
    try {
      await this.prisma.sagaInstance.delete({
        where: { sagaName_id: { sagaName, id: sagaId } },
      });
    } catch {
      // Ignore if not found
    }
  }

  /**
   * Convert a Prisma record to saga state.
   */
  private recordToState(record: SagaInstanceRecord): TState {
    const state = record.state as TState;

    // Ensure metadata is consistent with database values
    return {
      ...state,
      metadata: {
        ...state.metadata,
        sagaId: record.id,
        version: record.version,
        isCompleted: record.isCompleted,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
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
    const records = await this.prisma.sagaInstance.findMany({
      where: {
        sagaName,
        ...(options?.completed !== undefined
          ? { isCompleted: options.completed }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: options?.limit,
      skip: options?.offset,
    });

    return records.map((record) => this.recordToState(record));
  }

  /**
   * Count sagas by name.
   */
  async countByName(
    sagaName: string,
    options?: { completed?: boolean }
  ): Promise<number> {
    return this.prisma.sagaInstance.count({
      where: {
        sagaName,
        ...(options?.completed !== undefined
          ? { isCompleted: options.completed }
          : {}),
      },
    });
  }

  /**
   * Delete completed sagas older than a given date.
   */
  async deleteCompletedBefore(sagaName: string, before: Date): Promise<number> {
    const result = await this.prisma.sagaInstance.deleteMany({
      where: {
        sagaName,
        isCompleted: true,
        updatedAt: { lt: before },
      },
    });

    return result.count;
  }
}
