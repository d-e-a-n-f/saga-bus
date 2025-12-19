---
sidebar_position: 1
---

# Stores Overview

Stores persist saga state to databases.

## Choosing a Store

| Store | Best For | Features |
|-------|----------|----------|
| [PostgreSQL](/docs/stores/postgres) | General purpose | ACID, JSON support |
| [MySQL](/docs/stores/mysql) | MySQL shops | Wide compatibility |
| [SQL Server](/docs/stores/sqlserver) | Microsoft stack | Enterprise features |
| [MongoDB](/docs/stores/mongodb) | Document-oriented | Flexible schema |
| [DynamoDB](/docs/stores/dynamodb) | AWS serverless | Auto-scaling |
| [Redis](/docs/stores/redis) | High performance | TTL support |
| [SQLite](/docs/stores/sqlite) | Local development | Zero config |
| [Prisma](/docs/stores/prisma) | ORM users | Type-safe queries |
| [In-Memory](/docs/stores/inmemory) | Testing | No persistence |

## Store Interface

All stores implement:

```typescript
interface SagaStore<TState extends SagaState> {
  getById(sagaName: string, sagaId: string): Promise<TState | null>;
  getByCorrelationId(sagaName: string, correlationId: string): Promise<TState | null>;
  insert(sagaName: string, correlationId: string, state: TState): Promise<void>;
  update(sagaName: string, state: TState, expectedVersion: number): Promise<void>;
  delete(sagaName: string, sagaId: string): Promise<void>;
}
```

## Basic Usage

```typescript
import { PostgresSagaStore } from '@saga-bus/store-postgres';

const store = new PostgresSagaStore({
  connectionString: process.env.DATABASE_URL,
});

const bus = createBus({
  transport,
  store,
  sagas: [{ definition: orderSaga }],
});
```

## Schema Management

Most SQL stores provide schema helpers:

```typescript
import { createSchema, getSchemaSql } from '@saga-bus/store-postgres';

// Create tables programmatically
await createSchema(pool);

// Or get SQL for manual migration
const sql = getSchemaSql();
```

## Shared vs Per-Saga

```typescript
// Shared store (recommended)
const bus = createBus({
  store: sharedStore,
  sagas: [{ definition: saga1 }, { definition: saga2 }],
});

// Per-saga stores
const bus = createBus({
  sagas: [
    { definition: saga1, store: store1 },
    { definition: saga2, store: store2 },
  ],
});
```
