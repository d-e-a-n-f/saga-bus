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

export const sagaPatternNodes = [
  { id: 'submitted', type: 'stateNode', position: { x: 50, y: 50 }, data: { label: 'OrderSubmitted', status: 'initial' } },
  { id: 'pending', type: 'stateNode', position: { x: 50, y: 150 }, data: { label: 'pending', status: 'pending' } },
  { id: 'payment', type: 'serviceNode', position: { x: 200, y: 50 }, data: { label: 'CapturePayment', type: 'service' } },
  { id: 'processing', type: 'stateNode', position: { x: 200, y: 150 }, data: { label: 'processing', status: 'active' } },
  { id: 'inventory', type: 'serviceNode', position: { x: 350, y: 50 }, data: { label: 'ReserveInventory', type: 'service' } },
  { id: 'confirmed', type: 'stateNode', position: { x: 350, y: 150 }, data: { label: 'confirmed', status: 'success' } },
  { id: 'cancelled', type: 'stateNode', position: { x: 200, y: 270 }, data: { label: 'cancelled', status: 'error' } },
  { id: 'ship', type: 'serviceNode', position: { x: 350, y: 270 }, data: { label: 'ShipOrder', type: 'service' } },
  { id: 'shipped', type: 'stateNode', position: { x: 350, y: 370 }, data: { label: 'shipped', status: 'active' } },
  { id: 'completed', type: 'stateNode', position: { x: 350, y: 470 }, data: { label: 'completed', status: 'success' } },
];

export const sagaPatternEdges = [
  { id: 'e1', source: 'submitted', target: 'pending', animated: true },
  { id: 'e2', source: 'submitted', target: 'payment' },
  { id: 'e3', source: 'payment', target: 'processing' },
  { id: 'e4', source: 'payment', target: 'inventory' },
  { id: 'e5', source: 'inventory', target: 'confirmed' },
  { id: 'e6', source: 'processing', target: 'cancelled', label: 'PaymentFailed', data: { type: 'error' } },
  { id: 'e7', source: 'confirmed', target: 'ship' },
  { id: 'e8', source: 'ship', target: 'shipped' },
  { id: 'e9', source: 'shipped', target: 'completed', data: { type: 'success' } },
];

<FlowDiagram
  nodes={sagaPatternNodes}
  edges={sagaPatternEdges}
  height={550}
/>

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

export const lifecycleNodes = [
  { id: 'receive', type: 'stateNode', position: { x: 200, y: 0 }, data: { label: '1. Message Received', status: 'initial' } },
  { id: 'find', type: 'stateNode', position: { x: 200, y: 80 }, data: { label: '2. Find Saga Instance', description: 'by correlation' } },
  { id: 'decision', type: 'decisionNode', position: { x: 200, y: 160 }, data: { label: 'Found?', condition: 'canStart' } },
  { id: 'create', type: 'stateNode', position: { x: 380, y: 160 }, data: { label: 'Create New Instance', status: 'success' } },
  { id: 'load', type: 'stateNode', position: { x: 50, y: 160 }, data: { label: 'Load State', status: 'active' } },
  { id: 'execute', type: 'stateNode', position: { x: 200, y: 270 }, data: { label: '3. Execute Handler', status: 'active' } },
  { id: 'update', type: 'stateNode', position: { x: 200, y: 350 }, data: { label: '4. Update State', description: 'optimistic concurrency' } },
  { id: 'publish', type: 'stateNode', position: { x: 200, y: 430 }, data: { label: '5. Publish Outgoing', status: 'active' } },
  { id: 'ack', type: 'stateNode', position: { x: 200, y: 510 }, data: { label: '6. Acknowledge', status: 'success' } },
];

export const lifecycleEdges = [
  { id: 'l1', source: 'receive', target: 'find', animated: true },
  { id: 'l2', source: 'find', target: 'decision' },
  { id: 'l3', source: 'decision', target: 'create', label: 'Not found + canStart', sourceHandle: 'right' },
  { id: 'l4', source: 'decision', target: 'load', label: 'Found', sourceHandle: 'left' },
  { id: 'l5', source: 'create', target: 'execute' },
  { id: 'l6', source: 'load', target: 'execute' },
  { id: 'l7', source: 'execute', target: 'update' },
  { id: 'l8', source: 'update', target: 'publish' },
  { id: 'l9', source: 'publish', target: 'ack', data: { type: 'success' } },
];

<FlowDiagram
  nodes={lifecycleNodes}
  edges={lifecycleEdges}
  height={600}
/>

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
