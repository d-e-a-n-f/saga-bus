---
sidebar_position: 9
title: SQLite
---

# SQLite Store

Perfect for local development and testing with zero configuration.

## Installation

```bash npm2yarn
npm install @saga-bus/store-sqlite better-sqlite3
```

## Basic Usage

```typescript
import Database from 'better-sqlite3';
import { SqliteSagaStore, createSchema } from '@saga-bus/store-sqlite';

// In-memory for tests
const db = new Database(':memory:');
createSchema(db);

const store = new SqliteSagaStore({ db });

const bus = createBus({
  transport,
  store,
  sagas: [{ definition: orderSaga }],
});

await bus.start();
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `db` | `Database` | Required | better-sqlite3 Database instance |
| `tableName` | `string` | `'sagas'` | Table name |

## Full Configuration Example

```typescript
import Database from 'better-sqlite3';
import { SqliteSagaStore, createSchema } from '@saga-bus/store-sqlite';

// Option 1: In-memory (tests)
const db = new Database(':memory:');

// Option 2: File-based (development)
const db = new Database('sagas.db');

// Option 3: With options
const db = new Database('sagas.db', {
  verbose: console.log, // Log queries
  fileMustExist: false, // Create if not exists
});

// Create schema
createSchema(db);

// Create store
const store = new SqliteSagaStore({
  db,
  tableName: 'saga_instances',
});
```

## Schema

### Automatic

```typescript
import { createSchema } from '@saga-bus/store-sqlite';

createSchema(db);
```

### Manual

```sql
CREATE TABLE IF NOT EXISTS sagas (
  saga_name TEXT NOT NULL,
  saga_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  state TEXT NOT NULL,
  is_completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (saga_name, saga_id)
);

CREATE INDEX IF NOT EXISTS idx_sagas_correlation
ON sagas (saga_name, correlation_id);

CREATE INDEX IF NOT EXISTS idx_sagas_completed
ON sagas (saga_name, is_completed);
```

## Test Example

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { SqliteSagaStore, createSchema } from '@saga-bus/store-sqlite';
import { InMemoryTransport } from '@saga-bus/transport-inmemory';
import { createBus } from '@saga-bus/core';

describe('OrderSaga', () => {
  let db: Database.Database;
  let store: SqliteSagaStore;
  let transport: InMemoryTransport;

  beforeEach(() => {
    db = new Database(':memory:');
    createSchema(db);
    store = new SqliteSagaStore({ db });
    transport = new InMemoryTransport();
  });

  afterEach(() => {
    db.close();
  });

  it('processes order flow', async () => {
    const bus = createBus({
      transport,
      store,
      sagas: [{ definition: orderSaga }],
    });

    await bus.start();
    await bus.publish({ type: 'OrderSubmitted', orderId: '123' });
    // assertions...
    await bus.stop();
  });
});
```

## When to Use

- **Unit tests** - Fastest option, no setup needed
- **Integration tests** - Real SQL without Docker
- **Local development** - Persistent dev database
- **Prototyping** - Quick iteration
- **CI/CD** - No external dependencies

## When NOT to Use

- Production deployments
- Multi-process applications
- High-concurrency scenarios
- Distributed systems

## Synchronous Operations

better-sqlite3 is synchronous for performance:

```typescript
// All operations are synchronous under the hood
// Wrapped in Promise for interface compatibility
const saga = await store.getById('OrderSaga', '123');
```

## WAL Mode

Enable WAL for better concurrency:

```typescript
const db = new Database('sagas.db');
db.pragma('journal_mode = WAL');

createSchema(db);
const store = new SqliteSagaStore({ db });
```

## Best Practices

### Use In-Memory for Tests

```typescript
// Fastest option for unit tests
const db = new Database(':memory:');
```

### Close Database After Tests

```typescript
afterEach(() => {
  db.close();
});
```

### Use WAL for Development

```typescript
// Better concurrent read performance
db.pragma('journal_mode = WAL');
```

## Limitations

- Single-process only
- No concurrent writes across processes
- Limited to local file system
- Not suitable for production

## Migration to Production

When ready for production, switch to a production store:

```typescript
// Development
import { SqliteSagaStore } from '@saga-bus/store-sqlite';
const store = new SqliteSagaStore({ db });

// Production
import { PostgresSagaStore } from '@saga-bus/store-postgres';
const store = new PostgresSagaStore({ connectionString: process.env.DATABASE_URL });
```

## See Also

- [Stores Overview](/docs/stores/overview)
- [In-Memory Store](/docs/stores/inmemory)
- [PostgreSQL Store](/docs/stores/postgres)
- [Testing](/docs/testing/overview)
