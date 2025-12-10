# @saga-bus/middleware-idempotency

Idempotency middleware for saga-bus that prevents duplicate message processing.

## Installation

```bash
npm install @saga-bus/middleware-idempotency
# or
pnpm add @saga-bus/middleware-idempotency
```

For Redis support:

```bash
npm install ioredis
```

## Features

- **Message Deduplication**: Prevent duplicate message processing within a configurable time window
- **Multiple Storage Backends**: In-memory (development) and Redis (production)
- **Flexible ID Extraction**: Custom message ID extraction strategies
- **Configurable Behavior**: Skip, log, or throw on duplicates
- **Delivery Guarantees**: Choose between at-most-once or at-least-once semantics

## Quick Start

```typescript
import { createBus } from "@saga-bus/core";
import {
  createIdempotencyMiddleware,
  InMemoryIdempotencyStore,
} from "@saga-bus/middleware-idempotency";

const idempotencyMiddleware = createIdempotencyMiddleware({
  store: new InMemoryIdempotencyStore(),
  windowMs: 60000, // 1 minute deduplication window
});

const bus = createBus({
  transport,
  store,
  sagas: [OrderSaga],
  middleware: [idempotencyMiddleware],
});
```

## API Reference

### createIdempotencyMiddleware(options)

Creates middleware that prevents duplicate message processing.

```typescript
interface IdempotencyMiddlewareOptions {
  /** Store for tracking processed message IDs */
  store: IdempotencyStore;

  /** Time window for deduplication in milliseconds (default: 60000) */
  windowMs?: number;

  /** Function to extract message ID from envelope (default: envelope.id) */
  getMessageId?: (envelope: MessageEnvelope) => string;

  /** Action on duplicate: "skip" | "log" | "throw" (default: "skip") */
  onDuplicate?: "skip" | "log" | "throw";

  /** Logger for duplicate detection messages */
  logger?: { warn(message: string, meta?: Record<string, unknown>): void };

  /** Message types to exclude from idempotency checks */
  excludeTypes?: string[];

  /** When to mark message as processed: "before" | "after" (default: "after") */
  markTiming?: "before" | "after";
}
```

### InMemoryIdempotencyStore

In-memory store for development and testing. Not suitable for distributed systems.

```typescript
import { InMemoryIdempotencyStore } from "@saga-bus/middleware-idempotency";

const store = new InMemoryIdempotencyStore();

// Optional: specify cleanup interval (default: 60000ms)
const store = new InMemoryIdempotencyStore(30000);

// Stop cleanup interval when done
store.stop();
```

### RedisIdempotencyStore

Redis-backed store for production distributed systems.

```typescript
import Redis from "ioredis";
import { RedisIdempotencyStore } from "@saga-bus/middleware-idempotency";

const redis = new Redis();

const store = new RedisIdempotencyStore({
  redis,
  keyPrefix: "idempotency:", // default
});
```

### DuplicateMessageError

Error thrown when `onDuplicate: "throw"` and a duplicate is detected.

```typescript
import { DuplicateMessageError } from "@saga-bus/middleware-idempotency";

try {
  await bus.publish(message);
} catch (error) {
  if (error instanceof DuplicateMessageError) {
    console.log(`Duplicate: ${error.messageId} (${error.messageType})`);
  }
}
```

## Examples

### Basic Usage

```typescript
import {
  createIdempotencyMiddleware,
  InMemoryIdempotencyStore,
} from "@saga-bus/middleware-idempotency";

const middleware = createIdempotencyMiddleware({
  store: new InMemoryIdempotencyStore(),
  windowMs: 300000, // 5 minutes
});
```

### With Redis (Production)

```typescript
import Redis from "ioredis";
import {
  createIdempotencyMiddleware,
  RedisIdempotencyStore,
} from "@saga-bus/middleware-idempotency";

const redis = new Redis(process.env.REDIS_URL);

const middleware = createIdempotencyMiddleware({
  store: new RedisIdempotencyStore({ redis }),
  windowMs: 300000,
});
```

### Custom Message ID Extraction

```typescript
// Use a combination of type and correlation ID for deduplication
const middleware = createIdempotencyMiddleware({
  store,
  getMessageId: (envelope) =>
    `${envelope.type}:${envelope.headers["x-correlation-id"]}`,
});
```

### Logging Duplicates

```typescript
import { logger } from "./logger";

const middleware = createIdempotencyMiddleware({
  store,
  onDuplicate: "log",
  logger: {
    warn: (message, meta) => logger.warn(message, meta),
  },
});
```

### Throwing on Duplicates

```typescript
import { createIdempotencyMiddleware, DuplicateMessageError } from "@saga-bus/middleware-idempotency";

const middleware = createIdempotencyMiddleware({
  store,
  onDuplicate: "throw",
});

// In your error handler
app.onError((error, c) => {
  if (error instanceof DuplicateMessageError) {
    return c.json({ error: "Duplicate request" }, 409);
  }
  throw error;
});
```

### Excluding Message Types

```typescript
// Don't deduplicate heartbeat or ping messages
const middleware = createIdempotencyMiddleware({
  store,
  excludeTypes: ["Heartbeat", "Ping", "HealthCheck"],
});
```

### At-Most-Once vs At-Least-Once

```typescript
// At-most-once: Mark before processing
// If processing fails, message won't be retried
const atMostOnce = createIdempotencyMiddleware({
  store,
  markTiming: "before",
});

// At-least-once: Mark after processing (default)
// If processing fails, message can be retried
const atLeastOnce = createIdempotencyMiddleware({
  store,
  markTiming: "after",
});
```

## Custom Store Implementation

Implement the `IdempotencyStore` interface for custom storage:

```typescript
import type { IdempotencyStore } from "@saga-bus/middleware-idempotency";

class MyCustomStore implements IdempotencyStore {
  async has(messageId: string): Promise<boolean> {
    // Check if messageId exists
  }

  async set(messageId: string, ttlMs?: number): Promise<void> {
    // Store messageId with optional TTL
  }

  async delete(messageId: string): Promise<void> {
    // Remove messageId
  }

  async clear(): Promise<void> {
    // Clear all entries
  }
}
```

## How It Works

1. When a message arrives, the middleware extracts its ID
2. It checks if the ID exists in the store
3. If found (duplicate):
   - `skip`: Silently skip processing
   - `log`: Log warning and skip
   - `throw`: Throw `DuplicateMessageError`
4. If not found (new message):
   - With `markTiming: "before"`: Mark as processed, then run handler
   - With `markTiming: "after"`: Run handler, then mark as processed
5. The ID expires after `windowMs` milliseconds

## Best Practices

1. **Use Redis in production** for distributed systems with multiple instances
2. **Set appropriate window sizes** based on your retry policies
3. **Use `markTiming: "after"`** (default) for at-least-once delivery with retries
4. **Use `markTiming: "before"`** for at-most-once delivery when idempotency is critical
5. **Exclude naturally idempotent messages** like heartbeats and health checks

## License

MIT
