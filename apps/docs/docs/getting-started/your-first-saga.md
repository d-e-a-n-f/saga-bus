---
sidebar_position: 3
---

# Your First Saga

Let's build a complete e-commerce order saga with error handling, timeouts, and compensation.

## The Scenario

We're building an order processing system that:

1. Receives an order submission
2. Attempts to capture payment
3. Reserves inventory
4. Creates a shipment
5. Handles failures at any step with compensation

## Project Structure

```
order-saga/
├── src/
│   ├── messages.ts     # Message definitions
│   ├── state.ts        # Saga state interface
│   ├── saga.ts         # Saga definition
│   └── index.ts        # Entry point
├── package.json
└── tsconfig.json
```

## Step 1: Define Messages

```typescript
// src/messages.ts

// Commands (requests to do something)
export interface SubmitOrder {
  type: 'SubmitOrder';
  orderId: string;
  customerId: string;
  items: Array<{ productId: string; quantity: number; price: number }>;
}

export interface CapturePayment {
  type: 'CapturePayment';
  orderId: string;
  amount: number;
  paymentMethod: string;
}

export interface ReserveInventory {
  type: 'ReserveInventory';
  orderId: string;
  items: Array<{ productId: string; quantity: number }>;
}

export interface ReleaseInventory {
  type: 'ReleaseInventory';
  orderId: string;
  items: Array<{ productId: string; quantity: number }>;
}

export interface CreateShipment {
  type: 'CreateShipment';
  orderId: string;
  address: string;
}

// Events (things that happened)
export interface OrderSubmitted {
  type: 'OrderSubmitted';
  orderId: string;
  customerId: string;
  items: Array<{ productId: string; quantity: number; price: number }>;
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

export interface InventoryReserved {
  type: 'InventoryReserved';
  orderId: string;
}

export interface InventoryReservationFailed {
  type: 'InventoryReservationFailed';
  orderId: string;
  reason: string;
}

export interface ShipmentCreated {
  type: 'ShipmentCreated';
  orderId: string;
  trackingNumber: string;
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

// Union of all messages
export type OrderMessages =
  | SubmitOrder
  | OrderSubmitted
  | CapturePayment
  | PaymentCaptured
  | PaymentFailed
  | ReserveInventory
  | InventoryReserved
  | InventoryReservationFailed
  | ReleaseInventory
  | CreateShipment
  | ShipmentCreated
  | OrderCompleted
  | OrderCancelled;
```

## Step 2: Define State

```typescript
// src/state.ts
import type { SagaState } from '@saga-bus/core';

export type OrderStatus =
  | 'submitted'
  | 'payment_pending'
  | 'payment_captured'
  | 'inventory_reserved'
  | 'shipped'
  | 'completed'
  | 'cancelled';

export interface OrderSagaState extends SagaState {
  orderId: string;
  customerId: string;
  status: OrderStatus;
  items: Array<{ productId: string; quantity: number; price: number }>;
  total: number;
  transactionId?: string;
  trackingNumber?: string;
  cancelReason?: string;
}
```

## Step 3: Build the Saga

```typescript
// src/saga.ts
import { createSagaMachine } from '@saga-bus/core';
import type { OrderSagaState } from './state';
import type { OrderMessages, OrderSubmitted } from './messages';

export const orderSaga = createSagaMachine<OrderSagaState, OrderMessages>()
  .name('OrderSaga')

  // === Correlation ===
  // OrderSubmitted can start a new saga
  .correlate('OrderSubmitted', msg => msg.orderId, { canStart: true })
  // All other messages correlate by orderId
  .correlate('*', msg => msg.orderId)

  // === Initial State ===
  .initial<OrderSubmitted>((msg) => ({
    orderId: msg.orderId,
    customerId: msg.customerId,
    status: 'submitted',
    items: msg.items,
    total: msg.total,
  }))

  // === Order Submitted → Request Payment ===
  .on('OrderSubmitted')
    .handle(async (msg, state, ctx) => {
      // Set a timeout - if no payment in 30 minutes, cancel
      ctx.setTimeout(30 * 60 * 1000);

      // Request payment capture
      await ctx.publish({
        type: 'CapturePayment',
        orderId: state.orderId,
        amount: state.total,
        paymentMethod: 'credit_card',
      });

      return { ...state, status: 'payment_pending' };
    })

  // === Payment Captured → Reserve Inventory ===
  .on('PaymentCaptured')
    .when(state => state.status === 'payment_pending')
    .handle(async (msg, state, ctx) => {
      // Clear payment timeout
      ctx.clearTimeout();

      // Request inventory reservation
      await ctx.publish({
        type: 'ReserveInventory',
        orderId: state.orderId,
        items: state.items.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
        })),
      });

      return {
        ...state,
        status: 'payment_captured',
        transactionId: msg.transactionId,
      };
    })

  // === Payment Failed → Cancel Order ===
  .on('PaymentFailed')
    .when(state => state.status === 'payment_pending')
    .handle(async (msg, state, ctx) => {
      ctx.clearTimeout();

      await ctx.publish({
        type: 'OrderCancelled',
        orderId: state.orderId,
        reason: `Payment failed: ${msg.reason}`,
      });

      return { ...state, status: 'cancelled', cancelReason: msg.reason };
    })

  // === Inventory Reserved → Create Shipment ===
  .on('InventoryReserved')
    .when(state => state.status === 'payment_captured')
    .handle(async (msg, state, ctx) => {
      await ctx.publish({
        type: 'CreateShipment',
        orderId: state.orderId,
        address: '123 Main St', // In real app, get from customer
      });

      return { ...state, status: 'inventory_reserved' };
    })

  // === Inventory Failed → Refund & Cancel ===
  .on('InventoryReservationFailed')
    .when(state => state.status === 'payment_captured')
    .handle(async (msg, state, ctx) => {
      // Here you would publish a RefundPayment command
      // For simplicity, we just cancel

      await ctx.publish({
        type: 'OrderCancelled',
        orderId: state.orderId,
        reason: `Inventory unavailable: ${msg.reason}`,
      });

      return { ...state, status: 'cancelled', cancelReason: msg.reason };
    })

  // === Shipment Created → Complete Order ===
  .on('ShipmentCreated')
    .when(state => state.status === 'inventory_reserved')
    .handle(async (msg, state, ctx) => {
      await ctx.publish({
        type: 'OrderCompleted',
        orderId: state.orderId,
      });

      return {
        ...state,
        status: 'shipped',
        trackingNumber: msg.trackingNumber,
      };
    })

  // === Order Completed ===
  .on('OrderCompleted')
    .handle(async (msg, state, ctx) => {
      ctx.complete();
      return { ...state, status: 'completed' };
    })

  // === Order Cancelled ===
  .on('OrderCancelled')
    .handle(async (msg, state, ctx) => {
      ctx.complete();
      return { ...state, status: 'cancelled', cancelReason: msg.reason };
    })

  // === Timeout Expired ===
  .on('SagaTimeoutExpired')
    .when(state => state.status === 'payment_pending')
    .handle(async (msg, state, ctx) => {
      await ctx.publish({
        type: 'OrderCancelled',
        orderId: state.orderId,
        reason: 'Payment timeout',
      });

      return { ...state, status: 'cancelled', cancelReason: 'Payment timeout' };
    })

  .build();
```

## Step 4: Run the Saga

```typescript
// src/index.ts
import { createBus } from '@saga-bus/core';
import { InMemoryTransport } from '@saga-bus/transport-inmemory';
import { InMemorySagaStore } from '@saga-bus/store-inmemory';
import { orderSaga } from './saga';

async function main() {
  const transport = new InMemoryTransport();
  const store = new InMemorySagaStore();

  const bus = createBus({
    transport,
    store,
    sagas: [{ definition: orderSaga }],
  });

  await bus.start();

  // Simulate order flow
  console.log('--- Submitting order ---');
  await bus.publish({
    type: 'OrderSubmitted',
    orderId: 'order-001',
    customerId: 'cust-123',
    items: [{ productId: 'widget', quantity: 2, price: 25.00 }],
    total: 50.00,
  });

  // Simulate external services responding
  await delay(100);

  console.log('--- Payment captured ---');
  await bus.publish({
    type: 'PaymentCaptured',
    orderId: 'order-001',
    transactionId: 'txn-abc',
  });

  await delay(100);

  console.log('--- Inventory reserved ---');
  await bus.publish({
    type: 'InventoryReserved',
    orderId: 'order-001',
  });

  await delay(100);

  console.log('--- Shipment created ---');
  await bus.publish({
    type: 'ShipmentCreated',
    orderId: 'order-001',
    trackingNumber: 'TRACK-123',
  });

  await delay(100);
  await bus.stop();
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(console.error);
```

## Key Takeaways

### State Guards with `.when()`

State guards ensure handlers only run when the saga is in the expected state:

```typescript
.on('PaymentCaptured')
  .when(state => state.status === 'payment_pending')  // Only handle if pending
  .handle(...)
```

### Timeouts

Set timeouts to handle cases where expected events never arrive:

```typescript
// Set 30 minute timeout
ctx.setTimeout(30 * 60 * 1000);

// Later, clear it when payment succeeds
ctx.clearTimeout();

// Handle timeout expiry
.on('SagaTimeoutExpired')
  .handle(...)
```

### Compensation

When something fails, you can compensate by undoing previous steps:

```typescript
.on('InventoryReservationFailed')
  .handle(async (msg, state, ctx) => {
    // Refund the payment we captured
    await ctx.publish({ type: 'RefundPayment', ... });
    // Cancel the order
    await ctx.publish({ type: 'OrderCancelled', ... });
  })
```

### Completing the Saga

Always call `ctx.complete()` when the saga reaches a terminal state:

```typescript
.on('OrderCompleted')
  .handle(async (msg, state, ctx) => {
    ctx.complete();  // Saga is finished
    return { ...state, status: 'completed' };
  })
```

## Next Steps

- [Project Structure](/docs/getting-started/project-structure) - Organize a larger project
- [Core Concepts](/docs/core-concepts/overview) - Deep dive into saga mechanics
- [Transports](/docs/transports/rabbitmq) - Use RabbitMQ for production
- [Stores](/docs/stores/postgres) - Persist state to PostgreSQL
