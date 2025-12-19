---
sidebar_position: 10
title: Prisma
---

# Prisma Store

Type-safe store using Prisma ORM with multi-database support.

## Installation

```bash npm2yarn
npm install @saga-bus/store-prisma @prisma/client
```

## Basic Usage

```typescript
import { PrismaSagaStore } from '@saga-bus/store-prisma';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const store = new PrismaSagaStore({ prisma });

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
| `prisma` | `PrismaClient` | Required | Prisma client instance |
| `modelName` | `string` | `'saga'` | Prisma model name |

## Prisma Schema

Add the saga model to your `schema.prisma`:

```prisma
// schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql" // or mysql, sqlite, sqlserver, mongodb
  url      = env("DATABASE_URL")
}

model Saga {
  sagaName      String
  sagaId        String
  correlationId String
  version       Int      @default(1)
  state         Json
  isCompleted   Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@id([sagaName, sagaId])
  @@index([sagaName, correlationId])
  @@index([sagaName, isCompleted])
  @@map("sagas")
}
```

## Full Configuration Example

```typescript
import { PrismaSagaStore } from '@saga-bus/store-prisma';
import { PrismaClient } from '@prisma/client';

// Basic usage
const prisma = new PrismaClient();
const store = new PrismaSagaStore({ prisma });

// With logging
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// With custom model name
const store = new PrismaSagaStore({
  prisma,
  modelName: 'sagaInstance',
});
```

## Multi-Database Support

Prisma supports multiple databases with the same code:

### PostgreSQL

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### MySQL

```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
```

### SQLite

```prisma
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}
```

### SQL Server

```prisma
datasource db {
  provider = "sqlserver"
  url      = env("DATABASE_URL")
}
```

### MongoDB

```prisma
datasource db {
  provider = "mongodb"
  url      = env("DATABASE_URL")
}

model Saga {
  id            String   @id @default(auto()) @map("_id") @db.ObjectId
  sagaName      String
  sagaId        String
  correlationId String
  version       Int      @default(1)
  state         Json
  isCompleted   Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([sagaName, sagaId])
  @@index([sagaName, correlationId])
  @@map("sagas")
}
```

## Migrations

### Generate Migration

```bash
npx prisma migrate dev --name add_sagas_table
```

### Apply Migration

```bash
npx prisma migrate deploy
```

### Generate Client

```bash
npx prisma generate
```

## Type Safety

Prisma provides full type safety:

```typescript
// Types are inferred from schema
const saga = await prisma.saga.findUnique({
  where: {
    sagaName_sagaId: {
      sagaName: 'OrderSaga',
      sagaId: '123',
    },
  },
});
// saga is fully typed
```

## Transactions

Prisma transactions for atomic operations:

```typescript
// Built-in transaction support
// Uses interactive transactions for optimistic concurrency
await prisma.$transaction(async (tx) => {
  const saga = await tx.saga.findUnique({ ... });
  if (saga.version !== expectedVersion) {
    throw new ConcurrencyError();
  }
  await tx.saga.update({ ... });
});
```

## Connection Pooling

Configure connection pool:

```typescript
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Or via connection string
// DATABASE_URL="postgresql://user:pass@localhost:5432/db?connection_limit=20&pool_timeout=30"
```

## Best Practices

### Single Client Instance

```typescript
// Create once, reuse everywhere
// lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

### Graceful Shutdown

```typescript
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
```

### Use Prisma Studio

```bash
# Visual database browser
npx prisma studio
```

## Testing

Use Prisma with test databases:

```typescript
// test/setup.ts
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

beforeAll(async () => {
  // Reset database
  execSync('npx prisma migrate reset --force --skip-seed');
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

## See Also

- [Stores Overview](/docs/stores/overview)
- [PostgreSQL Store](/docs/stores/postgres)
- [Testing](/docs/testing/overview)
