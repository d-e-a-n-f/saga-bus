---
sidebar_position: 2
title: Order Saga
---

# Order Saga Example

A complete e-commerce order processing saga demonstrating core saga patterns.

## Overview

This example implements a typical e-commerce flow:

1. Customer submits order
2. Process payment
3. Reserve inventory
4. Create shipment
5. Complete order

With compensation for failures at each step.

## State Machine

export const orderSagaNodes = [
  { id: 'start', type: 'stateNode', position: { x: 250, y: 0 }, data: { label: 'OrderSubmitted', status: 'initial' } },
  { id: 'submitted', type: 'stateNode', position: { x: 250, y: 80 }, data: { label: 'submitted', status: 'active' } },
  { id: 'failed', type: 'stateNode', position: { x: 80, y: 180 }, data: { label: 'failed', status: 'error' } },
  { id: 'paid', type: 'stateNode', position: { x: 250, y: 180 }, data: { label: 'paid', status: 'success' } },
  { id: 'compensating', type: 'stateNode', position: { x: 80, y: 280 }, data: { label: 'compensating', status: 'warning' } },
  { id: 'reserved', type: 'stateNode', position: { x: 250, y: 280 }, data: { label: 'reserved', status: 'success' } },
  { id: 'completed', type: 'stateNode', position: { x: 250, y: 380 }, data: { label: 'completed', status: 'success' } },
];

export const orderSagaEdges = [
  { id: 'e1', source: 'start', target: 'submitted', animated: true },
  { id: 'e2', source: 'submitted', target: 'failed', label: 'PaymentFailed', data: { type: 'error' } },
  { id: 'e3', source: 'submitted', target: 'paid', label: 'PaymentCaptured', data: { type: 'success' } },
  { id: 'e4', source: 'paid', target: 'compensating', label: 'InventoryFailed', data: { type: 'error' } },
  { id: 'e5', source: 'paid', target: 'reserved', label: 'InventoryReserved', data: { type: 'success' } },
  { id: 'e6', source: 'compensating', target: 'failed' },
  { id: 'e7', source: 'reserved', target: 'completed', label: 'ShipmentCreated', data: { type: 'success' } },
];

<FlowDiagram
  nodes={orderSagaNodes}
  edges={orderSagaEdges}
  height={480}
/>

## Implementation

### Saga Definition

```typescript
// sagas/order-saga.ts
import { defineSaga } from '@saga-bus/core';

interface OrderState {
  orderId: string;
  customerId: string;
  items: OrderItem[];
  total: number;
  status: 'submitted' | 'paid' | 'reserved' | 'shipped' | 'completed' | 'failed' | 'compensating';
  transactionId?: string;
  reservationId?: string;
  shipmentId?: string;
  failureReason?: string;
}

interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

export const orderSaga = defineSaga({
  name: 'OrderSaga',
  initialState: (): OrderState => ({
    orderId: '',
    customerId: '',
    items: [],
    total: 0,
    status: 'submitted',
  }),
  correlationId: (message) => message.orderId,
  handlers: {
    OrderSubmitted: async (ctx) => {
      const { orderId, customerId, items, total } = ctx.message;

      ctx.setState({
        orderId,
        customerId,
        items,
        total,
        status: 'submitted',
      });

      // Request payment
      ctx.publish({
        type: 'PaymentRequested',
        orderId,
        customerId,
        amount: total,
      });
    },

    PaymentCaptured: async (ctx) => {
      if (ctx.state.status !== 'submitted') return; // Idempotent

      ctx.setState({
        ...ctx.state,
        status: 'paid',
        transactionId: ctx.message.transactionId,
      });

      // Reserve inventory
      ctx.publish({
        type: 'ReserveInventory',
        orderId: ctx.state.orderId,
        items: ctx.state.items,
      });
    },

    PaymentFailed: async (ctx) => {
      ctx.setState({
        ...ctx.state,
        status: 'failed',
        failureReason: ctx.message.reason,
      });

      ctx.complete(); // End saga
    },

    InventoryReserved: async (ctx) => {
      if (ctx.state.status !== 'paid') return;

      ctx.setState({
        ...ctx.state,
        status: 'reserved',
        reservationId: ctx.message.reservationId,
      });

      // Create shipment
      ctx.publish({
        type: 'CreateShipment',
        orderId: ctx.state.orderId,
        customerId: ctx.state.customerId,
        items: ctx.state.items,
      });
    },

    InventoryFailed: async (ctx) => {
      // Compensation: refund payment
      ctx.setState({
        ...ctx.state,
        status: 'compensating',
        failureReason: ctx.message.reason,
      });

      ctx.publish({
        type: 'RefundPayment',
        orderId: ctx.state.orderId,
        transactionId: ctx.state.transactionId!,
        reason: 'Inventory unavailable',
      });
    },

    RefundCompleted: async (ctx) => {
      ctx.setState({
        ...ctx.state,
        status: 'failed',
      });

      ctx.complete();
    },

    ShipmentCreated: async (ctx) => {
      if (ctx.state.status !== 'reserved') return;

      ctx.setState({
        ...ctx.state,
        status: 'completed',
        shipmentId: ctx.message.shipmentId,
      });

      // Notify customer
      ctx.publish({
        type: 'OrderCompleted',
        orderId: ctx.state.orderId,
        customerId: ctx.state.customerId,
        shipmentId: ctx.message.shipmentId,
      });

      ctx.complete(); // End saga
    },
  },
});
```

### Message Types

```typescript
// types/messages.ts

// Commands (requests to do something)
interface PaymentRequested {
  type: 'PaymentRequested';
  orderId: string;
  customerId: string;
  amount: number;
}

interface ReserveInventory {
  type: 'ReserveInventory';
  orderId: string;
  items: OrderItem[];
}

interface CreateShipment {
  type: 'CreateShipment';
  orderId: string;
  customerId: string;
  items: OrderItem[];
}

interface RefundPayment {
  type: 'RefundPayment';
  orderId: string;
  transactionId: string;
  reason: string;
}

// Events (things that happened)
interface OrderSubmitted {
  type: 'OrderSubmitted';
  orderId: string;
  customerId: string;
  items: OrderItem[];
  total: number;
}

interface PaymentCaptured {
  type: 'PaymentCaptured';
  orderId: string;
  transactionId: string;
}

interface PaymentFailed {
  type: 'PaymentFailed';
  orderId: string;
  reason: string;
}

interface InventoryReserved {
  type: 'InventoryReserved';
  orderId: string;
  reservationId: string;
}

interface InventoryFailed {
  type: 'InventoryFailed';
  orderId: string;
  reason: string;
}

interface ShipmentCreated {
  type: 'ShipmentCreated';
  orderId: string;
  shipmentId: string;
}

interface OrderCompleted {
  type: 'OrderCompleted';
  orderId: string;
  customerId: string;
  shipmentId: string;
}
```

### Worker Setup

```typescript
// worker/index.ts
import { createBus } from '@saga-bus/core';
import { RabbitMQTransport } from '@saga-bus/transport-rabbitmq';
import { PostgresSagaStore, createSchema } from '@saga-bus/store-postgres';
import { Pool } from 'pg';
import { orderSaga } from '../sagas/order-saga';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create schema if not exists
await createSchema(pool);

const transport = new RabbitMQTransport({
  url: process.env.RABBITMQ_URL,
  queue: 'saga-messages',
});

const store = new PostgresSagaStore({ pool });

const bus = createBus({
  transport,
  store,
  sagas: [{ definition: orderSaga }],
});

await bus.start();
console.log('Worker started');

// Graceful shutdown
process.on('SIGTERM', async () => {
  await bus.stop();
  await pool.end();
});
```

### API Endpoint

```typescript
// api/routes/orders.ts
import { Router } from 'express';
import { bus } from '../bus';

const router = Router();

router.post('/orders', async (req, res) => {
  const orderId = crypto.randomUUID();
  const { customerId, items } = req.body;

  const total = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  await bus.publish({
    type: 'OrderSubmitted',
    orderId,
    customerId,
    items,
    total,
  });

  res.status(201).json({ orderId });
});

router.get('/orders/:orderId', async (req, res) => {
  const state = await bus.getSagaState('OrderSaga', req.params.orderId);

  if (!state) {
    return res.status(404).json({ error: 'Order not found' });
  }

  res.json(state);
});

export default router;
```

## External Service Handlers

### Payment Service

```typescript
// services/payment-handler.ts
import { createHandler } from '@saga-bus/core';

export const paymentHandler = createHandler({
  messageType: 'PaymentRequested',
  handler: async (ctx) => {
    const { orderId, customerId, amount } = ctx.message;

    try {
      // Call external payment API
      const result = await paymentApi.capture({
        customerId,
        amount,
        reference: orderId,
      });

      ctx.publish({
        type: 'PaymentCaptured',
        orderId,
        transactionId: result.transactionId,
      });
    } catch (error) {
      ctx.publish({
        type: 'PaymentFailed',
        orderId,
        reason: error.message,
      });
    }
  },
});
```

### Inventory Service

```typescript
// services/inventory-handler.ts
export const inventoryHandler = createHandler({
  messageType: 'ReserveInventory',
  handler: async (ctx) => {
    const { orderId, items } = ctx.message;

    try {
      const result = await inventoryApi.reserve(items);

      ctx.publish({
        type: 'InventoryReserved',
        orderId,
        reservationId: result.reservationId,
      });
    } catch (error) {
      ctx.publish({
        type: 'InventoryFailed',
        orderId,
        reason: error.message,
      });
    }
  },
});
```

## Testing

```typescript
import { TestHarness } from '@saga-bus/test';
import { orderSaga } from './order-saga';

describe('OrderSaga', () => {
  let harness: TestHarness;

  beforeEach(async () => {
    harness = new TestHarness();
    await harness.start({ sagas: [{ definition: orderSaga }] });
  });

  afterEach(async () => {
    await harness.stop();
  });

  it('completes happy path', async () => {
    // Submit order
    await harness.publish({
      type: 'OrderSubmitted',
      orderId: 'order-1',
      customerId: 'cust-1',
      items: [{ productId: 'prod-1', quantity: 2, price: 50 }],
      total: 100,
    });

    // Verify payment requested
    await harness.waitForMessage('PaymentRequested');

    // Simulate payment success
    await harness.publish({
      type: 'PaymentCaptured',
      orderId: 'order-1',
      transactionId: 'txn-123',
    });

    // Verify inventory requested
    await harness.waitForMessage('ReserveInventory');

    // Simulate inventory success
    await harness.publish({
      type: 'InventoryReserved',
      orderId: 'order-1',
      reservationId: 'res-456',
    });

    // Simulate shipment created
    await harness.publish({
      type: 'ShipmentCreated',
      orderId: 'order-1',
      shipmentId: 'ship-789',
    });

    // Verify completed
    const state = await harness.getSagaState('OrderSaga', 'order-1');
    expect(state.status).toBe('completed');
  });

  it('compensates on inventory failure', async () => {
    // Submit and pay
    await harness.publish({
      type: 'OrderSubmitted',
      orderId: 'order-2',
      customerId: 'cust-1',
      items: [{ productId: 'prod-1', quantity: 2, price: 50 }],
      total: 100,
    });

    await harness.publish({
      type: 'PaymentCaptured',
      orderId: 'order-2',
      transactionId: 'txn-456',
    });

    // Inventory fails
    await harness.publish({
      type: 'InventoryFailed',
      orderId: 'order-2',
      reason: 'Out of stock',
    });

    // Verify refund requested
    const refundMsg = await harness.waitForMessage('RefundPayment');
    expect(refundMsg.transactionId).toBe('txn-456');

    // Complete refund
    await harness.publish({
      type: 'RefundCompleted',
      orderId: 'order-2',
    });

    // Verify failed state
    const state = await harness.getSagaState('OrderSaga', 'order-2');
    expect(state.status).toBe('failed');
  });
});
```

## Running the Example

```bash
# Start infrastructure
docker compose up -d

# Run worker
pnpm --filter example-worker dev

# Create an order (in another terminal)
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "cust-123",
    "items": [
      {"productId": "prod-1", "quantity": 2, "price": 49.99}
    ]
  }'

# Check order status
curl http://localhost:3000/api/orders/{orderId}
```

## See Also

- [Your First Saga](/docs/getting-started/your-first-saga) - Step-by-step tutorial
- [Loan Application](/docs/examples/loan-application) - Advanced example
- [Common Patterns](/docs/examples/patterns) - Reusable patterns
