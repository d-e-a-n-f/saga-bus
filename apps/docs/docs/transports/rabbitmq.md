---
sidebar_position: 3
---

# RabbitMQ Transport

Production-ready transport using RabbitMQ.

## Installation

```bash npm2yarn
npm install @saga-bus/transport-rabbitmq
```

## Basic Usage

```typescript
import { RabbitMqTransport } from '@saga-bus/transport-rabbitmq';

const transport = new RabbitMqTransport({
  url: 'amqp://localhost:5672',
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | `string` | Required | AMQP connection URL |
| `exchange` | `string` | `'saga-bus'` | Exchange name |
| `exchangeType` | `string` | `'topic'` | Exchange type |
| `queuePrefix` | `string` | `'saga-bus'` | Queue name prefix |
| `prefetch` | `number` | `10` | Prefetch count |
| `heartbeat` | `number` | `60` | Heartbeat interval (seconds) |

## Full Example

```typescript
const transport = new RabbitMqTransport({
  url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  exchange: 'my-app',
  exchangeType: 'topic',
  queuePrefix: 'my-app',
  prefetch: 20,
  heartbeat: 30,
});

const bus = createBus({
  transport,
  store,
  sagas: [{ definition: orderSaga }],
});

await bus.start();
```

## Docker Setup

```yaml
# docker-compose.yml
services:
  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      RABBITMQ_DEFAULT_USER: guest
      RABBITMQ_DEFAULT_PASS: guest
```

## Connection Management

The transport handles reconnection automatically:

```typescript
// Built-in exponential backoff
// Automatic queue/exchange recreation
```

## Dead Letter Queue

Failed messages go to DLQ automatically:

```
my-app.OrderSaga.dlq
```
