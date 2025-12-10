# @saga-bus/store-mysql

MySQL / MariaDB saga store for saga-bus.

## Installation

```bash
npm install @saga-bus/store-mysql mysql2
# or
pnpm add @saga-bus/store-mysql mysql2
```

## Features

- **MySQL 5.7+**: Native JSON column support
- **MariaDB 10.2+**: Compatible with MariaDB
- **Cloud Databases**: Works with PlanetScale, Vitess, AWS Aurora
- **Optimistic Concurrency**: Version-based conflict detection
- **Connection Pooling**: Built-in pool management
- **Query Helpers**: Find, count, and cleanup methods

## Quick Start

```typescript
import { createBus } from "@saga-bus/core";
import { MySqlSagaStore } from "@saga-bus/store-mysql";

const store = new MySqlSagaStore({
  pool: {
    host: "localhost",
    user: "root",
    password: "password",
    database: "sagas",
  },
});

await store.initialize();

const bus = createBus({
  store,
  // ... other config
});

await bus.start();
```

## Configuration

```typescript
interface MySqlSagaStoreOptions {
  /** Connection pool or pool configuration */
  pool: Pool | PoolOptions;

  /** Table name for saga instances (default: "saga_instances") */
  tableName?: string;
}
```

## Database Schema

Create the required table:

```sql
CREATE TABLE saga_instances (
  id             VARCHAR(128) NOT NULL,
  saga_name      VARCHAR(128) NOT NULL,
  correlation_id VARCHAR(256) NOT NULL,
  version        INT NOT NULL,
  is_completed   BOOLEAN NOT NULL DEFAULT FALSE,
  state          JSON NOT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (saga_name, id),
  UNIQUE KEY idx_correlation (saga_name, correlation_id),
  KEY idx_cleanup (saga_name, is_completed, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## Examples

### Basic Usage

```typescript
import { MySqlSagaStore } from "@saga-bus/store-mysql";

const store = new MySqlSagaStore({
  pool: {
    host: "localhost",
    user: "root",
    password: "password",
    database: "sagas",
  },
});

await store.initialize();

// Find by saga ID
const state = await store.getById("OrderSaga", "saga-123");

// Find by correlation ID
const stateByCorr = await store.getByCorrelationId("OrderSaga", "order-456");

// Insert new saga
await store.insert("OrderSaga", "order-789", {
  orderId: "order-789",
  status: "pending",
  metadata: {
    sagaId: "saga-new",
    version: 1,
    isCompleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
    timeoutMs: null,
    timeoutExpiresAt: null,
  },
});

// Update with concurrency check
await store.update("OrderSaga", updatedState, expectedVersion);

// Delete
await store.delete("OrderSaga", "saga-123");
```

### With PlanetScale

```typescript
const store = new MySqlSagaStore({
  pool: {
    host: "aws.connect.psdb.cloud",
    user: "your-username",
    password: "your-password",
    database: "your-database",
    ssl: { rejectUnauthorized: true },
  },
});
```

### With Existing Connection Pool

```typescript
import { createPool } from "mysql2/promise";

const pool = createPool({
  host: "localhost",
  user: "root",
  password: "password",
  database: "sagas",
  connectionLimit: 10,
});

const store = new MySqlSagaStore({
  pool, // Use existing pool
});

await store.initialize();
```

### Query Helpers

```typescript
// Find sagas by name with pagination
const sagas = await store.findByName("OrderSaga", {
  limit: 10,
  offset: 0,
  completed: false,
});

// Count sagas
const total = await store.countByName("OrderSaga");
const completed = await store.countByName("OrderSaga", { completed: true });

// Cleanup old completed sagas
const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
const deleted = await store.deleteCompletedBefore("OrderSaga", oneWeekAgo);
console.log(`Deleted ${deleted} completed sagas`);
```

## Optimistic Concurrency

The store uses version-based optimistic concurrency control:

```typescript
// Read current state
const state = await store.getById("OrderSaga", "saga-123");
const expectedVersion = state.metadata.version;

// Make changes
state.status = "completed";
state.metadata.version += 1;
state.metadata.updatedAt = new Date();

try {
  // Update with version check
  await store.update("OrderSaga", state, expectedVersion);
} catch (error) {
  if (error instanceof ConcurrencyError) {
    // State was modified by another process
    // Reload and retry
  }
}
```

## Error Handling

```typescript
import { ConcurrencyError } from "@saga-bus/core";

try {
  await store.update("OrderSaga", state, expectedVersion);
} catch (error) {
  if (error instanceof ConcurrencyError) {
    console.log(`Concurrency conflict: expected v${error.expectedVersion}, actual v${error.actualVersion}`);
  }
}
```

## Testing

For local development, you can run MySQL in Docker:

```bash
docker run -e MYSQL_ROOT_PASSWORD=password -e MYSQL_DATABASE=sagas \
  -p 3306:3306 --name mysql \
  mysql:8
```

Then create the table:

```bash
docker exec -it mysql mysql -uroot -ppassword sagas -e "
CREATE TABLE saga_instances (
  id VARCHAR(128) NOT NULL,
  saga_name VARCHAR(128) NOT NULL,
  correlation_id VARCHAR(256) NOT NULL,
  version INT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  state JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (saga_name, id),
  UNIQUE KEY idx_correlation (saga_name, correlation_id),
  KEY idx_cleanup (saga_name, is_completed, updated_at)
) ENGINE=InnoDB;
"
```

For unit tests, use an in-memory store:

```typescript
import { InMemorySagaStore } from "@saga-bus/core";

const testStore = new InMemorySagaStore();
```

## License

MIT
