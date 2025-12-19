---
sidebar_position: 8
title: Redis Streams
---

# Redis Streams Transport

Low-latency transport using Redis Streams with consumer groups.

## Installation

```bash npm2yarn
npm install @saga-bus/transport-redis ioredis
```

## Basic Usage

```typescript
import { RedisTransport } from '@saga-bus/transport-redis';

const transport = new RedisTransport({
  url: 'redis://localhost:6379',
});

const bus = createBus({
  transport,
  store,
  sagas: [{ definition: orderSaga }],
});

await bus.start();
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | `string` | Required | Redis connection URL |
| `host` | `string` | `'localhost'` | Redis host (alternative to URL) |
| `port` | `number` | `6379` | Redis port |
| `password` | `string` | - | Redis password |
| `db` | `number` | `0` | Database number |
| `streamPrefix` | `string` | `'saga-bus'` | Prefix for stream names |
| `consumerGroup` | `string` | `'saga-bus'` | Consumer group name |
| `blockTimeout` | `number` | `5000` | Block timeout for reads (ms) |
| `batchSize` | `number` | `10` | Messages per read |

## Full Configuration Example

```typescript
import { RedisTransport } from '@saga-bus/transport-redis';

const transport = new RedisTransport({
  // Connection
  url: 'redis://:password@redis-host:6379/0',

  // Or individual settings
  host: 'redis-host',
  port: 6379,
  password: process.env.REDIS_PASSWORD,
  db: 0,

  // TLS
  tls: {
    rejectUnauthorized: true,
  },

  // Streams settings
  streamPrefix: 'orders',
  consumerGroup: 'order-service',

  // Processing
  blockTimeout: 5000,
  batchSize: 10,
});
```

## Stream Naming

Streams are created automatically:

```
{streamPrefix}:{SagaName}:{MessageType}
```

For example:
- `orders:OrderSaga:OrderSubmitted`
- `orders:OrderSaga:PaymentCaptured`

## Consumer Groups

Messages are distributed across consumers using Redis consumer groups:

```typescript
// Multiple instances share the same consumer group
const transport = new RedisTransport({
  url: 'redis://localhost:6379',
  consumerGroup: 'order-service', // Same group = shared consumption
  consumerName: `consumer-${process.env.INSTANCE_ID}`,
});
```

## Message Acknowledgment

Messages are acknowledged after successful processing:

```typescript
// Automatic acknowledgment on success
// Manual acknowledgment available for complex scenarios

// XACK is called automatically after handler completes
```

## Pending Messages

Handle pending (unacknowledged) messages:

```typescript
const transport = new RedisTransport({
  url: 'redis://localhost:6379',

  // Claim pending messages after timeout
  claimTimeout: 30000, // 30 seconds

  // Process pending on startup
  processPendingOnStart: true,
});
```

## Redis Cluster

For Redis Cluster deployments:

```typescript
import { RedisTransport } from '@saga-bus/transport-redis';
import Redis from 'ioredis';

const cluster = new Redis.Cluster([
  { host: 'node1', port: 6379 },
  { host: 'node2', port: 6379 },
  { host: 'node3', port: 6379 },
]);

const transport = new RedisTransport({
  client: cluster,
  streamPrefix: 'orders',
});
```

## Redis Sentinel

For high availability with Sentinel:

```typescript
import Redis from 'ioredis';

const client = new Redis({
  sentinels: [
    { host: 'sentinel1', port: 26379 },
    { host: 'sentinel2', port: 26379 },
    { host: 'sentinel3', port: 26379 },
  ],
  name: 'mymaster',
});

const transport = new RedisTransport({
  client,
  streamPrefix: 'orders',
});
```

## Docker Setup

```yaml
# docker-compose.yml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

## Stream Trimming

Configure automatic stream trimming:

```typescript
const transport = new RedisTransport({
  url: 'redis://localhost:6379',

  // Trim strategy
  trimStrategy: 'MAXLEN',
  trimThreshold: 10000, // Keep last 10k messages

  // Or approximate trimming (faster)
  trimApproximate: true,
});
```

## Best Practices

### Use Appropriate Block Timeout

```typescript
// Balance between latency and CPU usage
const transport = new RedisTransport({
  url: 'redis://localhost:6379',
  blockTimeout: 5000, // 5 seconds is a good default
});
```

### Configure Consumer Names

```typescript
// Unique consumer names for tracking
const transport = new RedisTransport({
  url: 'redis://localhost:6379',
  consumerName: `${hostname}-${pid}`,
});
```

### Monitor Stream Length

```bash
# Check stream length
redis-cli XLEN saga-bus:OrderSaga:OrderSubmitted

# Check pending messages
redis-cli XPENDING saga-bus:OrderSaga:OrderSubmitted order-service
```

## Error Handling

Failed messages remain in pending:

```typescript
// Messages are automatically retried
// After max retries, moved to dead letter stream

const transport = new RedisTransport({
  url: 'redis://localhost:6379',
  maxRetries: 3,
  deadLetterStream: 'saga-bus:dlq',
});
```

## Performance Tuning

```typescript
const transport = new RedisTransport({
  url: 'redis://localhost:6379',

  // Batch processing for throughput
  batchSize: 100,

  // Pipeline commands
  enablePipelining: true,

  // Connection pool
  maxConnections: 10,
});
```

## See Also

- [Transports Overview](/docs/transports/overview)
- [Redis Store](/docs/stores/redis)
- [Scaling](/docs/production/scaling)
