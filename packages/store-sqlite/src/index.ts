import type { SagaStore, SagaState } from "@saga-bus/core";
import { ConcurrencyError } from "@saga-bus/core";
import type Database from "better-sqlite3";

export interface SqliteSagaStoreOptions {
  /** better-sqlite3 database instance */
  db: Database.Database;
  /** Table name for saga states (default: 'saga_states') */
  tableName?: string;
}

interface StoredSaga {
  saga_name: string;
  saga_id: string;
  correlation_id: string;
  state: string;
  version: number;
  created_at: string;
  updated_at: string;
}

/**
 * SQLite saga store - perfect for local development and testing.
 *
 * @example
 * ```typescript
 * import Database from 'better-sqlite3';
 * import { SqliteSagaStore, createSchema } from '@saga-bus/store-sqlite';
 *
 * const db = new Database(':memory:'); // or 'path/to/db.sqlite'
 * createSchema(db);
 *
 * const store = new SqliteSagaStore({ db });
 * ```
 */
export class SqliteSagaStore<TState extends SagaState>
  implements SagaStore<TState>
{
  private readonly db: Database.Database;
  private readonly tableName: string;
  private readonly statements: {
    getById: Database.Statement;
    getByCorrelationId: Database.Statement;
    insert: Database.Statement;
    update: Database.Statement;
    delete: Database.Statement;
  };

  constructor(options: SqliteSagaStoreOptions) {
    this.db = options.db;
    this.tableName = options.tableName ?? "saga_states";

    // Prepare statements for better performance
    this.statements = {
      getById: this.db.prepare(`
        SELECT saga_name, saga_id, correlation_id, state, version, created_at, updated_at
        FROM ${this.tableName}
        WHERE saga_name = ? AND saga_id = ?
      `),
      getByCorrelationId: this.db.prepare(`
        SELECT saga_name, saga_id, correlation_id, state, version, created_at, updated_at
        FROM ${this.tableName}
        WHERE saga_name = ? AND correlation_id = ?
      `),
      insert: this.db.prepare(`
        INSERT INTO ${this.tableName} (saga_name, saga_id, correlation_id, state, version, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `),
      update: this.db.prepare(`
        UPDATE ${this.tableName}
        SET state = ?, version = ?, updated_at = ?
        WHERE saga_name = ? AND saga_id = ? AND version = ?
      `),
      delete: this.db.prepare(`
        DELETE FROM ${this.tableName}
        WHERE saga_name = ? AND saga_id = ?
      `),
    };
  }

  private parseRow(row: StoredSaga): TState {
    return JSON.parse(row.state) as TState;
  }

  async getById(sagaName: string, sagaId: string): Promise<TState | null> {
    const row = this.statements.getById.get(sagaName, sagaId) as
      | StoredSaga
      | undefined;

    if (!row) {
      return null;
    }

    return this.parseRow(row);
  }

  async getByCorrelationId(
    sagaName: string,
    correlationId: string
  ): Promise<TState | null> {
    const row = this.statements.getByCorrelationId.get(
      sagaName,
      correlationId
    ) as StoredSaga | undefined;

    if (!row) {
      return null;
    }

    return this.parseRow(row);
  }

  async insert(
    sagaName: string,
    correlationId: string,
    state: TState
  ): Promise<void> {
    const { sagaId, version, createdAt, updatedAt } = state.metadata;
    const stateJson = JSON.stringify(state);

    try {
      this.statements.insert.run(
        sagaName,
        sagaId,
        correlationId,
        stateJson,
        version,
        createdAt.toISOString(),
        updatedAt.toISOString()
      );
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message.includes("UNIQUE constraint failed")
      ) {
        throw new Error(`Saga ${sagaId} already exists`);
      }
      throw error;
    }
  }

  async update(
    sagaName: string,
    state: TState,
    expectedVersion: number
  ): Promise<void> {
    const { sagaId, version, updatedAt } = state.metadata;
    const stateJson = JSON.stringify(state);

    const result = this.statements.update.run(
      stateJson,
      version,
      updatedAt.toISOString(),
      sagaName,
      sagaId,
      expectedVersion
    );

    if (result.changes === 0) {
      // Either saga doesn't exist or version mismatch
      const existing = await this.getById(sagaName, sagaId);

      if (!existing) {
        throw new Error(`Saga ${sagaId} not found`);
      }

      throw new ConcurrencyError(
        sagaId,
        expectedVersion,
        existing.metadata.version
      );
    }
  }

  async delete(sagaName: string, sagaId: string): Promise<void> {
    this.statements.delete.run(sagaName, sagaId);
  }
}

/**
 * Create the saga_states table in the SQLite database.
 *
 * @example
 * ```typescript
 * import Database from 'better-sqlite3';
 * import { createSchema } from '@saga-bus/store-sqlite';
 *
 * const db = new Database('sagas.db');
 * createSchema(db);
 * ```
 */
export function createSchema(
  db: Database.Database,
  tableName: string = "saga_states"
): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      saga_name TEXT NOT NULL,
      saga_id TEXT NOT NULL,
      correlation_id TEXT NOT NULL,
      state TEXT NOT NULL,
      version INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (saga_name, saga_id)
    );

    CREATE INDEX IF NOT EXISTS idx_${tableName}_correlation
    ON ${tableName} (saga_name, correlation_id);

    CREATE INDEX IF NOT EXISTS idx_${tableName}_updated_at
    ON ${tableName} (updated_at);
  `);
}
