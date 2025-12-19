---
sidebar_position: 3
---

# Sagas

A saga is a stateful workflow that coordinates multiple steps across services.

## Saga State

Every saga state must extend `SagaState`:

```typescript
import type { SagaState } from '@saga-bus/core';

interface OrderSagaState extends SagaState {
  // Your custom fields
  orderId: string;
  customerId: string;
  status: 'pending' | 'confirmed' | 'shipped';
  total: number;
}
```

## State Metadata

The `SagaState` interface includes metadata managed by Saga Bus:

```typescript
interface SagaStateMetadata {
  readonly sagaId: string;       // Unique saga instance ID
  readonly version: number;      // For optimistic concurrency
  readonly createdAt: Date;      // When saga was created
  readonly updatedAt: Date;      // Last update time
  readonly isCompleted: boolean; // Terminal state flag
  readonly traceParent?: string; // W3C trace context
  readonly traceState?: string;
  readonly timeoutMs?: number;
  readonly timeoutExpiresAt?: Date;
}
```

## Saga Definition

Use the fluent DSL to define sagas:

```typescript
import { createSagaMachine } from '@saga-bus/core';

const orderSaga = createSagaMachine<OrderSagaState, OrderMessages>()
  .name('OrderSaga')                    // Required: unique name
  .correlate('OrderSubmitted', ...)     // Required: at least one canStart
  .initial<OrderSubmitted>(...)         // Required: initial state factory
  .on('PaymentCaptured').handle(...)    // Message handlers
  .build();                             // Build the definition
```

## Saga Lifecycle

### Creation

A new saga instance is created when:
1. A message arrives with `canStart: true` correlation
2. No existing saga matches the correlation ID

### Updates

On each message:
1. State is loaded from the store
2. Handler executes and returns new state
3. State is saved with incremented version

### Completion

Call `ctx.complete()` to mark a saga as finished:

```typescript
.on('OrderCompleted')
  .handle(async (msg, state, ctx) => {
    ctx.complete();  // Marks isCompleted = true
    return { ...state, status: 'completed' };
  })
```

Completed sagas won't process new messages.

## Registering Sagas

Register sagas with the bus:

```typescript
const bus = createBus({
  transport,
  store,
  sagas: [
    { definition: orderSaga },
    { definition: paymentSaga },
    {
      definition: shippingSaga,
      store: customStore,  // Optional: per-saga store
    },
  ],
});
```
