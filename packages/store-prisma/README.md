# @saga-bus/store-prisma

Prisma ORM adapter for saga-bus state storage.

## Installation

```bash
pnpm add @saga-bus/store-prisma @prisma/client
```

## Prisma Schema

Add to your `schema.prisma`:

```prisma
model SagaInstance {
  id            String   @db.VarChar(128)
  sagaName      String   @map("saga_name") @db.VarChar(128)
  correlationId String   @map("correlation_id") @db.VarChar(256)
  version       Int
  isCompleted   Boolean  @default(false) @map("is_completed")
  state         Json

  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  @@id([sagaName, id])
  @@unique([sagaName, correlationId])
  @@index([sagaName, isCompleted])
  @@map("saga_instances")
}
```

## Usage

```typescript
import { PrismaClient } from "@prisma/client";
import { PrismaSagaStore } from "@saga-bus/store-prisma";
import { createBus } from "@saga-bus/core";

const prisma = new PrismaClient();
const store = new PrismaSagaStore({ prisma });

const bus = createBus({
  sagas: [{ definition: mySaga, store }],
  transport,
});
```

## Features

- Uses your existing PrismaClient
- Optimistic concurrency control
- Type-safe state serialization
- Works with any Prisma-supported database

## License

MIT
