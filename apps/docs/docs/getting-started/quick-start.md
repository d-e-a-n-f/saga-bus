---
sidebar_position: 2
---

# Quick Start

Get a working saga up and running in under 5 minutes.

## 1. Install Dependencies

```bash npm2yarn
npm install @saga-bus/core @saga-bus/transport-inmemory @saga-bus/store-inmemory
```

## 2. Define Your Messages

Messages are the events that drive your saga. Each message needs a `type` property:

```typescript
// messages.ts
export interface OrderSubmitted {
  type: 'OrderSubmitted';
  orderId: string;
  customerId: string;
  items: Array<{ productId: string; quantity: number }>;
  total: number;
}

export interface PaymentCaptured {
  type: 'PaymentCaptured';
  orderId: string;
  transactionId: string;
}

export interface PaymentFailed {
  type: 'PaymentFailed';
  orderId: string;
  reason: string;
}

export interface OrderCompleted {
  type: 'OrderCompleted';
  orderId: string;
}

export interface OrderCancelled {
  type: 'OrderCancelled';
  orderId: string;
  reason: string;
}

// Union type of all messages
export type OrderMessages =
  | OrderSubmitted
  | PaymentCaptured
  | PaymentFailed
  | OrderCompleted
  | OrderCancelled;
```

## 3. Define Your Saga State

The saga state tracks the current status of your workflow:

```typescript
// state.ts
import type { SagaState } from '@saga-bus/core';

export interface OrderState extends SagaState {
  orderId: string;
  customerId: string;
  status: 'pending' | 'payment_captured' | 'completed' | 'cancelled';
  total: number;
  transactionId?: string;
  cancelReason?: string;
}
```

## 4. Create Your Saga

Use the fluent DSL to define your saga's behavior:

```typescript
// order-saga.ts
import { createSagaMachine } from '@saga-bus/core';
import type { OrderState } from './state';
import type { OrderMessages, OrderSubmitted } from './messages';

export const orderSaga = createSagaMachine<OrderState, OrderMessages>()
  .name('OrderSaga')

  // Correlate messages to saga instances by orderId
  .correlate('OrderSubmitted', msg => msg.orderId, { canStart: true })
  .correlate('*', msg => msg.orderId) // All other messages use orderId too

  // Create initial state when OrderSubmitted is received
  .initial<OrderSubmitted>((msg) => ({
    orderId: msg.orderId,
    customerId: msg.customerId,
    status: 'pending',
    total: msg.total,
  }))

  // Handle PaymentCaptured
  .on('PaymentCaptured')
    .handle(async (msg, state, ctx) => {
      console.log(`Payment captured for order ${state.orderId}`);

      // Publish next event in the workflow
      await ctx.publish({
        type: 'OrderCompleted',
        orderId: state.orderId,
      });

      return {
        ...state,
        status: 'payment_captured',
        transactionId: msg.transactionId,
      };
    })

  // Handle PaymentFailed
  .on('PaymentFailed')
    .handle(async (msg, state, ctx) => {
      console.log(`Payment failed for order ${state.orderId}: ${msg.reason}`);

      await ctx.publish({
        type: 'OrderCancelled',
        orderId: state.orderId,
        reason: msg.reason,
      });

      return {
        ...state,
        status: 'cancelled',
        cancelReason: msg.reason,
      };
    })

  // Handle OrderCompleted - mark saga as complete
  .on('OrderCompleted')
    .handle(async (msg, state, ctx) => {
      console.log(`Order ${state.orderId} completed!`);
      ctx.complete(); // Marks the saga as finished
      return { ...state, status: 'completed' };
    })

  // Handle OrderCancelled - mark saga as complete
  .on('OrderCancelled')
    .handle(async (msg, state, ctx) => {
      console.log(`Order ${state.orderId} cancelled: ${msg.reason}`);
      ctx.complete();
      return { ...state, status: 'cancelled', cancelReason: msg.reason };
    })

  .build();
```

## 5. Create and Start the Bus

Wire everything together:

```typescript
// main.ts
import { createBus } from '@saga-bus/core';
import { InMemoryTransport } from '@saga-bus/transport-inmemory';
import { InMemorySagaStore } from '@saga-bus/store-inmemory';
import { orderSaga } from './order-saga';

async function main() {
  // Create transport and store
  const transport = new InMemoryTransport();
  const store = new InMemorySagaStore();

  // Create the bus
  const bus = createBus({
    transport,
    store,
    sagas: [{ definition: orderSaga }],
  });

  // Start the bus
  await bus.start();
  console.log('Bus started!');

  // Publish a test message
  await bus.publish({
    type: 'OrderSubmitted',
    orderId: 'order-123',
    customerId: 'customer-456',
    items: [{ productId: 'prod-1', quantity: 2 }],
    total: 99.99,
  });

  // Simulate payment success
  await bus.publish({
    type: 'PaymentCaptured',
    orderId: 'order-123',
    transactionId: 'txn-789',
  });

  // Give it a moment to process
  await new Promise(resolve => setTimeout(resolve, 100));

  // Stop the bus
  await bus.stop();
  console.log('Bus stopped!');
}

main().catch(console.error);
```

## 6. Run It

```bash
npx tsx main.ts
```

You should see:

```
Bus started!
Payment captured for order order-123
Order order-123 completed!
Bus stopped!
```

## What Just Happened?

1. **OrderSubmitted** created a new saga instance with `status: 'pending'`
2. **PaymentCaptured** updated the state and published **OrderCompleted**
3. **OrderCompleted** marked the saga as complete

The saga tracked the entire workflow, persisting state at each step.

## Next Steps

- [Your First Saga](/docs/getting-started/your-first-saga) - Build a more complete example
- [Core Concepts](/docs/core-concepts/overview) - Understand how sagas work
- [Transports](/docs/transports/overview) - Use RabbitMQ, Kafka, or other brokers
- [Stores](/docs/stores/overview) - Persist state to PostgreSQL, MongoDB, etc.
