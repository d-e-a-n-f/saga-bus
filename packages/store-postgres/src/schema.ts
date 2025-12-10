import type { Pool } from "pg";

/**
 * Get the schema SQL content.
 */
export function getSchemaSql(): string {
  return `
-- Saga instances table
CREATE TABLE IF NOT EXISTS saga_instances (
  id             VARCHAR(128) NOT NULL,
  saga_name      VARCHAR(128) NOT NULL,
  correlation_id VARCHAR(256) NOT NULL,
  version        INTEGER NOT NULL,
  is_completed   BOOLEAN NOT NULL DEFAULT FALSE,
  state          JSONB NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (saga_name, id)
);

-- Index for looking up sagas by name
CREATE INDEX IF NOT EXISTS idx_saga_instances_saga_name
  ON saga_instances (saga_name);

-- Index for correlation ID lookups (saga_name + correlation_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_saga_instances_correlation
  ON saga_instances (saga_name, correlation_id);

-- Index for finding incomplete sagas
CREATE INDEX IF NOT EXISTS idx_saga_instances_incomplete
  ON saga_instances (saga_name, is_completed)
  WHERE is_completed = FALSE;

-- Index for cleanup queries (completed + updated_at)
CREATE INDEX IF NOT EXISTS idx_saga_instances_cleanup
  ON saga_instances (saga_name, is_completed, updated_at)
  WHERE is_completed = TRUE;
`.trim();
}

/**
 * Create the saga_instances table and indexes.
 */
export async function createSchema(
  pool: Pool,
  options?: { schema?: string; tableName?: string }
): Promise<void> {
  const schema = options?.schema ?? "public";
  const tableName = options?.tableName ?? "saga_instances";

  // Set search path to the schema
  await pool.query(`SET search_path TO ${schema}`);

  // Create table with custom name if specified
  let sql = getSchemaSql();
  if (tableName !== "saga_instances") {
    sql = sql.replace(/saga_instances/g, tableName);
  }

  await pool.query(sql);
}

/**
 * Drop the saga_instances table.
 */
export async function dropSchema(
  pool: Pool,
  options?: { schema?: string; tableName?: string }
): Promise<void> {
  const schema = options?.schema ?? "public";
  const tableName = options?.tableName ?? "saga_instances";

  await pool.query(`DROP TABLE IF EXISTS ${schema}.${tableName} CASCADE`);
}
