-- Initialize saga_instances table
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

-- Index for correlation ID lookups
CREATE INDEX IF NOT EXISTS idx_saga_instances_correlation
  ON saga_instances (saga_name, correlation_id);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_saga_instances_completed
  ON saga_instances (is_completed, updated_at);
