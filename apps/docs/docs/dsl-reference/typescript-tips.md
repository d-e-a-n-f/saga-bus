---
sidebar_position: 5
---

# TypeScript Tips

Get the most out of TypeScript with Saga Bus.

## Type Inference

The DSL automatically infers message types:

```typescript
const saga = createSagaMachine<OrderState, OrderMessages>()
  .on('PaymentCaptured')
    .handle(async (msg, state, ctx) => {
      // TypeScript knows:
      // - msg is PaymentCaptured
      // - msg.transactionId exists
      // - state is OrderState
      console.log(msg.transactionId);  // ✅ No error
      return state;
    })
```

## Message Union Types

Define a union of all messages:

```typescript
type OrderMessages =
  | OrderSubmitted
  | PaymentCaptured
  | PaymentFailed
  | OrderShipped;

// The DSL will type-check handler message types
```

## State Interface

Extend `SagaState` for your state:

```typescript
import type { SagaState } from '@saga-bus/core';

interface OrderState extends SagaState {
  orderId: string;
  status: OrderStatus;
  // ... your fields
}
```

## Generic Handlers

For reusable handler logic:

```typescript
function createAuditHandler<TState extends SagaState>() {
  return async (msg: unknown, state: TState, ctx: SagaContext) => {
    ctx.setMetadata('lastProcessed', new Date().toISOString());
    return state;
  };
}
```

## Discriminated Unions

Use discriminated unions for type narrowing:

```typescript
type OrderStatus =
  | { status: 'pending' }
  | { status: 'paid'; transactionId: string }
  | { status: 'shipped'; trackingNumber: string };

// TypeScript narrows based on status
if (state.status === 'paid') {
  console.log(state.transactionId);  // ✅ Available
}
```

## Strict Null Checks

Saga Bus works best with strict mode:

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true
  }
}
```
