---
sidebar_position: 3
---

# PostgreSQL Store

Production-ready store using PostgreSQL.

## Installation

```bash npm2yarn
npm install @saga-bus/store-postgres pg
```

## Basic Usage

```typescript
import { PostgresSagaStore } from '@saga-bus/store-postgres';

const store = new PostgresSagaStore({
  connectionString: 'postgres://user:pass@localhost:5432/mydb',
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `connectionString` | `string` | Required | PostgreSQL connection string |
| `pool` | `Pool` | - | Existing pg Pool instance |
| `tableName` | `string` | `'sagas'` | Table name |
| `schema` | `string` | `'public'` | Schema name |

## Schema Setup

### Automatic

```typescript
import { createSchema } from '@saga-bus/store-postgres';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
await createSchema(pool);
```

### Manual Migration

```typescript
import { getSchemaSql } from '@saga-bus/store-postgres';

const sql = getSchemaSql();
// Add to your migration tool
```

### SQL Schema

```sql
CREATE TABLE IF NOT EXISTS sagas (
  saga_name VARCHAR(255) NOT NULL,
  saga_id UUID NOT NULL,
  correlation_id VARCHAR(255) NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  state JSONB NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (saga_name, saga_id)
);

CREATE INDEX idx_sagas_correlation ON sagas (saga_name, correlation_id);
CREATE INDEX idx_sagas_completed ON sagas (saga_name, is_completed);
```

## Full Example

```typescript
import { createBus } from '@saga-bus/core';
import { RabbitMqTransport } from '@saga-bus/transport-rabbitmq';
import { PostgresSagaStore, createSchema } from '@saga-bus/store-postgres';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
});

// Create schema if needed
await createSchema(pool);

const store = new PostgresSagaStore({ pool });
const transport = new RabbitMqTransport({ url: process.env.RABBITMQ_URL });

const bus = createBus({
  transport,
  store,
  sagas: [{ definition: orderSaga }],
});

await bus.start();
```

## Docker Setup

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: sagas
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
```
