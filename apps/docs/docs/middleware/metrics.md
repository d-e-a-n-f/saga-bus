---
sidebar_position: 4
title: Metrics
---

# Metrics Middleware

Prometheus-compatible metrics for monitoring saga performance.

## Installation

```bash npm2yarn
npm install @saga-bus/middleware-metrics prom-client
```

## Basic Usage

```typescript
import { createMetricsMiddleware } from '@saga-bus/middleware-metrics';

const bus = createBus({
  transport,
  store,
  sagas: [{ definition: orderSaga }],
  middleware: [
    createMetricsMiddleware({
      prefix: 'saga_bus',
    }),
  ],
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `prefix` | `string` | `'saga_bus'` | Metric name prefix |
| `registry` | `Registry` | default | Prometheus registry |
| `buckets` | `number[]` | - | Histogram buckets |
| `labels` | `string[]` | - | Additional labels |
| `customMetrics` | `object` | - | Custom metric definitions |

## Full Configuration Example

```typescript
import { createMetricsMiddleware } from '@saga-bus/middleware-metrics';
import { Registry } from 'prom-client';

const registry = new Registry();

const metricsMiddleware = createMetricsMiddleware({
  prefix: 'order_saga',
  registry,
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  labels: ['environment', 'region'],
  defaultLabels: {
    environment: process.env.NODE_ENV,
    region: process.env.AWS_REGION,
  },
});
```

## Exposed Metrics

### Messages Processed Counter

```prometheus
# HELP saga_bus_messages_total Total number of messages processed
# TYPE saga_bus_messages_total counter
saga_bus_messages_total{saga="OrderSaga",message_type="OrderSubmitted",status="success"} 150
saga_bus_messages_total{saga="OrderSaga",message_type="OrderSubmitted",status="error"} 5
```

### Message Duration Histogram

```prometheus
# HELP saga_bus_message_duration_seconds Message processing duration
# TYPE saga_bus_message_duration_seconds histogram
saga_bus_message_duration_seconds_bucket{saga="OrderSaga",message_type="OrderSubmitted",le="0.1"} 120
saga_bus_message_duration_seconds_bucket{saga="OrderSaga",message_type="OrderSubmitted",le="0.5"} 145
saga_bus_message_duration_seconds_bucket{saga="OrderSaga",message_type="OrderSubmitted",le="1"} 150
saga_bus_message_duration_seconds_sum{saga="OrderSaga",message_type="OrderSubmitted"} 15.5
saga_bus_message_duration_seconds_count{saga="OrderSaga",message_type="OrderSubmitted"} 150
```

### Active Sagas Gauge

```prometheus
# HELP saga_bus_active_sagas Number of active (incomplete) sagas
# TYPE saga_bus_active_sagas gauge
saga_bus_active_sagas{saga="OrderSaga"} 42
```

### Messages In-Flight Gauge

```prometheus
# HELP saga_bus_messages_in_flight Currently processing messages
# TYPE saga_bus_messages_in_flight gauge
saga_bus_messages_in_flight{saga="OrderSaga"} 3
```

## Exposing Metrics

### Express Endpoint

```typescript
import express from 'express';
import { register } from 'prom-client';

const app = express();

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.listen(9090);
```

### Fastify

```typescript
import Fastify from 'fastify';
import { register } from 'prom-client';

const app = Fastify();

app.get('/metrics', async (request, reply) => {
  reply.header('Content-Type', register.contentType);
  return register.metrics();
});
```

## Prometheus Configuration

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'saga-bus'
    static_configs:
      - targets: ['order-service:9090']
    scrape_interval: 15s
```

## Grafana Dashboard

### Message Rate Panel

```
rate(saga_bus_messages_total[5m])
```

### Error Rate Panel

```
rate(saga_bus_messages_total{status="error"}[5m])
/ rate(saga_bus_messages_total[5m])
```

### P99 Latency Panel

```
histogram_quantile(0.99,
  rate(saga_bus_message_duration_seconds_bucket[5m])
)
```

### Active Sagas Panel

```
saga_bus_active_sagas
```

## Custom Metrics

Add business-specific metrics:

```typescript
import { Counter, Gauge } from 'prom-client';

const orderValueTotal = new Counter({
  name: 'order_value_total',
  help: 'Total value of orders processed',
  labelNames: ['currency'],
});

const middleware = createMetricsMiddleware({
  prefix: 'saga_bus',
  customMetrics: {
    onMessage: (context) => {
      if (context.messageType === 'OrderSubmitted') {
        orderValueTotal.inc(
          { currency: context.message.currency },
          context.message.total
        );
      }
    },
  },
});
```

## Docker Setup

```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

## Alerting Rules

```yaml
# alerts.yml
groups:
  - name: saga-bus
    rules:
      - alert: HighErrorRate
        expr: rate(saga_bus_messages_total{status="error"}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate in saga processing"

      - alert: HighLatency
        expr: histogram_quantile(0.99, rate(saga_bus_message_duration_seconds_bucket[5m])) > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High latency in saga processing"
```

## Best Practices

### Use Meaningful Prefixes

```typescript
// Group related metrics
createMetricsMiddleware({ prefix: 'order_saga' });
createMetricsMiddleware({ prefix: 'payment_saga' });
```

### Configure Appropriate Buckets

```typescript
// For fast operations (< 1s)
buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1]

// For slower operations (< 60s)
buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30, 60]
```

### Add Environment Labels

```typescript
createMetricsMiddleware({
  defaultLabels: {
    environment: process.env.NODE_ENV,
    version: process.env.APP_VERSION,
  },
});
```

## See Also

- [Middleware Overview](/docs/middleware/overview)
- [Tracing Middleware](/docs/middleware/tracing)
- [Monitoring](/docs/production/monitoring)
