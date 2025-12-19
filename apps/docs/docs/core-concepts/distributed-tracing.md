---
sidebar_position: 8
---

# Distributed Tracing

W3C trace context propagation for observability.

## Overview

Saga Bus automatically propagates W3C trace context through messages:

export const traceNodes = [
  { id: 'svcA', type: 'serviceNode', position: { x: 0, y: 50 }, data: { label: 'Service A', type: 'service' } },
  { id: 'bus', type: 'serviceNode', position: { x: 180, y: 50 }, data: { label: 'Saga Bus', type: 'queue' } },
  { id: 'svcB', type: 'serviceNode', position: { x: 360, y: 50 }, data: { label: 'Service B', type: 'service' } },
];

export const traceEdges = [
  { id: 't1', source: 'svcA', target: 'bus', label: 'traceparent', animated: true },
  { id: 't2', source: 'bus', target: 'svcB', label: 'traceparent', animated: true },
];

<FlowDiagram nodes={traceNodes} edges={traceEdges} height={180} />

## Trace Context

Trace context is stored in saga metadata:

```typescript
interface SagaStateMetadata {
  traceParent?: string | null;  // W3C traceparent header
  traceState?: string | null;   // W3C tracestate header
}
```

## Automatic Propagation

When you publish messages, trace context flows automatically:

```typescript
.on('OrderSubmitted')
  .handle(async (msg, state, ctx) => {
    // traceparent is automatically included
    await ctx.publish({
      type: 'CapturePayment',
      orderId: state.orderId,
    });

    return state;
  })
```

## OpenTelemetry Integration

Use the tracing middleware for full OpenTelemetry support:

```typescript
import { createTracingMiddleware } from '@saga-bus/middleware-tracing';

const bus = createBus({
  transport,
  store,
  sagas: [{ definition: orderSaga }],
  middleware: [
    createTracingMiddleware({
      serviceName: 'order-service',
    }),
  ],
});
```

This creates spans for:
- Message handling
- State persistence
- Outgoing publishes

## Viewing Traces

With a tracing backend (Jaeger, Zipkin, etc.):

export const traceViewNodes = [
  { id: 'order', type: 'stateNode', position: { x: 50, y: 0 }, data: { label: 'OrderSubmitted', description: 'saga-worker', status: 'active' } },
  { id: 'capture', type: 'serviceNode', position: { x: 100, y: 70 }, data: { label: 'CapturePayment', type: 'service' } },
  { id: 'captured', type: 'stateNode', position: { x: 150, y: 140 }, data: { label: 'PaymentCaptured', description: 'saga-worker', status: 'active' } },
  { id: 'reserve', type: 'serviceNode', position: { x: 200, y: 210 }, data: { label: 'ReserveInventory', type: 'service' } },
  { id: 'reserved', type: 'stateNode', position: { x: 250, y: 280 }, data: { label: 'InventoryReserved', description: 'saga-worker', status: 'active' } },
  { id: 'ship', type: 'serviceNode', position: { x: 300, y: 350 }, data: { label: 'CreateShipment', type: 'service' } },
];

export const traceViewEdges = [
  { id: 'tv1', source: 'order', target: 'capture', animated: true },
  { id: 'tv2', source: 'capture', target: 'captured' },
  { id: 'tv3', source: 'captured', target: 'reserve' },
  { id: 'tv4', source: 'reserve', target: 'reserved' },
  { id: 'tv5', source: 'reserved', target: 'ship', data: { type: 'success' } },
];

<FlowDiagram nodes={traceViewNodes} edges={traceViewEdges} height={450} />

## Custom Attributes

Add custom span attributes:

```typescript
.on('OrderSubmitted')
  .handle(async (msg, state, ctx) => {
    ctx.setMetadata('order.total', state.total);
    ctx.setMetadata('order.itemCount', state.items.length);
    return state;
  })
```

## Learn More

- [Tracing Middleware](/docs/middleware/tracing) - Full configuration options
- [Observability](/docs/production/observability) - Production setup
