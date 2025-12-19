---
sidebar_position: 1
---

# Core Concepts Overview

Understanding the fundamentals of saga orchestration with Saga Bus.

## What is a Saga?

A **saga** is a long-running business process that spans multiple services or steps. Unlike a traditional database transaction, sagas handle distributed operations by:

1. Breaking complex workflows into discrete steps
2. Maintaining state across those steps
3. Handling failures with compensation (undo operations)
4. Reacting to events from multiple sources

## The Saga Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                        Order Saga                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  OrderSubmitted ──► CapturePayment ──► ReserveInventory    │
│        │                  │                   │             │
│        ▼                  ▼                   ▼             │
│    [pending]        [processing]        [confirmed]         │
│                           │                   │             │
│                     PaymentFailed        ShipOrder          │
│                           │                   │             │
│                           ▼                   ▼             │
│                      [cancelled]         [shipped]          │
│                                              │              │
│                                         [completed]         │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### Messages

Messages are the events and commands that drive sagas. Every message has a `type` property:

```typescript
interface OrderSubmitted {
  type: 'OrderSubmitted';
  orderId: string;
  customerId: string;
  total: number;
}
```

[Learn more about Messages →](/docs/core-concepts/messages)

### Saga State

Each saga instance maintains state that persists across message handling:

```typescript
interface OrderState extends SagaState {
  orderId: string;
  status: 'pending' | 'confirmed' | 'shipped';
  total: number;
}
```

[Learn more about Sagas →](/docs/core-concepts/sagas)

### Correlation

Correlation links messages to the correct saga instance. Typically by a business identifier:

```typescript
.correlate('OrderSubmitted', msg => msg.orderId, { canStart: true })
.correlate('PaymentCaptured', msg => msg.orderId)
```

[Learn more about Correlation →](/docs/core-concepts/correlation)

### Transport

The transport handles message delivery between services:

```typescript
const transport = new RabbitMqTransport({
  url: 'amqp://localhost',
});
```

### Store

The store persists saga state to a database:

```typescript
const store = new PostgresSagaStore({
  connectionString: process.env.DATABASE_URL,
});
```

### Bus

The bus wires everything together:

```typescript
const bus = createBus({
  transport,
  store,
  sagas: [{ definition: orderSaga }],
});
```

## Saga Lifecycle

```
1. Message Received
       │
       ▼
2. Find Saga Instance (by correlation)
       │
       ├── Not Found + canStart = true ──► Create New Instance
       │
       └── Found ──► Load State
              │
              ▼
3. Execute Handler
       │
       ▼
4. Update State (with optimistic concurrency)
       │
       ▼
5. Publish Outgoing Messages
       │
       ▼
6. Acknowledge Original Message
```

## Optimistic Concurrency

Saga Bus uses version-based optimistic concurrency to prevent lost updates:

```typescript
// State includes metadata
interface SagaState {
  metadata: {
    sagaId: string;
    version: number;  // Incremented on each update
    createdAt: Date;
    updatedAt: Date;
    isCompleted: boolean;
  };
}
```

If two handlers try to update the same saga simultaneously, one will fail with a `ConcurrencyError` and retry.

[Learn more about State Management →](/docs/core-concepts/state-management)

## Error Handling

Saga Bus distinguishes between:

- **Transient errors** - Temporary failures (network, timeout) that should retry
- **Permanent errors** - Business logic failures that need compensation
- **Validation errors** - Invalid messages that should be rejected

[Learn more about Error Handling →](/docs/core-concepts/error-handling)

## Timeouts

Set timeouts to handle cases where expected events never arrive:

```typescript
.on('OrderSubmitted')
  .handle(async (msg, state, ctx) => {
    ctx.setTimeout(30 * 60 * 1000); // 30 minutes
    // ...
  })

.on('SagaTimeoutExpired')
  .handle(async (msg, state, ctx) => {
    // Handle timeout - maybe cancel the order
  })
```

[Learn more about Timeouts →](/docs/core-concepts/timeouts)

## Distributed Tracing

Saga Bus propagates W3C trace context automatically:

```typescript
// Trace context flows through
ctx.publish({ type: 'NextStep', ... });
// ↑ Automatically includes traceparent header
```

[Learn more about Distributed Tracing →](/docs/core-concepts/distributed-tracing)

## Next Steps

- [Messages](/docs/core-concepts/messages) - Deep dive into message design
- [Sagas](/docs/core-concepts/sagas) - Understanding saga state
- [Correlation](/docs/core-concepts/correlation) - Linking messages to sagas
- [DSL Reference](/docs/dsl-reference/overview) - Complete API reference
