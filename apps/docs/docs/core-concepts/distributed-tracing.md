---
sidebar_position: 8
---

# Distributed Tracing

W3C trace context propagation for observability.

## Overview

Saga Bus automatically propagates W3C trace context through messages:

```
Service A                    Saga Bus                    Service B
    │                           │                           │
    │ ──── traceparent ────►    │                           │
    │                           │ ──── traceparent ────►    │
    │                           │                           │
```

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

```
┌─────────────────────────────────────────────────────────────┐
│ Trace: Order Processing                                     │
├─────────────────────────────────────────────────────────────┤
│ ├── OrderSubmitted (saga-worker)                            │
│ │   └── CapturePayment (payment-service)                    │
│ │       └── PaymentCaptured (saga-worker)                   │
│ │           └── ReserveInventory (inventory-service)        │
│ │               └── InventoryReserved (saga-worker)         │
│ │                   └── CreateShipment (shipping-service)   │
└─────────────────────────────────────────────────────────────┘
```

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
