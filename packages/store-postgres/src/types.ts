import type { Pool, PoolConfig } from "pg";

/**
 * Options for creating a PostgresSagaStore.
 */
export interface PostgresSagaStoreOptions {
  /**
   * PostgreSQL connection pool or pool configuration.
   */
  pool: Pool | PoolConfig;

  /**
   * Table name for saga instances. Default: "saga_instances"
   */
  tableName?: string;

  /**
   * Schema name. Default: "public"
   */
  schema?: string;
}

/**
 * Row structure in the saga_instances table.
 */
export interface SagaInstanceRow {
  id: string;
  saga_name: string;
  correlation_id: string;
  version: number;
  is_completed: boolean;
  state: unknown; // JSONB
  created_at: Date;
  updated_at: Date;
}
