---
sidebar_position: 3
title: Tracing
---

# Tracing Middleware

Distributed tracing with OpenTelemetry for observability across services.

## Installation

```bash npm2yarn
npm install @saga-bus/middleware-tracing @opentelemetry/api @opentelemetry/sdk-node
```

## Basic Usage

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

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `serviceName` | `string` | Required | Service name for traces |
| `tracer` | `Tracer` | - | Custom OpenTelemetry tracer |
| `propagator` | `TextMapPropagator` | W3C | Context propagator |
| `spanAttributes` | `function` | - | Custom span attributes |
| `recordException` | `boolean` | `true` | Record exceptions in spans |

## Full Configuration Example

```typescript
import { createTracingMiddleware } from '@saga-bus/middleware-tracing';
import { trace } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';

const tracer = trace.getTracer('saga-bus', '1.0.0');

const tracingMiddleware = createTracingMiddleware({
  serviceName: 'order-service',
  tracer,
  propagator: new W3CTraceContextPropagator(),
  spanAttributes: (context) => ({
    'saga.name': context.sagaName,
    'message.type': context.messageType,
    'correlation.id': context.correlationId,
  }),
  recordException: true,
});
```

## OpenTelemetry Setup

### Node.js SDK

```typescript
// tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const sdk = new NodeSDK({
  serviceName: 'order-service',
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces',
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
```

### Import Before App

```typescript
// index.ts
import './tracing'; // Must be first!
import { createBus } from '@saga-bus/core';
// ...
```

## Span Structure

### Span Structure

export const spanNodes = [
  { id: 'handle', type: 'stateNode', position: { x: 180, y: 0 }, data: { label: 'saga-bus.handle', description: 'parent span', status: 'active' } },
  { id: 'get', type: 'serviceNode', position: { x: 50, y: 90 }, data: { label: 'store.get', type: 'database' } },
  { id: 'exec', type: 'serviceNode', position: { x: 150, y: 90 }, data: { label: 'handler.execute', type: 'service' } },
  { id: 'update', type: 'serviceNode', position: { x: 260, y: 90 }, data: { label: 'store.update', type: 'database' } },
  { id: 'pub', type: 'serviceNode', position: { x: 370, y: 90 }, data: { label: 'publish', type: 'queue' } },
];

export const spanEdges = [
  { id: 'sp1', source: 'handle', target: 'get' },
  { id: 'sp2', source: 'handle', target: 'exec' },
  { id: 'sp3', source: 'handle', target: 'update' },
  { id: 'sp4', source: 'handle', target: 'pub' },
];

<FlowDiagram nodes={spanNodes} edges={spanEdges} height={200} />

## Context Propagation

Traces propagate across services via message headers:

```typescript
// Automatic context propagation
// When publishing from one saga to another:

// Service A publishes
await bus.publish({
  type: 'PaymentRequested',
  orderId: '123',
});

// Service B receives - same trace context!
// Headers include: traceparent, tracestate
```

## Exporters

### Jaeger

```typescript
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';

const exporter = new JaegerExporter({
  endpoint: 'http://localhost:14268/api/traces',
});
```

### Zipkin

```typescript
import { ZipkinExporter } from '@opentelemetry/exporter-zipkin';

const exporter = new ZipkinExporter({
  url: 'http://localhost:9411/api/v2/spans',
});
```

### OTLP (Grafana, Honeycomb, etc.)

```typescript
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const exporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  headers: {
    'x-honeycomb-team': process.env.HONEYCOMB_API_KEY,
  },
});
```

## Custom Span Attributes

Add business-specific attributes:

```typescript
const middleware = createTracingMiddleware({
  serviceName: 'order-service',
  spanAttributes: (context) => ({
    'customer.id': context.message.customerId,
    'order.total': context.message.total,
    'order.items.count': context.message.items?.length,
  }),
});
```

## Error Recording

Exceptions are recorded as span events:

```typescript
// Automatic exception recording
const middleware = createTracingMiddleware({
  serviceName: 'order-service',
  recordException: true, // default
});

// Span will include:
// - status: ERROR
// - exception.type: "PaymentDeclinedError"
// - exception.message: "Card declined"
// - exception.stacktrace: "..."
```

## Docker Setup

### Jaeger All-in-One

```yaml
services:
  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"  # UI
      - "14268:14268"  # Collector
    environment:
      - COLLECTOR_OTLP_ENABLED=true
```

### Grafana Tempo

```yaml
services:
  tempo:
    image: grafana/tempo:latest
    ports:
      - "4317:4317"   # OTLP gRPC
      - "4318:4318"   # OTLP HTTP
```

## Best Practices

### Always Initialize Early

```typescript
// tracing.ts should be imported first
import './tracing';
import { createBus } from '@saga-bus/core';
```

### Use Meaningful Service Names

```typescript
// Good
createTracingMiddleware({ serviceName: 'order-service' });

// Avoid
createTracingMiddleware({ serviceName: 'app' });
```

### Add Business Context

```typescript
spanAttributes: (ctx) => ({
  'customer.tier': ctx.message.customerTier,
  'order.priority': ctx.message.priority,
});
```

## See Also

- [Middleware Overview](/docs/middleware/overview)
- [Metrics Middleware](/docs/middleware/metrics)
- [Monitoring](/docs/production/monitoring)
