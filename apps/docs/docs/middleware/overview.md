---
sidebar_position: 1
---

# Middleware Overview

Add cross-cutting concerns to your sagas.

## Middleware Pipeline

export const middlewareNodes = [
  { id: 'msg', type: 'stateNode', position: { x: 200, y: 0 }, data: { label: 'Message Received', status: 'initial' } },
  { id: 'logging', type: 'serviceNode', position: { x: 200, y: 70 }, data: { label: 'Logging', type: 'service' } },
  { id: 'tracing', type: 'serviceNode', position: { x: 200, y: 140 }, data: { label: 'Tracing', type: 'service' } },
  { id: 'metrics', type: 'serviceNode', position: { x: 200, y: 210 }, data: { label: 'Metrics', type: 'service' } },
  { id: 'validation', type: 'serviceNode', position: { x: 200, y: 280 }, data: { label: 'Validation', type: 'service' } },
  { id: 'idempotency', type: 'serviceNode', position: { x: 200, y: 350 }, data: { label: 'Idempotency', type: 'service' } },
  { id: 'tenant', type: 'serviceNode', position: { x: 200, y: 420 }, data: { label: 'Tenant', type: 'service' } },
  { id: 'handler', type: 'stateNode', position: { x: 200, y: 500 }, data: { label: 'Handler', status: 'success' } },
];

export const middlewareEdges = [
  { id: 'm1', source: 'msg', target: 'logging', animated: true },
  { id: 'm2', source: 'logging', target: 'tracing' },
  { id: 'm3', source: 'tracing', target: 'metrics' },
  { id: 'm4', source: 'metrics', target: 'validation' },
  { id: 'm5', source: 'validation', target: 'idempotency' },
  { id: 'm6', source: 'idempotency', target: 'tenant' },
  { id: 'm7', source: 'tenant', target: 'handler', data: { type: 'success' } },
];

<FlowDiagram nodes={middlewareNodes} edges={middlewareEdges} height={600} />

## Available Middleware

| Package | Purpose |
|---------|---------|
| [Logging](/docs/middleware/logging) | Structured logging |
| [Tracing](/docs/middleware/tracing) | OpenTelemetry spans |
| [Metrics](/docs/middleware/metrics) | Prometheus metrics |
| [Validation](/docs/middleware/validation) | Schema validation |
| [Idempotency](/docs/middleware/idempotency) | Deduplication |
| [Tenant](/docs/middleware/tenant) | Multi-tenancy |

## Using Middleware

```typescript
import { createBus } from '@saga-bus/core';
import { createLoggingMiddleware } from '@saga-bus/middleware-logging';
import { createTracingMiddleware } from '@saga-bus/middleware-tracing';
import { createMetricsMiddleware } from '@saga-bus/middleware-metrics';

const bus = createBus({
  transport,
  store,
  sagas: [{ definition: orderSaga }],
  middleware: [
    createLoggingMiddleware({ level: 'info' }),
    createTracingMiddleware({ serviceName: 'order-worker' }),
    createMetricsMiddleware({ prefix: 'saga_bus' }),
  ],
});
```

## Middleware Order

Order matters! Recommended order:

1. Logging (first - logs everything)
2. Tracing (creates spans for downstream)
3. Metrics (records timing)
4. Validation (reject invalid early)
5. Idempotency (check duplicates)
6. Tenant (extract context)

## Creating Custom Middleware

See [Custom Middleware](/docs/middleware/custom-middleware).
