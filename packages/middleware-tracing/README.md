# @saga-bus/middleware-tracing

OpenTelemetry distributed tracing middleware for saga-bus.

## Installation

```bash
pnpm add @saga-bus/middleware-tracing @opentelemetry/api
```

## Usage

```typescript
import { createTracingMiddleware } from "@saga-bus/middleware-tracing";
import { createBus } from "@saga-bus/core";
import { trace } from "@opentelemetry/api";

const tracingMiddleware = createTracingMiddleware({
  tracer: trace.getTracer("my-service"),
});

const bus = createBus({
  middleware: [tracingMiddleware],
  sagas: [...],
  transport,
});
```

## Features

- Automatic span creation for message processing
- W3C Trace Context propagation (traceparent/tracestate headers)
- Span attributes for message type, saga ID, correlation ID
- Error recording on handler failures
- Optional payload recording

## Trace Context Propagation

The middleware automatically propagates trace context across service boundaries:

```typescript
import { createPublishTracer } from "@saga-bus/middleware-tracing";

const publishWithTracing = createPublishTracer(bus, {
  tracer: trace.getTracer("my-service"),
});

// Automatically injects traceparent/tracestate headers
await publishWithTracing({
  type: "OrderCreated",
  payload: { orderId: "123" },
});
```

## Span Attributes

Each message processing span includes:

| Attribute | Description |
|-----------|-------------|
| `messaging.system` | `"saga-bus"` |
| `messaging.operation` | `"process"` |
| `messaging.message.type` | Message type |
| `saga.name` | Saga name |
| `saga.id` | Saga instance ID |
| `messaging.message.correlation_id` | Correlation ID |

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `tracer` | `Tracer` | global | OpenTelemetry tracer |
| `tracerName` | `string` | `"@saga-bus/middleware-tracing"` | Tracer name |
| `recordPayload` | `boolean` | `false` | Record payload as attribute |
| `maxPayloadSize` | `number` | `1024` | Max payload size to record |
| `attributeExtractor` | `function` | - | Custom attribute extractor |

## Custom Attributes

```typescript
createTracingMiddleware({
  attributeExtractor: (envelope) => ({
    "custom.order_id": envelope.payload?.orderId,
    "custom.priority": envelope.payload?.priority,
  }),
});
```

## License

MIT
