import sql, { ConnectionPool, config } from "mssql";
import type { SagaStore, SagaState } from "@saga-bus/core";
import { ConcurrencyError } from "@saga-bus/core";
import type { SqlServerSagaStoreOptions, SagaInstanceRow } from "./types.js";

/**
 * SQL Server-backed saga store for saga-bus.
 *
 * @example
 * ```typescript
 * const store = new SqlServerSagaStore<OrderState>({
 *   pool: {
 *     server: "localhost",
 *     database: "sagas",
 *     user: "sa",
 *     password: "password",
 *     options: { trustServerCertificate: true },
 *   },
 * });
 *
 * await store.initialize();
 * ```
 */
export class SqlServerSagaStore<TState extends SagaState>
  implements SagaStore<TState>
{
  private pool: ConnectionPool | null = null;
  private readonly poolConfig: config | null;
  private readonly tableName: string;
  private readonly schema: string;
  private readonly ownsPool: boolean;

  constructor(options: SqlServerSagaStoreOptions) {
    if (options.pool instanceof ConnectionPool) {
      this.pool = options.pool;
      this.poolConfig = null;
      this.ownsPool = false;
    } else {
      this.poolConfig = options.pool;
      this.ownsPool = true;
    }

    this.tableName = options.tableName ?? "saga_instances";
    this.schema = options.schema ?? "dbo";
  }

  /**
   * Get the full table name with schema.
   */
  private get fullTableName(): string {
    return `[${this.schema}].[${this.tableName}]`;
  }

  /**
   * Initialize the connection pool if using config.
   */
  async initialize(): Promise<void> {
    if (this.poolConfig && !this.pool) {
      this.pool = await new ConnectionPool(this.poolConfig).connect();
    }
  }

  async getById(sagaName: string, sagaId: string): Promise<TState | null> {
    if (!this.pool) throw new Error("Store not initialized");

    const result = await this.pool
      .request()
      .input("id", sql.NVarChar(128), sagaId)
      .input("saga_name", sql.NVarChar(128), sagaName)
      .query<SagaInstanceRow>(
        `SELECT * FROM ${this.fullTableName} WHERE id = @id AND saga_name = @saga_name`
      );

    if (result.recordset.length === 0) {
      return null;
    }

    return this.rowToState(result.recordset[0]!);
  }

  async getByCorrelationId(
    sagaName: string,
    correlationId: string
  ): Promise<TState | null> {
    if (!this.pool) throw new Error("Store not initialized");

    const result = await this.pool
      .request()
      .input("saga_name", sql.NVarChar(128), sagaName)
      .input("correlation_id", sql.NVarChar(256), correlationId)
      .query<SagaInstanceRow>(
        `SELECT * FROM ${this.fullTableName} WHERE saga_name = @saga_name AND correlation_id = @correlation_id`
      );

    if (result.recordset.length === 0) {
      return null;
    }

    return this.rowToState(result.recordset[0]!);
  }

  async insert(
    sagaName: string,
    correlationId: string,
    state: TState
  ): Promise<void> {
    if (!this.pool) throw new Error("Store not initialized");

    const { sagaId, version, isCompleted, createdAt, updatedAt } =
      state.metadata;

    await this.pool
      .request()
      .input("id", sql.NVarChar(128), sagaId)
      .input("saga_name", sql.NVarChar(128), sagaName)
      .input("correlation_id", sql.NVarChar(256), correlationId)
      .input("version", sql.Int, version)
      .input("is_completed", sql.Bit, isCompleted ? 1 : 0)
      .input("state", sql.NVarChar(sql.MAX), JSON.stringify(state))
      .input("created_at", sql.DateTime2, createdAt)
      .input("updated_at", sql.DateTime2, updatedAt)
      .query(
        `INSERT INTO ${this.fullTableName}
         (id, saga_name, correlation_id, version, is_completed, state, created_at, updated_at)
         VALUES (@id, @saga_name, @correlation_id, @version, @is_completed, @state, @created_at, @updated_at)`
      );
  }

  async update(
    sagaName: string,
    state: TState,
    expectedVersion: number
  ): Promise<void> {
    if (!this.pool) throw new Error("Store not initialized");

    const { sagaId, version, isCompleted, updatedAt } = state.metadata;

    const result = await this.pool
      .request()
      .input("version", sql.Int, version)
      .input("is_completed", sql.Bit, isCompleted ? 1 : 0)
      .input("state", sql.NVarChar(sql.MAX), JSON.stringify(state))
      .input("updated_at", sql.DateTime2, updatedAt)
      .input("id", sql.NVarChar(128), sagaId)
      .input("saga_name", sql.NVarChar(128), sagaName)
      .input("expected_version", sql.Int, expectedVersion)
      .query(
        `UPDATE ${this.fullTableName}
         SET version = @version, is_completed = @is_completed, state = @state, updated_at = @updated_at
         WHERE id = @id AND saga_name = @saga_name AND version = @expected_version`
      );

    if (result.rowsAffected[0] === 0) {
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
    if (!this.pool) throw new Error("Store not initialized");

    await this.pool
      .request()
      .input("id", sql.NVarChar(128), sagaId)
      .input("saga_name", sql.NVarChar(128), sagaName)
      .query(
        `DELETE FROM ${this.fullTableName} WHERE id = @id AND saga_name = @saga_name`
      );
  }

  /**
   * Convert a database row to saga state.
   */
  private rowToState(row: SagaInstanceRow): TState {
    const state = JSON.parse(row.state) as TState;

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
    if (this.ownsPool && this.pool) {
      await this.pool.close();
    }
    this.pool = null;
  }

  /**
   * Get the underlying pool for advanced operations.
   */
  getPool(): ConnectionPool | null {
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
    if (!this.pool) throw new Error("Store not initialized");

    const request = this.pool
      .request()
      .input("saga_name", sql.NVarChar(128), sagaName);

    let query = `SELECT * FROM ${this.fullTableName} WHERE saga_name = @saga_name`;

    if (options?.completed !== undefined) {
      query += ` AND is_completed = @is_completed`;
      request.input("is_completed", sql.Bit, options.completed ? 1 : 0);
    }

    query += ` ORDER BY created_at DESC`;

    if (options?.offset !== undefined) {
      query += ` OFFSET @offset ROWS`;
      request.input("offset", sql.Int, options.offset);

      if (options?.limit !== undefined) {
        query += ` FETCH NEXT @limit ROWS ONLY`;
        request.input("limit", sql.Int, options.limit);
      }
    } else if (options?.limit !== undefined) {
      // SQL Server requires OFFSET when using FETCH
      query += ` OFFSET 0 ROWS FETCH NEXT @limit ROWS ONLY`;
      request.input("limit", sql.Int, options.limit);
    }

    const result = await request.query<SagaInstanceRow>(query);
    return result.recordset.map((row) => this.rowToState(row));
  }

  /**
   * Count sagas by name.
   */
  async countByName(
    sagaName: string,
    options?: { completed?: boolean }
  ): Promise<number> {
    if (!this.pool) throw new Error("Store not initialized");

    const request = this.pool
      .request()
      .input("saga_name", sql.NVarChar(128), sagaName);

    let query = `SELECT COUNT(*) as count FROM ${this.fullTableName} WHERE saga_name = @saga_name`;

    if (options?.completed !== undefined) {
      query += ` AND is_completed = @is_completed`;
      request.input("is_completed", sql.Bit, options.completed ? 1 : 0);
    }

    const result = await request.query<{ count: number }>(query);
    return result.recordset[0]?.count ?? 0;
  }

  /**
   * Delete completed sagas older than a given date.
   */
  async deleteCompletedBefore(
    sagaName: string,
    before: Date
  ): Promise<number> {
    if (!this.pool) throw new Error("Store not initialized");

    const result = await this.pool
      .request()
      .input("saga_name", sql.NVarChar(128), sagaName)
      .input("before", sql.DateTime2, before)
      .query(
        `DELETE FROM ${this.fullTableName}
         WHERE saga_name = @saga_name AND is_completed = 1 AND updated_at < @before`
      );

    return result.rowsAffected[0] ?? 0;
  }
}
