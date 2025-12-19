---
sidebar_position: 8
title: Redis
---

# Redis Store

High-performance store using Redis with TTL support.

## Installation

```bash npm2yarn
npm install @saga-bus/store-redis ioredis
```

## Basic Usage

```typescript
import { RedisSagaStore } from '@saga-bus/store-redis';

const store = new RedisSagaStore({
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
| `url` | `string` | - | Redis connection URL |
| `host` | `string` | `'localhost'` | Redis host |
| `port` | `number` | `6379` | Redis port |
| `password` | `string` | - | Redis password |
| `db` | `number` | `0` | Database number |
| `keyPrefix` | `string` | `'saga:'` | Key prefix |
| `ttl` | `number` | - | TTL in seconds |
| `client` | `Redis` | - | Existing ioredis client |

## Full Configuration Example

```typescript
import { RedisSagaStore } from '@saga-bus/store-redis';
import Redis from 'ioredis';

// Option 1: URL
const store = new RedisSagaStore({
  url: 'redis://:password@localhost:6379/0',
});

// Option 2: Individual settings
const store = new RedisSagaStore({
  host: 'localhost',
  port: 6379,
  password: process.env.REDIS_PASSWORD,
  db: 0,
  keyPrefix: 'myapp:saga:',
  ttl: 86400 * 30, // 30 days
});

// Option 3: Existing client
const redis = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

const store = new RedisSagaStore({
  client: redis,
  keyPrefix: 'saga:',
});

// Option 4: TLS
const store = new RedisSagaStore({
  host: 'redis.example.com',
  port: 6380,
  tls: {
    rejectUnauthorized: true,
  },
});
```

## Key Structure

```
{keyPrefix}{sagaName}:{sagaId}           -> Saga state (Hash)
{keyPrefix}{sagaName}:correlation:{id}   -> Saga ID lookup (String)
{keyPrefix}{sagaName}:index:completed    -> Completed sagas (Set)
```

Example keys:
- `saga:OrderSaga:abc-123` - Saga state
- `saga:OrderSaga:correlation:order-456` - Correlation lookup
- `saga:OrderSaga:index:completed` - Completed index

## Redis Cluster

For cluster deployments:

```typescript
import Redis from 'ioredis';

const cluster = new Redis.Cluster([
  { host: 'node1', port: 6379 },
  { host: 'node2', port: 6379 },
  { host: 'node3', port: 6379 },
]);

const store = new RedisSagaStore({
  client: cluster,
  keyPrefix: 'saga:',
});
```

## Redis Sentinel

For high availability:

```typescript
import Redis from 'ioredis';

const redis = new Redis({
  sentinels: [
    { host: 'sentinel1', port: 26379 },
    { host: 'sentinel2', port: 26379 },
    { host: 'sentinel3', port: 26379 },
  ],
  name: 'mymaster',
});

const store = new RedisSagaStore({
  client: redis,
  keyPrefix: 'saga:',
});
```

## TTL Configuration

Auto-expire saga data:

```typescript
// All sagas expire after 30 days
const store = new RedisSagaStore({
  url: 'redis://localhost:6379',
  ttl: 86400 * 30, // 30 days in seconds
});

// Different TTL for completed sagas
const store = new RedisSagaStore({
  url: 'redis://localhost:6379',
  ttl: 86400 * 90,           // Active: 90 days
  completedTtl: 86400 * 7,   // Completed: 7 days
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

## Optimistic Concurrency

Uses WATCH/MULTI/EXEC for atomic updates:

```typescript
// Built-in optimistic locking via Redis transactions
// Retries automatically on WATCH failure
```

## Best Practices

### Use Appropriate TTL

```typescript
// Balance between data retention and memory usage
const store = new RedisSagaStore({
  url: 'redis://localhost:6379',
  ttl: 86400 * 30, // 30 days reasonable default
});
```

### Enable Persistence

```bash
# redis.conf
appendonly yes
appendfsync everysec
```

### Configure Max Memory

```bash
# redis.conf
maxmemory 1gb
maxmemory-policy volatile-lru
```

### Use Key Prefixes

```typescript
// Namespace your keys
const store = new RedisSagaStore({
  url: 'redis://localhost:6379',
  keyPrefix: 'myapp:prod:saga:',
});
```

## Monitoring

```bash
# Check memory usage
redis-cli INFO memory

# Find saga keys
redis-cli KEYS "saga:*"

# Monitor commands
redis-cli MONITOR
```

## See Also

- [Stores Overview](/docs/stores/overview)
- [Redis Transport](/docs/transports/redis)
- [Scaling](/docs/production/scaling)
