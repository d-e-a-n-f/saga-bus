# @saga-bus/store-sqlserver

SQL Server / Azure SQL Database saga store for saga-bus.

## Installation

```bash
npm install @saga-bus/store-sqlserver mssql
# or
pnpm add @saga-bus/store-sqlserver mssql
```

## Features

- **SQL Server 2016+**: Full support for modern SQL Server versions
- **Azure SQL Database**: Works with Azure SQL and Azure SQL Managed Instance
- **Optimistic Concurrency**: Version-based conflict detection
- **Schema Support**: Use custom schemas (default: "dbo")
- **Connection Pooling**: Built-in connection pool management
- **Query Helpers**: Find, count, and cleanup methods

## Quick Start

```typescript
import { createBus } from "@saga-bus/core";
import { SqlServerSagaStore } from "@saga-bus/store-sqlserver";

const store = new SqlServerSagaStore({
  pool: {
    server: "localhost",
    database: "sagas",
    user: "sa",
    password: "YourPassword123!",
    options: {
      trustServerCertificate: true, // For local development
    },
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
interface SqlServerSagaStoreOptions {
  /** Connection pool or pool configuration */
  pool: ConnectionPool | config;

  /** Table name for saga instances (default: "saga_instances") */
  tableName?: string;

  /** Schema name (default: "dbo") */
  schema?: string;
}
```

## Database Schema

Create the required table:

```sql
CREATE TABLE [dbo].[saga_instances] (
  id             NVARCHAR(128) NOT NULL,
  saga_name      NVARCHAR(128) NOT NULL,
  correlation_id NVARCHAR(256) NOT NULL,
  version        INT NOT NULL,
  is_completed   BIT NOT NULL DEFAULT 0,
  state          NVARCHAR(MAX) NOT NULL,
  created_at     DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
  updated_at     DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

  CONSTRAINT PK_saga_instances PRIMARY KEY (saga_name, id)
);

CREATE UNIQUE INDEX IX_saga_correlation
  ON [dbo].[saga_instances] (saga_name, correlation_id);

CREATE INDEX IX_saga_cleanup
  ON [dbo].[saga_instances] (saga_name, is_completed, updated_at)
  WHERE is_completed = 1;
```

## Examples

### Basic Usage

```typescript
import { SqlServerSagaStore } from "@saga-bus/store-sqlserver";

const store = new SqlServerSagaStore({
  pool: {
    server: "localhost",
    database: "sagas",
    user: "sa",
    password: "password",
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

### With Azure SQL Database

```typescript
const store = new SqlServerSagaStore({
  pool: {
    server: "your-server.database.windows.net",
    database: "sagas",
    authentication: {
      type: "azure-active-directory-default",
    },
    options: {
      encrypt: true,
    },
  },
});
```

### With Existing Connection Pool

```typescript
import { ConnectionPool } from "mssql";

const pool = new ConnectionPool({
  server: "localhost",
  database: "sagas",
  user: "sa",
  password: "password",
});

await pool.connect();

const store = new SqlServerSagaStore({
  pool, // Use existing pool
  schema: "app",
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

For local development, you can run SQL Server in Docker:

```bash
docker run -e "ACCEPT_EULA=Y" -e "SA_PASSWORD=YourPassword123!" \
  -p 1433:1433 --name sqlserver \
  mcr.microsoft.com/mssql/server:2022-latest
```

Then create the database and table:

```bash
docker exec -it sqlserver /opt/mssql-tools/bin/sqlcmd \
  -S localhost -U sa -P YourPassword123! \
  -Q "CREATE DATABASE sagas"
```

For unit tests, use an in-memory store:

```typescript
import { InMemorySagaStore } from "@saga-bus/core";

const testStore = new InMemorySagaStore();
```

## License

MIT
