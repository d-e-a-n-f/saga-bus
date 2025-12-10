import type { ConnectionPool, config } from "mssql";

/**
 * Options for creating a SqlServerSagaStore.
 */
export interface SqlServerSagaStoreOptions {
  /**
   * SQL Server connection pool or pool configuration.
   */
  pool: ConnectionPool | config;

  /**
   * Table name for saga instances. Default: "saga_instances"
   */
  tableName?: string;

  /**
   * Schema name. Default: "dbo"
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
  state: string; // NVARCHAR(MAX) JSON
  created_at: Date;
  updated_at: Date;
}
