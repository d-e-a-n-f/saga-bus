# @saga-bus/store-postgres

PostgreSQL saga store using native pg driver.

## Installation

```bash
pnpm add @saga-bus/store-postgres pg
```

## Usage

```typescript
import { Pool } from "pg";
import { PostgresSagaStore, createSchema } from "@saga-bus/store-postgres";
import { createBus } from "@saga-bus/core";

const pool = new Pool({
  connectionString: "postgresql://user:pass@localhost:5432/mydb",
});

// Initialize schema (run once)
await createSchema(pool);

const store = new PostgresSagaStore({ pool });

const bus = createBus({
  sagas: [{ definition: mySaga, store }],
  transport,
});
```

## Database Schema

The `createSchema` function creates:

```sql
CREATE TABLE saga_instances (
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
```

## Features

- Optimistic concurrency with version column
- JSONB state storage
- Connection pooling
- Indexed lookups by correlation ID
- Cleanup helpers for completed sagas

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `pool` | `Pool` | required | pg Pool instance |
| `schema` | `string` | `"public"` | Database schema |
| `tableName` | `string` | `"saga_instances"` | Table name |

## Sharing Across Sagas

A single store instance can be shared across multiple sagas:

```typescript
const store = new PostgresSagaStore({ pool });

const bus = createBus({
  transport,
  store, // shared by all sagas
  sagas: [
    { definition: orderSaga },
    { definition: paymentSaga },
  ],
});
```

Data is isolated by `saga_name` in the database, so different saga types won't conflict.

## License

MIT
