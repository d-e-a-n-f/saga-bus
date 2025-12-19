---
sidebar_position: 5
---

# State Management

How Saga Bus manages saga state with optimistic concurrency.

## Optimistic Concurrency

Saga Bus uses version-based optimistic concurrency to prevent lost updates:

```typescript
// Each state update increments the version
// Version 1 → Handler executes → Version 2

// If two handlers try to update simultaneously:
// Handler A: Load version 1 → Update → Save as version 2 ✅
// Handler B: Load version 1 → Update → Save as version 2 ❌ ConcurrencyError
```

## ConcurrencyError

When a concurrent update is detected:

```typescript
import { ConcurrencyError } from '@saga-bus/core';

// The store throws ConcurrencyError when versions don't match
try {
  await store.update(sagaName, state, expectedVersion);
} catch (error) {
  if (error instanceof ConcurrencyError) {
    // Retry the operation
  }
}
```

Saga Bus automatically retries on `ConcurrencyError`.

## State Updates

Handlers must return the new state:

```typescript
.on('PaymentCaptured')
  .handle(async (msg, state, ctx) => {
    // ✅ Return new state object
    return {
      ...state,
      status: 'payment_captured',
      transactionId: msg.transactionId,
    };
  })
```

### Immutable Updates

Always create new state objects:

```typescript
// ✅ Good - immutable update
return { ...state, status: 'updated' };

// ❌ Bad - mutating state
state.status = 'updated';
return state;
```

## Store Interface

All stores implement the `SagaStore` interface:

```typescript
interface SagaStore<TState extends SagaState> {
  getById(sagaName: string, sagaId: string): Promise<TState | null>;
  getByCorrelationId(sagaName: string, correlationId: string): Promise<TState | null>;
  insert(sagaName: string, correlationId: string, state: TState): Promise<void>;
  update(sagaName: string, state: TState, expectedVersion: number): Promise<void>;
  delete(sagaName: string, sagaId: string): Promise<void>;
}
```

## Shared vs Per-Saga Stores

### Shared Store (Recommended)

```typescript
const store = new PostgresSagaStore({ connectionString });

const bus = createBus({
  store,  // All sagas use this store
  sagas: [
    { definition: orderSaga },
    { definition: paymentSaga },
  ],
});
```

### Per-Saga Stores

```typescript
const bus = createBus({
  sagas: [
    {
      definition: orderSaga,
      store: new PostgresSagaStore({ connectionString: ORDER_DB }),
    },
    {
      definition: paymentSaga,
      store: new PostgresSagaStore({ connectionString: PAYMENT_DB }),
    },
  ],
});
```
