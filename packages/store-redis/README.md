# @saga-bus/store-redis

Redis-backed saga store for saga-bus with optimistic concurrency.

## Installation

```bash
npm install @saga-bus/store-redis ioredis
# or
pnpm add @saga-bus/store-redis ioredis
```

## Features

- **Fast**: Sub-millisecond read/write operations
- **Optimistic Concurrency**: WATCH/MULTI for conflict detection
- **TTL Support**: Automatic cleanup of completed sagas
- **Index Lookup**: Find sagas by ID or correlation ID
- **Clustering**: Works with Redis Cluster

## Quick Start

```typescript
import { createBus } from "@saga-bus/core";
import { RedisSagaStore } from "@saga-bus/store-redis";

const store = new RedisSagaStore({
  connection: { host: "localhost", port: 6379 },
  completedTtlSeconds: 86400, // Auto-cleanup after 1 day
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
interface RedisSagaStoreOptions {
  /** Existing Redis client */
  redis?: Redis;

  /** Connection options for creating new client */
  connection?: RedisOptions;

  /** Key prefix for all saga keys (default: "saga-bus:") */
  keyPrefix?: string;

  /** TTL in seconds for completed sagas (0 = no expiry) */
  completedTtlSeconds?: number;

  /** TTL in seconds for all sagas (0 = no expiry) */
  defaultTtlSeconds?: number;

  /** Maximum retries for optimistic locking conflicts (default: 3) */
  maxRetries?: number;

  /** Delay between retries in milliseconds (default: 100) */
  retryDelayMs?: number;
}
```

## Examples

### Basic Usage

```typescript
import { RedisSagaStore } from "@saga-bus/store-redis";

const store = new RedisSagaStore({
  connection: { host: "localhost", port: 6379 },
});

await store.initialize();

// Find by correlation ID
const state = await store.findByCorrelationId("OrderSaga", "order-123");

// Find by saga ID
const stateById = await store.findById("OrderSaga", "saga-456");

// Save state
await store.save("OrderSaga", {
  id: "saga-456",
  correlationId: "order-123",
  status: "running",
  data: { orderId: "order-123" },
  metadata: { /* ... */ },
});

// Delete
await store.delete("OrderSaga", "order-123");
```

### With Existing Redis Client

```typescript
import { Redis } from "ioredis";

const redis = new Redis({
  host: "localhost",
  port: 6379,
  password: "secret",
  db: 1,
});

const store = new RedisSagaStore({
  redis,
  keyPrefix: "myapp:",
});
```

### With TTL for Auto-Cleanup

```typescript
const store = new RedisSagaStore({
  connection: { host: "localhost", port: 6379 },
  completedTtlSeconds: 86400,  // Delete completed sagas after 24 hours
  defaultTtlSeconds: 604800,   // Delete all sagas after 7 days
});
```

### Redis Cluster

```typescript
import { Cluster } from "ioredis";

const cluster = new Cluster([
  { host: "redis-1", port: 6379 },
  { host: "redis-2", port: 6379 },
  { host: "redis-3", port: 6379 },
]);

const store = new RedisSagaStore({
  redis: cluster as any,
});
```

## Key Structure

The store uses the following key structure:

```
{prefix}saga:{sagaName}:{correlationId}     -> JSON serialized state
{prefix}saga:{sagaName}:idx:id:{sagaId}     -> correlation ID (index)
```

Example:
```
saga-bus:saga:OrderSaga:order-123           -> {"id":"saga-456",...}
saga-bus:saga:OrderSaga:idx:id:saga-456     -> "order-123"
```

## Optimistic Concurrency

The store uses Redis WATCH/MULTI for optimistic locking:

1. `WATCH` the key before reading
2. Read current state and check version
3. `MULTI` to start transaction
4. `SET` new state
5. `EXEC` - fails if key was modified

If a conflict is detected, the operation is retried up to `maxRetries` times.

```typescript
const store = new RedisSagaStore({
  connection: { host: "localhost", port: 6379 },
  maxRetries: 5,      // More retries for high-contention scenarios
  retryDelayMs: 50,   // Shorter delay between retries
});
```

## Performance Considerations

1. **Use Key Prefixes**: Helps with Redis SCAN operations and debugging
2. **Set TTLs**: Prevents unbounded growth of saga data
3. **Connection Pooling**: Reuse Redis connections across stores
4. **Clustering**: Use Redis Cluster for horizontal scaling

## Error Handling

```typescript
try {
  await store.save("OrderSaga", state);
} catch (error) {
  if (error.message.includes("Optimistic concurrency conflict")) {
    // State was modified by another process
    // Reload and retry
  }
}
```

## Testing

For testing, you can run Redis locally:

```bash
docker run -p 6379:6379 redis:latest
```

Or use an in-memory store for unit tests:

```typescript
import { InMemorySagaStore } from "@saga-bus/core";

const testStore = new InMemorySagaStore();
```

## License

MIT
