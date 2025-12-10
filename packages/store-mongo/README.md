# @saga-bus/store-mongo

MongoDB saga store for saga-bus.

## Installation

```bash
pnpm add @saga-bus/store-mongo mongodb
```

## Usage

```typescript
import { MongoClient } from "mongodb";
import { MongoSagaStore } from "@saga-bus/store-mongo";
import { createBus } from "@saga-bus/core";

const client = new MongoClient("mongodb://localhost:27017");
await client.connect();

const store = new MongoSagaStore({
  db: client.db("myapp"),
  collectionName: "saga_instances",
});

const bus = createBus({
  sagas: [{ definition: mySaga, store }],
  transport,
});
```

## Document Schema

Documents are stored with this structure:

```typescript
{
  _id: "OrderSaga:saga-123",      // Composite key
  sagaName: "OrderSaga",
  sagaId: "saga-123",
  correlationId: "order-456",
  version: 1,
  isCompleted: false,
  state: { /* saga state */ },
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

## Indexes

The store automatically creates indexes on:

- `_id` (primary key)
- `sagaName + correlationId` (for correlation lookups)
- `isCompleted + updatedAt` (for cleanup queries)

## Features

- Optimistic concurrency via version field
- Atomic updates with `findOneAndUpdate`
- Efficient correlation ID lookups
- TTL-based cleanup support

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `db` | `Db` | required | MongoDB database instance |
| `collectionName` | `string` | `"saga_instances"` | Collection name |

## Cleanup

Query completed sagas for cleanup:

```typescript
const completedSagas = await db
  .collection("saga_instances")
  .find({
    isCompleted: true,
    updatedAt: { $lt: thirtyDaysAgo },
  })
  .toArray();
```

## License

MIT
