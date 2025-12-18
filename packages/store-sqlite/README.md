# @saga-bus/store-sqlite

SQLite saga store for saga-bus - perfect for local development and testing.

## Installation

```bash
pnpm add @saga-bus/store-sqlite better-sqlite3
```

## Usage

```typescript
import Database from "better-sqlite3";
import { SqliteSagaStore, createSchema } from "@saga-bus/store-sqlite";
import { createBus } from "@saga-bus/core";

// Create database (use ':memory:' for in-memory or a file path)
const db = new Database(":memory:");

// Initialize schema (run once)
createSchema(db);

// Create store
const store = new SqliteSagaStore({ db });

// Use with saga-bus
const bus = createBus({
  sagas: [{ definition: mySaga, store }],
  transport,
});

await bus.start();
```

## Features

- **Zero Docker required** - perfect for local development and testing
- **In-memory mode** - use `':memory:'` for fast unit tests
- **File-based** - persist to disk for development
- **Synchronous operations** - uses better-sqlite3 for maximum performance
- **Optimistic concurrency** - version-based conflict detection

## API

### `SqliteSagaStore`

```typescript
const store = new SqliteSagaStore({
  db: Database,           // better-sqlite3 database instance
  tableName?: string,     // Table name (default: 'saga_states')
});
```

### `createSchema`

Creates the required table in the database:

```typescript
createSchema(db);
// Or with custom table name:
createSchema(db, "my_saga_states");
```

## License

MIT
