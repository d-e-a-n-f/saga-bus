---
sidebar_position: 6
title: Idempotency
---

# Idempotency Middleware

Deduplication to ensure exactly-once message processing.

## Installation

```bash npm2yarn
npm install @saga-bus/middleware-idempotency
```

## Basic Usage

```typescript
import { createIdempotencyMiddleware, InMemoryIdempotencyStore } from '@saga-bus/middleware-idempotency';

const bus = createBus({
  transport,
  store,
  sagas: [{ definition: orderSaga }],
  middleware: [
    createIdempotencyMiddleware({
      store: new InMemoryIdempotencyStore(),
    }),
  ],
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `store` | `IdempotencyStore` | Required | Storage for processed IDs |
| `keyExtractor` | `function` | messageId | Extract idempotency key |
| `ttl` | `number` | `86400` | Key TTL in seconds (24h) |
| `onDuplicate` | `function` | skip | Handle duplicates |

## Full Configuration Example

```typescript
import { createIdempotencyMiddleware, RedisIdempotencyStore } from '@saga-bus/middleware-idempotency';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

const idempotencyMiddleware = createIdempotencyMiddleware({
  store: new RedisIdempotencyStore({ client: redis }),

  // Custom key extraction
  keyExtractor: (context) => {
    // Use correlation ID + message type for deduplication
    return `${context.correlationId}:${context.messageType}`;
  },

  // TTL for idempotency keys
  ttl: 86400 * 7, // 7 days

  // Handle duplicates
  onDuplicate: (context) => {
    console.log('Duplicate message detected:', context.messageId);
    return 'skip'; // or 'process' to allow
  },
});
```

## Idempotency Stores

### In-Memory (Testing Only)

```typescript
import { InMemoryIdempotencyStore } from '@saga-bus/middleware-idempotency';

const store = new InMemoryIdempotencyStore();
```

### Redis (Recommended)

```typescript
import { RedisIdempotencyStore } from '@saga-bus/middleware-idempotency';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);
const store = new RedisIdempotencyStore({
  client: redis,
  keyPrefix: 'idempotency:',
  ttl: 86400, // 24 hours
});
```

### PostgreSQL

```typescript
import { PostgresIdempotencyStore } from '@saga-bus/middleware-idempotency';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const store = new PostgresIdempotencyStore({
  pool,
  tableName: 'idempotency_keys',
});
```

### DynamoDB

```typescript
import { DynamoDBIdempotencyStore } from '@saga-bus/middleware-idempotency';

const store = new DynamoDBIdempotencyStore({
  tableName: 'idempotency-keys',
  region: 'us-east-1',
  ttl: 86400,
});
```

## Key Extraction Strategies

### Message ID (Default)

```typescript
keyExtractor: (context) => context.messageId
```

### Correlation ID + Message Type

```typescript
// Dedupe same event type per saga instance
keyExtractor: (context) => `${context.correlationId}:${context.messageType}`
```

### Content-Based

```typescript
import crypto from 'crypto';

keyExtractor: (context) => {
  // Hash message content
  const content = JSON.stringify(context.message);
  return crypto.createHash('sha256').update(content).digest('hex');
}
```

### Custom Business Key

```typescript
keyExtractor: (context) => {
  // Use business-specific identifier
  if (context.messageType === 'PaymentCaptured') {
    return `payment:${context.message.paymentId}`;
  }
  return context.messageId;
}
```

## Duplicate Handling

### Skip (Default)

```typescript
onDuplicate: (context) => 'skip'
// Message is acknowledged but not processed
```

### Process Anyway

```typescript
onDuplicate: (context) => 'process'
// Allow reprocessing (useful for retries)
```

### Log and Skip

```typescript
onDuplicate: (context) => {
  logger.warn('Duplicate detected', {
    messageId: context.messageId,
    messageType: context.messageType,
  });
  return 'skip';
}
```

### Custom Response

```typescript
onDuplicate: async (context) => {
  // Return cached result
  const cached = await cache.get(context.messageId);
  if (cached) {
    return { action: 'respond', data: cached };
  }
  return 'skip';
}
```

## Redis Schema

```
Key: idempotency:{messageId}
Value: {
  "processedAt": "2024-01-15T10:30:00Z",
  "messageType": "OrderSubmitted",
  "correlationId": "order-123"
}
TTL: 86400 (24 hours)
```

## PostgreSQL Schema

```sql
CREATE TABLE idempotency_keys (
  key VARCHAR(255) PRIMARY KEY,
  message_type VARCHAR(255) NOT NULL,
  correlation_id VARCHAR(255),
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_idempotency_expires ON idempotency_keys (expires_at);
```

## Best Practices

### Use Appropriate TTL

```typescript
// Balance between safety and storage
createIdempotencyMiddleware({
  store,
  ttl: 86400 * 7, // 7 days - safe for most use cases
});
```

### Choose the Right Key

```typescript
// For event sourcing - use message ID
keyExtractor: (ctx) => ctx.messageId

// For command deduplication - use business key
keyExtractor: (ctx) => `${ctx.message.orderId}:${ctx.messageType}`
```

### Clean Up Expired Keys

```typescript
// Redis handles this automatically via TTL
// For PostgreSQL, schedule cleanup:
DELETE FROM idempotency_keys WHERE expires_at < NOW();
```

### Consider Idempotency Window

```typescript
// Short window for real-time systems
ttl: 3600 // 1 hour

// Long window for batch processing
ttl: 86400 * 30 // 30 days
```

## Testing

```typescript
import { InMemoryIdempotencyStore } from '@saga-bus/middleware-idempotency';

describe('Idempotency', () => {
  it('skips duplicate messages', async () => {
    const store = new InMemoryIdempotencyStore();
    const handler = vi.fn();

    const bus = createBus({
      middleware: [createIdempotencyMiddleware({ store })],
      // ...
    });

    // Process first time
    await bus.publish({ type: 'OrderSubmitted', id: '123' });
    expect(handler).toHaveBeenCalledTimes(1);

    // Same message ID - should be skipped
    await bus.publish({ type: 'OrderSubmitted', id: '123' });
    expect(handler).toHaveBeenCalledTimes(1); // Still 1
  });
});
```

## See Also

- [Middleware Overview](/docs/middleware/overview)
- [Error Handling](/docs/core-concepts/error-handling)
- [Exactly-Once Delivery](/docs/production/exactly-once)
