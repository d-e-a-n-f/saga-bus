---
sidebar_position: 3
title: Monitoring
---

# Monitoring

Set up monitoring for your saga-based applications.

## Key Metrics

Monitor these essential metrics for saga health:

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `saga_messages_processed_total` | Total messages processed | N/A (use rate) |
| `saga_message_processing_duration_seconds` | Handler execution time | p99 > 5s |
| `saga_messages_failed_total` | Failed message count | > 0/min |
| `saga_active_instances` | Currently running sagas | Depends on load |
| `saga_dlq_messages_total` | Dead letter queue size | > 0 |

## Prometheus Setup

```typescript
import { createMetricsMiddleware } from '@saga-bus/middleware-metrics';

const bus = createBus({
  transport,
  store,
  sagas,
  middleware: [
    createMetricsMiddleware({
      prefix: 'saga_bus',
      labels: ['saga_name', 'message_type'],
    }),
  ],
});
```

## Grafana Dashboard

Key panels to include:

1. **Message Throughput** - Messages processed per second
2. **Processing Latency** - p50, p95, p99 duration histograms
3. **Error Rate** - Failed messages over time
4. **Active Sagas** - Current saga instance count
5. **DLQ Depth** - Dead letter queue size

## Alerting Rules

```yaml
groups:
  - name: saga-bus
    rules:
      - alert: HighErrorRate
        expr: rate(saga_messages_failed_total[5m]) > 0.01
        for: 5m
        labels:
          severity: warning

      - alert: SlowProcessing
        expr: histogram_quantile(0.99, saga_message_processing_duration_seconds) > 5
        for: 10m
        labels:
          severity: warning

      - alert: DLQNotEmpty
        expr: saga_dlq_messages_total > 0
        for: 1m
        labels:
          severity: critical
```

## See Also

- [Metrics Middleware](/docs/middleware/metrics)
- [Tracing Middleware](/docs/middleware/tracing)
- [Observability](/docs/production/observability)
