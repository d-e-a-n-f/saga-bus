---
sidebar_position: 3
title: Observability
---

# Observability

Monitor saga-bus applications with logging, metrics, and distributed tracing.

## Three Pillars

### 1. Logs

Structured logging with context for debugging and auditing.

### 2. Metrics

Quantitative measurements for alerting and capacity planning.

### 3. Traces

Distributed request tracking across services.

## Unified Setup

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
    createLoggingMiddleware({
      logger: pino({ level: 'info' }),
    }),
    createTracingMiddleware({
      serviceName: 'saga-worker',
      exporter: jaegerExporter,
    }),
    createMetricsMiddleware({
      prefix: 'saga_bus',
    }),
  ],
});
```

## Logging Best Practices

### Structured Logging

```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: {
    service: 'saga-worker',
    version: process.env.APP_VERSION,
    environment: process.env.NODE_ENV,
  },
});

// In saga handlers
async function handleOrderSubmitted(ctx) {
  ctx.logger.info({
    event: 'order_submitted',
    orderId: ctx.message.orderId,
    customerId: ctx.message.customerId,
    total: ctx.message.total,
  });

  // ... handler logic
}
```

### Log Levels

| Level | Usage |
|-------|-------|
| `error` | Unrecoverable failures |
| `warn` | Recoverable issues, retries |
| `info` | Business events, state changes |
| `debug` | Detailed debugging info |
| `trace` | Very detailed tracing |

### Correlation IDs

```typescript
createLoggingMiddleware({
  logger,
  includeCorrelationId: true,
  correlationIdHeader: 'x-correlation-id',
});

// Logs include correlationId automatically
// {"level":"info","correlationId":"abc-123","message":"Processing order"}
```

## Metrics Configuration

### Prometheus Metrics

```typescript
import { createMetricsMiddleware } from '@saga-bus/middleware-metrics';
import { collectDefaultMetrics, Registry } from 'prom-client';

const registry = new Registry();
collectDefaultMetrics({ register: registry });

const metricsMiddleware = createMetricsMiddleware({
  prefix: 'saga_bus',
  registry,
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10],
});

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', registry.contentType);
  res.send(await registry.metrics());
});
```

### Key Metrics

#### Message Processing

```promql
# Messages processed per second
rate(saga_bus_messages_processed_total[5m])

# Average processing time
rate(saga_bus_message_duration_seconds_sum[5m]) /
rate(saga_bus_message_duration_seconds_count[5m])

# Error rate
rate(saga_bus_messages_failed_total[5m]) /
rate(saga_bus_messages_processed_total[5m])
```

#### Saga State

```promql
# Active sagas by status
saga_bus_sagas_active{status="pending"}

# Saga completion rate
rate(saga_bus_saga_completed_total[5m])

# Sagas in error state
saga_bus_sagas_active{status="failed"}
```

#### Infrastructure

```promql
# Database connection pool utilization
saga_bus_db_connections_active / saga_bus_db_connections_total

# Message queue depth
saga_bus_queue_depth

# Consumer lag (Kafka)
saga_bus_consumer_lag
```

### Custom Metrics

```typescript
import { Counter, Gauge } from 'prom-client';

const orderTotal = new Counter({
  name: 'orders_total',
  help: 'Total orders processed',
  labelNames: ['status'],
});

const orderValue = new Gauge({
  name: 'order_value_dollars',
  help: 'Order value in dollars',
  labelNames: ['customer_tier'],
});

// In handler
async function handleOrderSubmitted(ctx) {
  orderTotal.inc({ status: 'submitted' });
  orderValue.set({ customer_tier: ctx.message.tier }, ctx.message.total);
}
```

## Distributed Tracing

### OpenTelemetry Setup

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  serviceName: 'saga-worker',
  traceExporter: new JaegerExporter({
    endpoint: 'http://jaeger:14268/api/traces',
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
```

### Trace Context Propagation

```typescript
import { createTracingMiddleware } from '@saga-bus/middleware-tracing';

const tracingMiddleware = createTracingMiddleware({
  serviceName: 'saga-worker',
  propagateContext: true,
  contextExtractor: (message) => message.traceContext,
  contextInjector: (message, context) => ({
    ...message,
    traceContext: context,
  }),
});
```

### Manual Spans

```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('saga-worker');

async function handlePaymentCapture(ctx) {
  const span = tracer.startSpan('capture_payment', {
    attributes: {
      'order.id': ctx.message.orderId,
      'payment.amount': ctx.message.amount,
    },
  });

  try {
    const result = await paymentService.capture(ctx.message);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  } finally {
    span.end();
  }
}
```

## Grafana Dashboards

### Saga Overview Dashboard

```json
{
  "panels": [
    {
      "title": "Messages Processed",
      "type": "stat",
      "targets": [
        {
          "expr": "sum(rate(saga_bus_messages_processed_total[5m]))",
          "legendFormat": "msg/s"
        }
      ]
    },
    {
      "title": "Error Rate",
      "type": "gauge",
      "targets": [
        {
          "expr": "sum(rate(saga_bus_messages_failed_total[5m])) / sum(rate(saga_bus_messages_processed_total[5m])) * 100",
          "legendFormat": "Error %"
        }
      ],
      "thresholds": [
        { "value": 0, "color": "green" },
        { "value": 1, "color": "yellow" },
        { "value": 5, "color": "red" }
      ]
    },
    {
      "title": "Processing Latency",
      "type": "graph",
      "targets": [
        {
          "expr": "histogram_quantile(0.50, rate(saga_bus_message_duration_seconds_bucket[5m]))",
          "legendFormat": "p50"
        },
        {
          "expr": "histogram_quantile(0.95, rate(saga_bus_message_duration_seconds_bucket[5m]))",
          "legendFormat": "p95"
        },
        {
          "expr": "histogram_quantile(0.99, rate(saga_bus_message_duration_seconds_bucket[5m]))",
          "legendFormat": "p99"
        }
      ]
    }
  ]
}
```

### Alerting Rules

```yaml
groups:
  - name: saga-bus-alerts
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(saga_bus_messages_failed_total[5m])) /
          sum(rate(saga_bus_messages_processed_total[5m])) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Saga bus error rate above 5%"

      - alert: HighProcessingLatency
        expr: |
          histogram_quantile(0.95, rate(saga_bus_message_duration_seconds_bucket[5m])) > 5
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "95th percentile latency above 5 seconds"

      - alert: SagasStuck
        expr: |
          increase(saga_bus_saga_completed_total[1h]) == 0
          and saga_bus_sagas_active > 0
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "No sagas completing despite active sagas"
```

## Log Aggregation

### Fluentd Configuration

```xml
<source>
  @type tail
  path /var/log/saga-worker/*.log
  pos_file /var/log/fluentd/saga-worker.pos
  tag saga.worker
  <parse>
    @type json
    time_key timestamp
    time_format %Y-%m-%dT%H:%M:%S.%NZ
  </parse>
</source>

<filter saga.**>
  @type record_transformer
  <record>
    kubernetes_namespace ${ENV['K8S_NAMESPACE']}
    kubernetes_pod ${ENV['K8S_POD_NAME']}
  </record>
</filter>

<match saga.**>
  @type elasticsearch
  host elasticsearch
  port 9200
  index_name saga-logs
  <buffer>
    flush_interval 5s
  </buffer>
</match>
```

### Loki with Grafana

```yaml
# promtail config
scrape_configs:
  - job_name: saga-worker
    static_configs:
      - targets:
          - localhost
        labels:
          job: saga-worker
          __path__: /var/log/saga-worker/*.log
    pipeline_stages:
      - json:
          expressions:
            level: level
            correlationId: correlationId
            sagaName: sagaName
      - labels:
          level:
          sagaName:
```

## Error Tracking

### Sentry Integration

```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

const errorMiddleware = createMiddleware({
  name: 'sentry',
  onError: async ({ error, message, context }) => {
    Sentry.captureException(error, {
      extra: {
        messageType: message.type,
        correlationId: context.correlationId,
        sagaName: context.sagaName,
      },
    });
  },
});
```

## Best Practices

1. **Use structured logging** - JSON format for machine parsing
2. **Include correlation IDs** - Track requests across services
3. **Set appropriate log levels** - Avoid log spam in production
4. **Use metric histograms** - Capture latency distributions
5. **Alert on symptoms, not causes** - High error rate vs. database down
6. **Sample traces in production** - Full tracing is expensive
7. **Retain logs appropriately** - Balance cost vs. debugging needs

## See Also

- [Logging Middleware](/docs/middleware/logging)
- [Tracing Middleware](/docs/middleware/tracing)
- [Metrics Middleware](/docs/middleware/metrics)
