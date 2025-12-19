---
sidebar_position: 7
title: Exactly-Once Processing
---

# Exactly-Once Processing

Strategies for achieving exactly-once message processing.

## The Challenge

In distributed systems, messages can be delivered:
- **At-most-once** - Messages may be lost
- **At-least-once** - Messages may be duplicated
- **Exactly-once** - Each message processed exactly once

Saga Bus provides tools for exactly-once semantics.

## Idempotency Middleware

The idempotency middleware deduplicates messages:

```typescript
import { createIdempotencyMiddleware } from '@saga-bus/middleware-idempotency';

const bus = createBus({
  transport,
  store,
  sagas,
  middleware: [
    createIdempotencyMiddleware({
      store: idempotencyStore,
      keyExtractor: (msg) => msg.messageId,
      ttl: 24 * 60 * 60 * 1000, // 24 hours
    }),
  ],
});
```

## Message ID Strategy

Always include a unique message ID:

```typescript
await bus.publish({
  type: 'OrderSubmitted',
  messageId: crypto.randomUUID(), // Unique per message
  orderId: '123',
});
```

## Transactional Outbox

For guaranteed delivery without duplicates:

```typescript
// Within a database transaction:
await db.transaction(async (tx) => {
  // 1. Update business state
  await tx.update('orders', { status: 'confirmed' });

  // 2. Write to outbox table
  await tx.insert('outbox', {
    id: uuid(),
    type: 'OrderConfirmed',
    payload: { orderId },
  });
});

// Separate process polls outbox and publishes
```

## Optimistic Concurrency

Saga Bus uses version-based concurrency:

```typescript
// Each saga state has a version
interface SagaState {
  metadata: {
    version: number; // Incremented on each update
  };
}

// Concurrent updates fail with ConcurrencyError
// and are automatically retried
```

## Best Practices

1. **Always use message IDs** - Generate UUID for each message
2. **Keep idempotency window** - Store processed IDs for 24+ hours
3. **Design handlers idempotently** - Same input should produce same result
4. **Use transactional outbox** - For critical state changes

## See Also

- [Idempotency Middleware](/docs/middleware/idempotency)
- [Error Recovery](/docs/production/error-recovery)
- [State Management](/docs/core-concepts/state-management)
