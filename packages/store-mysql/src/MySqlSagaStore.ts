import * as mysql from "mysql2/promise";
import type { SagaStore, SagaState } from "@saga-bus/core";
import { ConcurrencyError } from "@saga-bus/core";
import type { MySqlSagaStoreOptions, SagaInstanceRow } from "./types.js";

type RowDataPacket = mysql.RowDataPacket;
type ResultSetHeader = mysql.ResultSetHeader;
type PoolOptions = mysql.PoolOptions;
type FieldPacket = mysql.FieldPacket;

// mysql2 types have issues with the mixin pattern, so we define our own interface
interface QueryablePool {
  query<T extends mysql.RowDataPacket[][] | mysql.RowDataPacket[] | mysql.OkPacket | mysql.OkPacket[] | mysql.ResultSetHeader>(
    sql: string,
    values?: unknown[]
  ): Promise<[T, FieldPacket[]]>;
  end(): Promise<void>;
  getConnection(): Promise<mysql.PoolConnection>;
}

/**
 * MySQL-backed saga store for saga-bus.
 *
 * @example
 * ```typescript
 * const store = new MySqlSagaStore<OrderState>({
 *   pool: {
 *     host: "localhost",
 *     user: "root",
 *     password: "password",
 *     database: "sagas",
 *   },
 * });
 *
 * await store.initialize();
 * ```
 */
export class MySqlSagaStore<TState extends SagaState>
  implements SagaStore<TState>
{
  private pool: QueryablePool | null = null;
  private readonly poolOptions: PoolOptions | null;
  private readonly tableName: string;
  private readonly ownsPool: boolean;

  constructor(options: MySqlSagaStoreOptions) {
    // Check if it's a Pool by looking for query method
    if (typeof (options.pool as QueryablePool).query === "function") {
      this.pool = options.pool as QueryablePool;
      this.poolOptions = null;
      this.ownsPool = false;
    } else {
      this.poolOptions = options.pool as PoolOptions;
      this.ownsPool = true;
    }

    this.tableName = options.tableName ?? "saga_instances";
  }

  /**
   * Initialize the connection pool if using config.
   */
  async initialize(): Promise<void> {
    if (this.poolOptions && !this.pool) {
      this.pool = mysql.createPool(this.poolOptions) as unknown as QueryablePool;
    }
  }

  async getById(sagaName: string, sagaId: string): Promise<TState | null> {
    if (!this.pool) throw new Error("Store not initialized");

    const [rows] = await this.pool.query<(SagaInstanceRow & RowDataPacket)[]>(
      `SELECT * FROM \`${this.tableName}\` WHERE id = ? AND saga_name = ?`,
      [sagaId, sagaName]
    );

    if (rows.length === 0) {
      return null;
    }

    return this.rowToState(rows[0]!);
  }

  async getByCorrelationId(
    sagaName: string,
    correlationId: string
  ): Promise<TState | null> {
    if (!this.pool) throw new Error("Store not initialized");

    const [rows] = await this.pool.query<(SagaInstanceRow & RowDataPacket)[]>(
      `SELECT * FROM \`${this.tableName}\` WHERE saga_name = ? AND correlation_id = ?`,
      [sagaName, correlationId]
    );

    if (rows.length === 0) {
      return null;
    }

    return this.rowToState(rows[0]!);
  }

  async insert(
    sagaName: string,
    correlationId: string,
    state: TState
  ): Promise<void> {
    if (!this.pool) throw new Error("Store not initialized");

    const { sagaId, version, isCompleted, createdAt, updatedAt } =
      state.metadata;

    await this.pool.query(
      `INSERT INTO \`${this.tableName}\`
       (id, saga_name, correlation_id, version, is_completed, state, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sagaId,
        sagaName,
        correlationId,
        version,
        isCompleted ? 1 : 0,
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
    if (!this.pool) throw new Error("Store not initialized");

    const { sagaId, version, isCompleted, updatedAt } = state.metadata;

    const [result] = await this.pool.query<ResultSetHeader>(
      `UPDATE \`${this.tableName}\`
       SET version = ?, is_completed = ?, state = ?, updated_at = ?
       WHERE id = ? AND saga_name = ? AND version = ?`,
      [
        version,
        isCompleted ? 1 : 0,
        JSON.stringify(state),
        updatedAt,
        sagaId,
        sagaName,
        expectedVersion,
      ]
    );

    if (result.affectedRows === 0) {
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

    await this.pool.query(
      `DELETE FROM \`${this.tableName}\` WHERE id = ? AND saga_name = ?`,
      [sagaId, sagaName]
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
        isCompleted: row.is_completed === 1,
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
      await this.pool.end();
    }
    this.pool = null;
  }

  /**
   * Get the underlying pool for advanced operations.
   */
  getPool(): QueryablePool | null {
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

    let query = `SELECT * FROM \`${this.tableName}\` WHERE saga_name = ?`;
    const params: (string | number | boolean)[] = [sagaName];

    if (options?.completed !== undefined) {
      query += ` AND is_completed = ?`;
      params.push(options.completed ? 1 : 0);
    }

    query += ` ORDER BY created_at DESC`;

    if (options?.limit !== undefined) {
      query += ` LIMIT ?`;
      params.push(options.limit);
    }

    if (options?.offset !== undefined) {
      query += ` OFFSET ?`;
      params.push(options.offset);
    }

    const [rows] = await this.pool.query<(SagaInstanceRow & RowDataPacket)[]>(
      query,
      params
    );

    return rows.map((row) => this.rowToState(row));
  }

  /**
   * Count sagas by name.
   */
  async countByName(
    sagaName: string,
    options?: { completed?: boolean }
  ): Promise<number> {
    if (!this.pool) throw new Error("Store not initialized");

    let query = `SELECT COUNT(*) as count FROM \`${this.tableName}\` WHERE saga_name = ?`;
    const params: (string | number)[] = [sagaName];

    if (options?.completed !== undefined) {
      query += ` AND is_completed = ?`;
      params.push(options.completed ? 1 : 0);
    }

    const [rows] = await this.pool.query<({ count: number } & RowDataPacket)[]>(
      query,
      params
    );

    return rows[0]?.count ?? 0;
  }

  /**
   * Delete completed sagas older than a given date.
   */
  async deleteCompletedBefore(
    sagaName: string,
    before: Date
  ): Promise<number> {
    if (!this.pool) throw new Error("Store not initialized");

    const [result] = await this.pool.query<ResultSetHeader>(
      `DELETE FROM \`${this.tableName}\`
       WHERE saga_name = ? AND is_completed = 1 AND updated_at < ?`,
      [sagaName, before]
    );

    return result.affectedRows;
  }
}
