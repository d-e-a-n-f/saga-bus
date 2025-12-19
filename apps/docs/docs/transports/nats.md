---
sidebar_position: 9
title: NATS JetStream
---

# NATS JetStream Transport

Cloud-native transport using NATS JetStream for persistent messaging.

## Installation

```bash npm2yarn
npm install @saga-bus/transport-nats nats
```

## Basic Usage

```typescript
import { NatsTransport } from '@saga-bus/transport-nats';

const transport = new NatsTransport({
  servers: ['localhost:4222'],
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
| `servers` | `string[]` | Required | NATS server addresses |
| `user` | `string` | - | Username for auth |
| `pass` | `string` | - | Password for auth |
| `token` | `string` | - | Token for auth |
| `nkey` | `string` | - | NKey seed for auth |
| `streamPrefix` | `string` | `'saga-bus'` | Prefix for stream names |
| `consumerPrefix` | `string` | `'saga-bus'` | Prefix for consumers |
| `ackWait` | `number` | `30000` | Ack wait time (ms) |
| `maxDeliver` | `number` | `3` | Max delivery attempts |

## Full Configuration Example

```typescript
import { NatsTransport } from '@saga-bus/transport-nats';

const transport = new NatsTransport({
  // Connection
  servers: [
    'nats://nats-1.example.com:4222',
    'nats://nats-2.example.com:4222',
    'nats://nats-3.example.com:4222',
  ],

  // Authentication
  user: process.env.NATS_USER,
  pass: process.env.NATS_PASSWORD,

  // Or token auth
  token: process.env.NATS_TOKEN,

  // TLS
  tls: {
    caFile: '/path/to/ca.pem',
    certFile: '/path/to/cert.pem',
    keyFile: '/path/to/key.pem',
  },

  // JetStream settings
  streamPrefix: 'orders',
  consumerPrefix: 'order-service',

  // Delivery settings
  ackWait: 30000,
  maxDeliver: 5,
});
```

## Stream Naming

JetStream streams and consumers are created automatically:

```
Streams:
  {streamPrefix}_{SagaName}

Subjects:
  {streamPrefix}.{SagaName}.{MessageType}

Consumers:
  {consumerPrefix}_{SagaName}
```

For example:
- Stream: `orders_OrderSaga`
- Subject: `orders.OrderSaga.OrderSubmitted`
- Consumer: `order-service_OrderSaga`

## JetStream Features

### Persistence

Messages are persisted to disk:

```typescript
const transport = new NatsTransport({
  servers: ['localhost:4222'],
  storage: 'file', // 'file' or 'memory'
  replicas: 3,     // Number of replicas
});
```

### Message Replay

Replay messages from a specific point:

```typescript
// Built-in support for:
// - Replay by sequence number
// - Replay by time
// - Replay all messages
```

### Exactly-Once Delivery

Enable exactly-once semantics:

```typescript
const transport = new NatsTransport({
  servers: ['localhost:4222'],
  deliverPolicy: 'exactly_once',
});
```

## Authentication Methods

### Username/Password

```typescript
const transport = new NatsTransport({
  servers: ['localhost:4222'],
  user: 'myuser',
  pass: 'mypassword',
});
```

### Token

```typescript
const transport = new NatsTransport({
  servers: ['localhost:4222'],
  token: process.env.NATS_TOKEN,
});
```

### NKey

```typescript
import { fromSeed } from 'nats';

const transport = new NatsTransport({
  servers: ['localhost:4222'],
  authenticator: nkeyAuthenticator(
    new TextEncoder().encode(process.env.NATS_NKEY_SEED)
  ),
});
```

### JWT/Creds File

```typescript
const transport = new NatsTransport({
  servers: ['localhost:4222'],
  credsFile: '/path/to/user.creds',
});
```

## Docker Setup

```yaml
# docker-compose.yml
services:
  nats:
    image: nats:latest
    ports:
      - "4222:4222"
      - "8222:8222"  # Monitoring
    command:
      - "--jetstream"
      - "--store_dir=/data"
    volumes:
      - nats_data:/data

volumes:
  nats_data:
```

## NATS Cluster

For clustered deployments:

```yaml
# docker-compose.yml
services:
  nats-1:
    image: nats:latest
    command:
      - "--cluster_name=saga-cluster"
      - "--cluster=nats://0.0.0.0:6222"
      - "--routes=nats://nats-2:6222,nats://nats-3:6222"
      - "--jetstream"

  nats-2:
    image: nats:latest
    command:
      - "--cluster_name=saga-cluster"
      - "--cluster=nats://0.0.0.0:6222"
      - "--routes=nats://nats-1:6222,nats://nats-3:6222"
      - "--jetstream"

  nats-3:
    image: nats:latest
    command:
      - "--cluster_name=saga-cluster"
      - "--cluster=nats://0.0.0.0:6222"
      - "--routes=nats://nats-1:6222,nats://nats-2:6222"
      - "--jetstream"
```

## Message Acknowledgment

Configure acknowledgment behavior:

```typescript
const transport = new NatsTransport({
  servers: ['localhost:4222'],

  // Wait time before redelivery
  ackWait: 30000, // 30 seconds

  // Ack policy
  ackPolicy: 'explicit', // 'none', 'all', 'explicit'
});
```

## Dead Letter Queue

Handle failed messages:

```typescript
const transport = new NatsTransport({
  servers: ['localhost:4222'],
  maxDeliver: 3, // Move to DLQ after 3 attempts
});

// Failed messages go to:
// {streamPrefix}.dlq
```

## Best Practices

### Use Multiple Servers

```typescript
// Connect to multiple servers for HA
const transport = new NatsTransport({
  servers: [
    'nats://nats-1:4222',
    'nats://nats-2:4222',
    'nats://nats-3:4222',
  ],
});
```

### Configure Appropriate Replicas

```typescript
// For production, use 3+ replicas
const transport = new NatsTransport({
  servers: ['localhost:4222'],
  replicas: 3,
});
```

### Monitor with NATS CLI

```bash
# Check stream info
nats stream info orders_OrderSaga

# Check consumer info
nats consumer info orders_OrderSaga order-service_OrderSaga

# View pending messages
nats consumer next orders_OrderSaga order-service_OrderSaga --count 10
```

## Performance Tuning

```typescript
const transport = new NatsTransport({
  servers: ['localhost:4222'],

  // Batch fetching
  maxMessages: 100,
  maxBytes: 1024 * 1024, // 1MB

  // Connection settings
  maxReconnectAttempts: -1, // Infinite
  reconnectTimeWait: 2000,
});
```

## Leafnodes

For edge deployments:

```typescript
// Connect to leafnode
const transport = new NatsTransport({
  servers: ['nats://leafnode:4222'],
});
```

## See Also

- [Transports Overview](/docs/transports/overview)
- [Error Handling](/docs/core-concepts/error-handling)
- [Deployment](/docs/production/deployment)
