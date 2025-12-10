import { Pool } from "pg";
import type { SagaStore, SagaState } from "@saga-bus/core";
import { ConcurrencyError } from "@saga-bus/core";
import type { PostgresSagaStoreOptions, SagaInstanceRow } from "./types.js";

/**
 * PostgreSQL-backed saga store using native pg driver.
 *
 * @example
 * ```typescript
 * const store = new PostgresSagaStore<OrderState>({
 *   pool: new Pool({ connectionString: process.env.DATABASE_URL }),
 * });
 *
 * // Or with pool config
 * const store = new PostgresSagaStore<OrderState>({
 *   pool: { connectionString: process.env.DATABASE_URL },
 * });
 * ```
 */
export class PostgresSagaStore<TState extends SagaState>
  implements SagaStore<TState>
{
  private readonly pool: Pool;
  private readonly tableName: string;
  private readonly schema: string;
  private readonly ownsPool: boolean;

  constructor(options: PostgresSagaStoreOptions) {
    if (options.pool instanceof Pool) {
      this.pool = options.pool;
      this.ownsPool = false;
    } else {
      this.pool = new Pool(options.pool);
      this.ownsPool = true;
    }

    this.tableName = options.tableName ?? "saga_instances";
    this.schema = options.schema ?? "public";
  }

  /**
   * Get the full table name with schema.
   */
  private get fullTableName(): string {
    return `${this.schema}.${this.tableName}`;
  }

  async getById(sagaName: string, sagaId: string): Promise<TState | null> {
    const result = await this.pool.query<SagaInstanceRow>(
      `SELECT * FROM ${this.fullTableName} WHERE id = $1 AND saga_name = $2`,
      [sagaId, sagaName]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToState(result.rows[0]!);
  }

  async getByCorrelationId(
    sagaName: string,
    correlationId: string
  ): Promise<TState | null> {
    const result = await this.pool.query<SagaInstanceRow>(
      `SELECT * FROM ${this.fullTableName} WHERE saga_name = $1 AND correlation_id = $2`,
      [sagaName, correlationId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToState(result.rows[0]!);
  }

  async insert(sagaName: string, state: TState): Promise<void> {
    const { sagaId, version, isCompleted, createdAt, updatedAt } = state.metadata;

    // Use sagaId as correlation_id if not specified elsewhere
    const correlationId = (state as unknown as { correlationId?: string }).correlationId ?? sagaId;

    await this.pool.query(
      `INSERT INTO ${this.fullTableName}
       (id, saga_name, correlation_id, version, is_completed, state, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        sagaId,
        sagaName,
        correlationId,
        version,
        isCompleted,
        JSON.stringify(state),
        createdAt,
        updatedAt,
      ]
    );
  }

  /**
   * Insert a saga with explicit correlation ID.
   */
  async insertWithCorrelation(
    sagaName: string,
    correlationId: string,
    state: TState
  ): Promise<void> {
    const { sagaId, version, isCompleted, createdAt, updatedAt } = state.metadata;

    await this.pool.query(
      `INSERT INTO ${this.fullTableName}
       (id, saga_name, correlation_id, version, is_completed, state, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        sagaId,
        sagaName,
        correlationId,
        version,
        isCompleted,
        JSON.stringify(state),
        createdAt,
        updatedAt,
      ]
    );
  }

  async update(
    sagaName: string,
    state: TState,
    expectedVersion: number
  ): Promise<void> {
    const { sagaId, version, isCompleted, updatedAt } = state.metadata;

    const result = await this.pool.query(
      `UPDATE ${this.fullTableName}
       SET version = $1, is_completed = $2, state = $3, updated_at = $4
       WHERE id = $5 AND saga_name = $6 AND version = $7`,
      [
        version,
        isCompleted,
        JSON.stringify(state),
        updatedAt,
        sagaId,
        sagaName,
        expectedVersion,
      ]
    );

    if (result.rowCount === 0) {
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
    await this.pool.query(
      `DELETE FROM ${this.fullTableName} WHERE id = $1 AND saga_name = $2`,
      [sagaId, sagaName]
    );
  }

  /**
   * Convert a database row to saga state.
   */
  private rowToState(row: SagaInstanceRow): TState {
    const state = row.state as TState;

    // Ensure metadata dates are Date objects
    return {
      ...state,
      metadata: {
        ...state.metadata,
        sagaId: row.id,
        version: row.version,
        isCompleted: row.is_completed,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      },
    };
  }

  /**
   * Close the connection pool (if owned by this store).
   */
  async close(): Promise<void> {
    if (this.ownsPool) {
      await this.pool.end();
    }
  }

  /**
   * Get the underlying pool for advanced operations.
   */
  getPool(): Pool {
    return this.pool;
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
    let query = `SELECT * FROM ${this.fullTableName} WHERE saga_name = $1`;
    const params: unknown[] = [sagaName];

    if (options?.completed !== undefined) {
      query += ` AND is_completed = $${params.length + 1}`;
      params.push(options.completed);
    }

    query += ` ORDER BY created_at DESC`;

    if (options?.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }

    if (options?.offset) {
      query += ` OFFSET $${params.length + 1}`;
      params.push(options.offset);
    }

    const result = await this.pool.query<SagaInstanceRow>(query, params);
    return result.rows.map((row) => this.rowToState(row));
  }

  /**
   * Count sagas by name.
   */
  async countByName(
    sagaName: string,
    options?: { completed?: boolean }
  ): Promise<number> {
    let query = `SELECT COUNT(*) FROM ${this.fullTableName} WHERE saga_name = $1`;
    const params: unknown[] = [sagaName];

    if (options?.completed !== undefined) {
      query += ` AND is_completed = $${params.length + 1}`;
      params.push(options.completed);
    }

    const result = await this.pool.query<{ count: string }>(query, params);
    return parseInt(result.rows[0]?.count ?? "0", 10);
  }

  /**
   * Delete completed sagas older than a given date.
   */
  async deleteCompletedBefore(
    sagaName: string,
    before: Date
  ): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM ${this.fullTableName}
       WHERE saga_name = $1 AND is_completed = true AND updated_at < $2`,
      [sagaName, before]
    );

    return result.rowCount ?? 0;
  }
}
