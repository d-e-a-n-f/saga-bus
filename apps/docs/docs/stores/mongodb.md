---
sidebar_position: 6
title: MongoDB
---

# MongoDB Store

Document-oriented store using MongoDB with flexible schema support.

## Installation

```bash npm2yarn
npm install @saga-bus/store-mongodb mongodb
```

## Basic Usage

```typescript
import { MongoSagaStore } from '@saga-bus/store-mongodb';

const store = new MongoSagaStore({
  connectionString: 'mongodb://localhost:27017',
  database: 'sagas',
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
| `connectionString` | `string` | Required | MongoDB connection string |
| `database` | `string` | Required | Database name |
| `collection` | `string` | `'sagas'` | Collection name |
| `client` | `MongoClient` | - | Existing MongoClient |

## Full Configuration Example

```typescript
import { MongoSagaStore, createIndexes } from '@saga-bus/store-mongodb';
import { MongoClient } from 'mongodb';

// Option 1: Connection string
const store = new MongoSagaStore({
  connectionString: process.env.MONGODB_URL,
  database: 'myapp',
  collection: 'saga_instances',
});

// Option 2: Existing client
const client = new MongoClient(process.env.MONGODB_URL, {
  maxPoolSize: 50,
  minPoolSize: 10,
  retryWrites: true,
  w: 'majority',
});

await client.connect();

const store = new MongoSagaStore({
  client,
  database: 'myapp',
  collection: 'saga_instances',
});

// Create indexes
await createIndexes(client.db('myapp').collection('saga_instances'));
```

## Index Setup

### Automatic

```typescript
import { createIndexes } from '@saga-bus/store-mongodb';

await createIndexes(store.collection);
```

### Manual

```javascript
// Create indexes via mongosh
db.sagas.createIndex(
  { sagaName: 1, sagaId: 1 },
  { unique: true }
);

db.sagas.createIndex(
  { sagaName: 1, correlationId: 1 }
);

db.sagas.createIndex(
  { sagaName: 1, isCompleted: 1 }
);

db.sagas.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 2592000 } // 30 days TTL
);
```

## Document Schema

```typescript
interface SagaDocument {
  _id: ObjectId;
  sagaName: string;
  sagaId: string;
  correlationId: string;
  version: number;
  state: Record<string, unknown>;
  isCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

## MongoDB Atlas

For MongoDB Atlas:

```typescript
const store = new MongoSagaStore({
  connectionString: 'mongodb+srv://user:password@cluster.mongodb.net/?retryWrites=true&w=majority',
  database: 'sagas',
});
```

## Replica Set

For replica sets:

```typescript
const store = new MongoSagaStore({
  connectionString: 'mongodb://mongo1:27017,mongo2:27017,mongo3:27017/sagas?replicaSet=rs0',
  database: 'sagas',
});
```

## Docker Setup

```yaml
# docker-compose.yml
services:
  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_DATABASE: sagas
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
```

### Replica Set for Development

```yaml
services:
  mongo1:
    image: mongo:7
    command: mongod --replSet rs0 --bind_ip_all
    ports:
      - "27017:27017"

  mongo-init:
    image: mongo:7
    depends_on:
      - mongo1
    command: >
      mongosh --host mongo1:27017 --eval "rs.initiate({_id: 'rs0', members: [{_id: 0, host: 'mongo1:27017'}]})"
```

## Optimistic Concurrency

Version-based updates with findOneAndUpdate:

```typescript
// Atomic update with version check
const result = await collection.findOneAndUpdate(
  {
    sagaName: 'OrderSaga',
    sagaId: '123',
    version: expectedVersion,
  },
  {
    $set: { state, updatedAt: new Date() },
    $inc: { version: 1 },
  }
);

if (!result.value) {
  throw new ConcurrencyError();
}
```

## TTL for Completed Sagas

Automatically remove completed sagas:

```typescript
// Create TTL index on completed sagas
db.sagas.createIndex(
  { completedAt: 1 },
  { expireAfterSeconds: 2592000, partialFilterExpression: { isCompleted: true } }
);
```

## Best Practices

### Use Write Concern

```typescript
const client = new MongoClient(url, {
  w: 'majority',
  journal: true,
});
```

### Configure Read Preference

```typescript
const client = new MongoClient(url, {
  readPreference: 'primaryPreferred',
});
```

### Enable Compression

```typescript
const client = new MongoClient(url, {
  compressors: ['zstd', 'snappy'],
});
```

## See Also

- [Stores Overview](/docs/stores/overview)
- [Error Handling](/docs/core-concepts/error-handling)
- [Scaling](/docs/production/scaling)
