# @saga-bus/middleware-metrics

Prometheus metrics middleware for saga-bus.

## Installation

```bash
pnpm add @saga-bus/middleware-metrics prom-client
```

## Usage

```typescript
import { createMetricsMiddleware } from "@saga-bus/middleware-metrics";
import { createBus } from "@saga-bus/core";
import { register } from "prom-client";

const metricsMiddleware = createMetricsMiddleware();

const bus = createBus({
  middleware: [metricsMiddleware],
  sagas: [...],
  transport,
});

// Expose metrics endpoint (e.g., with Express)
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});
```

## Features

- Message processing counter (success/failure)
- Processing duration histogram
- Saga lifecycle tracking (created/completed)
- Customizable metric prefix
- Configurable histogram buckets
- Per-saga and per-message-type labels

## Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `saga_bus_messages_processed_total` | Counter | `message_type`, `saga_name` | Successfully processed messages |
| `saga_bus_messages_failed_total` | Counter | `message_type`, `saga_name`, `error_type` | Failed message processing |
| `saga_bus_message_processing_duration_ms` | Histogram | `message_type`, `saga_name` | Processing duration in milliseconds |
| `saga_bus_sagas_created_total` | Counter | `saga_name`, `message_type` | New saga instances created |
| `saga_bus_sagas_completed_total` | Counter | `saga_name` | Completed saga instances |

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `registry` | `Registry` | default | Prometheus registry |
| `prefix` | `string` | `"saga_bus"` | Metric name prefix |
| `durationBuckets` | `number[]` | `[1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]` | Histogram buckets (ms) |
| `recordSagaLabels` | `boolean` | `true` | Include saga_name label |

## Custom Registry

```typescript
import { Registry } from "prom-client";

const customRegistry = new Registry();

const metricsMiddleware = createMetricsMiddleware({
  registry: customRegistry,
  prefix: "myapp",
});

// Use custom registry for metrics endpoint
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", customRegistry.contentType);
  res.end(await customRegistry.metrics());
});
```

## Direct Metric Access

Use `createMetricsMiddlewareWithMetrics` when you need direct access to metric objects:

```typescript
import { createMetricsMiddlewareWithMetrics } from "@saga-bus/middleware-metrics";

const { middleware, metrics } = createMetricsMiddlewareWithMetrics();

// Access metrics directly
const processedCount = await metrics.messagesProcessed.get();
console.log(`Processed: ${processedCount.values[0]?.value}`);
```

## Grafana Dashboard

Example PromQL queries for dashboards:

```promql
# Message throughput (per minute)
rate(saga_bus_messages_processed_total[1m])

# P95 processing duration
histogram_quantile(0.95, rate(saga_bus_message_processing_duration_ms_bucket[5m]))

# Error rate
rate(saga_bus_messages_failed_total[5m]) / rate(saga_bus_messages_processed_total[5m])

# Sagas in flight (created - completed)
saga_bus_sagas_created_total - saga_bus_sagas_completed_total
```

## License

MIT
