---
sidebar_position: 4
title: Scaling
---

# Scaling

Scale saga-bus applications horizontally and vertically for high throughput.

## Horizontal Scaling

### Running Multiple Workers

Deploy multiple worker instances to process messages in parallel:

```typescript
// Each worker instance processes messages independently
const bus = createBus({
  transport,
  store,
  sagas: [{ definition: orderSaga }],
  concurrency: 10, // Messages per worker
});

await bus.start();
```

### Kubernetes Scaling

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: saga-worker
spec:
  replicas: 5  # Start with 5 workers
  selector:
    matchLabels:
      app: saga-worker
  template:
    spec:
      containers:
        - name: worker
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
```

### Horizontal Pod Autoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: saga-worker-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: saga-worker
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: External
      external:
        metric:
          name: rabbitmq_queue_messages_ready
          selector:
            matchLabels:
              queue: saga-messages
        target:
          type: AverageValue
          averageValue: "100"
```

## Message Partitioning

### By Correlation ID

Ensure messages for the same saga go to the same worker:

```typescript
// Kafka transport with partitioning
const transport = new KafkaTransport({
  clientId: 'saga-bus',
  brokers: ['kafka:9092'],
  partitioner: (message) => {
    // Partition by correlation ID for ordering guarantees
    return hashCode(message.correlationId) % partitionCount;
  },
});
```

### By Saga Type

Route different sagas to specialized workers:

```typescript
// Worker 1: Order sagas only
const orderBus = createBus({
  transport,
  store,
  sagas: [{ definition: orderSaga }],
  subscriptions: ['order.*'],
});

// Worker 2: Payment sagas only
const paymentBus = createBus({
  transport,
  store,
  sagas: [{ definition: paymentSaga }],
  subscriptions: ['payment.*'],
});
```

### Kafka Partitioning Strategy

```typescript
import { Partitioners } from 'kafkajs';

const transport = new KafkaTransport({
  brokers: ['kafka:9092'],
  producer: {
    createPartitioner: Partitioners.DefaultPartitioner,
  },
  consumer: {
    groupId: 'saga-workers',
    // Each partition handled by one consumer
  },
});

// Publish with partition key
await bus.publish({
  type: 'OrderSubmitted',
  orderId: '123',
}, {
  partitionKey: 'order-123', // Route to consistent partition
});
```

## Consumer Groups

### RabbitMQ

```typescript
const transport = new RabbitMQTransport({
  url: 'amqp://localhost',
  queue: 'saga-messages',
  prefetch: 10, // Process 10 messages concurrently
  // All workers share the same queue
});
```

### Kafka

```typescript
const transport = new KafkaTransport({
  brokers: ['kafka:9092'],
  consumer: {
    groupId: 'saga-workers', // All workers in same group
    maxBytesPerPartition: 1048576,
    sessionTimeout: 30000,
  },
});
```

### AWS SQS

```typescript
const transport = new SQSTransport({
  queueUrl: process.env.SQS_QUEUE_URL,
  maxNumberOfMessages: 10,
  visibilityTimeout: 60,
  waitTimeSeconds: 20,
});
```

## Concurrency Control

### Per-Worker Concurrency

```typescript
const bus = createBus({
  transport,
  store,
  sagas: [{ definition: orderSaga }],
  concurrency: 20, // Process 20 messages in parallel
});
```

### Saga-Level Concurrency

```typescript
const orderSaga = defineSaga({
  name: 'OrderSaga',
  concurrency: 5, // Max 5 concurrent order sagas
  // ...
});
```

### Global Rate Limiting

```typescript
import { RateLimiter } from '@saga-bus/middleware-ratelimit';

const rateLimiter = new RateLimiter({
  maxRequests: 1000,
  windowMs: 1000, // 1000 req/sec
  store: redisStore, // Distributed rate limiting
});

const bus = createBus({
  middleware: [rateLimiter.middleware()],
});
```

## Database Scaling

### Connection Pooling

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Max connections per worker
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const store = new PostgresSagaStore({ pool });
```

### Read Replicas

```typescript
const writePool = new Pool({
  connectionString: process.env.PRIMARY_DATABASE_URL,
  max: 10,
});

const readPool = new Pool({
  connectionString: process.env.REPLICA_DATABASE_URL,
  max: 20,
});

const store = new PostgresSagaStore({
  writePool,
  readPool,
});
```

### Sharding

```typescript
// Shard by saga correlation ID
function getShardPool(correlationId: string): Pool {
  const shardIndex = hashCode(correlationId) % SHARD_COUNT;
  return shardPools[shardIndex];
}

class ShardedSagaStore implements SagaStore {
  async getByCorrelationId(sagaName: string, correlationId: string) {
    const pool = getShardPool(correlationId);
    // Query appropriate shard
  }
}
```

## Queue Scaling

### RabbitMQ

```typescript
// Quorum queues for high availability
const transport = new RabbitMQTransport({
  url: 'amqp://localhost',
  queue: 'saga-messages',
  queueOptions: {
    durable: true,
    arguments: {
      'x-queue-type': 'quorum',
      'x-quorum-initial-group-size': 3,
    },
  },
});
```

### Kafka

```bash
# Increase partitions for parallelism
kafka-topics.sh --alter \
  --topic saga-messages \
  --partitions 12 \
  --bootstrap-server kafka:9092
```

### SQS

```typescript
// FIFO queue for ordering, Standard for scale
const transport = new SQSTransport({
  queueUrl: process.env.SQS_QUEUE_URL,
  // Standard queues: nearly unlimited throughput
  // FIFO queues: 300 msg/s (3000 with batching)
});
```

## Load Balancing

### Round-Robin Worker Selection

```typescript
// Kubernetes service automatically load balances
apiVersion: v1
kind: Service
metadata:
  name: saga-worker
spec:
  selector:
    app: saga-worker
  ports:
    - port: 80
      targetPort: 3000
  sessionAffinity: None  # Round-robin
```

### Sticky Sessions (When Needed)

```yaml
spec:
  sessionAffinity: ClientIP
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 300
```

## Performance Tuning

### Batch Processing

```typescript
const transport = new KafkaTransport({
  consumer: {
    maxWaitTimeInMs: 100, // Wait for batch
    minBytes: 1,
    maxBytes: 10485760, // 10MB batch
  },
});

const bus = createBus({
  batchSize: 100, // Process 100 messages per batch
  batchTimeout: 1000, // Or after 1 second
});
```

### Message Compression

```typescript
const transport = new KafkaTransport({
  producer: {
    compression: CompressionTypes.GZIP,
  },
});
```

### Connection Pooling

```typescript
// Reuse connections across requests
const transport = new RabbitMQTransport({
  url: 'amqp://localhost',
  connectionPoolSize: 5,
});
```

## Monitoring Scale

### Key Metrics

```promql
# Messages processed per worker
rate(saga_bus_messages_processed_total[5m])

# Queue depth (backlog)
saga_bus_queue_depth

# Consumer lag (Kafka)
kafka_consumer_group_lag

# Worker utilization
rate(saga_bus_message_duration_seconds_sum[5m]) /
rate(saga_bus_message_duration_seconds_count[5m])
```

### Scaling Alerts

```yaml
groups:
  - name: scaling-alerts
    rules:
      - alert: HighQueueDepth
        expr: saga_bus_queue_depth > 10000
        for: 5m
        annotations:
          summary: "Queue depth high, consider scaling up"

      - alert: HighConsumerLag
        expr: kafka_consumer_group_lag > 100000
        for: 10m
        annotations:
          summary: "Consumer lag increasing, add more workers"
```

## Auto-Scaling Strategies

### CPU-Based

```yaml
metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### Queue-Depth Based

```yaml
metrics:
  - type: External
    external:
      metric:
        name: rabbitmq_queue_messages
      target:
        type: AverageValue
        averageValue: "50"
```

### Custom Metrics

```yaml
metrics:
  - type: Pods
    pods:
      metric:
        name: saga_bus_processing_rate
      target:
        type: AverageValue
        averageValue: "100"
```

## See Also

- [Deployment](/docs/production/deployment)
- [Observability](/docs/production/observability)
- [Error Recovery](/docs/production/error-recovery)
