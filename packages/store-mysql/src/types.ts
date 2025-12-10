import type * as mysql from "mysql2/promise";

export type Pool = mysql.Pool;
export type PoolOptions = mysql.PoolOptions;

/**
 * Options for creating a MySqlSagaStore.
 */
export interface MySqlSagaStoreOptions {
  /**
   * MySQL connection pool or pool configuration.
   */
  pool: Pool | PoolOptions;

  /**
   * Table name for saga instances. Default: "saga_instances"
   */
  tableName?: string;
}

/**
 * Row structure in the saga_instances table.
 */
export interface SagaInstanceRow {
  id: string;
  saga_name: string;
  correlation_id: string;
  version: number;
  is_completed: number; // MySQL uses TINYINT(1) for boolean
  state: string; // JSON string
  created_at: Date;
  updated_at: Date;
}
