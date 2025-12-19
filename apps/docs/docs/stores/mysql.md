---
sidebar_position: 4
title: MySQL
---

# MySQL Store

Production-ready store using MySQL/MariaDB with JSON support.

## Installation

```bash npm2yarn
npm install @saga-bus/store-mysql mysql2
```

## Basic Usage

```typescript
import { MySqlSagaStore } from '@saga-bus/store-mysql';

const store = new MySqlSagaStore({
  connectionString: 'mysql://user:pass@localhost:3306/mydb',
});

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
| `connectionString` | `string` | - | MySQL connection string |
| `host` | `string` | `'localhost'` | MySQL host |
| `port` | `number` | `3306` | MySQL port |
| `user` | `string` | Required | Database user |
| `password` | `string` | Required | Database password |
| `database` | `string` | Required | Database name |
| `pool` | `Pool` | - | Existing mysql2 Pool |
| `tableName` | `string` | `'sagas'` | Table name |

## Full Configuration Example

```typescript
import { MySqlSagaStore, createSchema } from '@saga-bus/store-mysql';
import mysql from 'mysql2/promise';

// Option 1: Connection string
const store = new MySqlSagaStore({
  connectionString: process.env.MYSQL_URL,
});

// Option 2: Individual settings
const store = new MySqlSagaStore({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'password',
  database: 'sagas',
  tableName: 'saga_instances',
});

// Option 3: Existing pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'sagas',
  connectionLimit: 20,
  waitForConnections: true,
});

const store = new MySqlSagaStore({ pool });
```

## Schema Setup

### Automatic

```typescript
import { createSchema } from '@saga-bus/store-mysql';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({ uri: process.env.MYSQL_URL });
await createSchema(pool);
```

### Manual Migration

```typescript
import { getSchemaSql } from '@saga-bus/store-mysql';

const sql = getSchemaSql();
// Add to your migration tool
```

### SQL Schema

```sql
CREATE TABLE IF NOT EXISTS sagas (
  saga_name VARCHAR(255) NOT NULL,
  saga_id CHAR(36) NOT NULL,
  correlation_id VARCHAR(255) NOT NULL,
  version INT NOT NULL DEFAULT 1,
  state JSON NOT NULL,
  is_completed TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (saga_name, saga_id),
  INDEX idx_sagas_correlation (saga_name, correlation_id),
  INDEX idx_sagas_completed (saga_name, is_completed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## Connection Pooling

Configure the pool for production:

```typescript
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  uri: process.env.MYSQL_URL,
  connectionLimit: 20,
  waitForConnections: true,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

const store = new MySqlSagaStore({ pool });
```

## Docker Setup

```yaml
# docker-compose.yml
services:
  mysql:
    image: mysql:8
    environment:
      MYSQL_ROOT_PASSWORD: password
      MYSQL_DATABASE: sagas
    ports:
      - "3306:3306"
    command: --default-authentication-plugin=mysql_native_password
```

## MariaDB Support

Works with MariaDB 10.2+:

```yaml
services:
  mariadb:
    image: mariadb:10.6
    environment:
      MARIADB_ROOT_PASSWORD: password
      MARIADB_DATABASE: sagas
    ports:
      - "3306:3306"
```

## Optimistic Concurrency

Version-based conflict detection:

```typescript
// Built-in optimistic locking
// Throws ConcurrencyError on version mismatch
try {
  await store.update(sagaName, state, expectedVersion);
} catch (error) {
  if (error instanceof ConcurrencyError) {
    // Handle conflict - re-read and retry
  }
}
```

## Best Practices

### Use InnoDB Engine

```sql
-- InnoDB provides ACID compliance
ENGINE=InnoDB
```

### Configure Character Set

```sql
-- Support full Unicode
CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

### Index Strategy

```sql
-- Primary key for direct lookups
PRIMARY KEY (saga_name, saga_id)

-- Correlation index for message routing
INDEX idx_sagas_correlation (saga_name, correlation_id)
```

## See Also

- [Stores Overview](/docs/stores/overview)
- [PostgreSQL Store](/docs/stores/postgres)
- [Error Handling](/docs/core-concepts/error-handling)
