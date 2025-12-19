---
sidebar_position: 1
---

# Middleware Overview

Add cross-cutting concerns to your sagas.

## Middleware Pipeline

```
Message Received
      │
      ▼
┌─────────────┐
│  Logging    │ ──► Log message details
├─────────────┤
│  Tracing    │ ──► Create OpenTelemetry span
├─────────────┤
│  Metrics    │ ──► Record Prometheus metrics
├─────────────┤
│ Validation  │ ──► Validate message schema
├─────────────┤
│ Idempotency │ ──► Check for duplicates
├─────────────┤
│   Tenant    │ ──► Extract tenant context
└─────────────┘
      │
      ▼
   Handler
```

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
