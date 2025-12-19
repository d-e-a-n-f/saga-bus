---
sidebar_position: 1
---

# Transports Overview

Transports handle message delivery between services.

## Choosing a Transport

| Transport | Best For | Features |
|-----------|----------|----------|
| [RabbitMQ](/docs/transports/rabbitmq) | General purpose | Topic routing, DLQ, clustering |
| [Kafka](/docs/transports/kafka) | High throughput | Partitioning, replay, ordering |
| [SQS](/docs/transports/sqs) | AWS native | FIFO queues, serverless |
| [Azure Service Bus](/docs/transports/azure-servicebus) | Azure native | Sessions, scheduling |
| [GCP Pub/Sub](/docs/transports/gcp-pubsub) | GCP native | Global, serverless |
| [Redis](/docs/transports/redis) | Low latency | Streams, consumer groups |
| [NATS](/docs/transports/nats) | Cloud native | JetStream, lightweight |
| [In-Memory](/docs/transports/inmemory) | Testing | No external deps |

## Transport Interface

All transports implement:

```typescript
interface Transport {
  start(): Promise<void>;
  stop(): Promise<void>;
  subscribe<T>(options: TransportSubscribeOptions, handler: Handler<T>): Promise<void>;
  publish<T>(message: T, options: TransportPublishOptions): Promise<void>;
}
```

## Basic Usage

```typescript
import { createBus } from '@saga-bus/core';
import { RabbitMqTransport } from '@saga-bus/transport-rabbitmq';

const transport = new RabbitMqTransport({
  url: 'amqp://localhost:5672',
});

const bus = createBus({
  transport,
  store,
  sagas: [{ definition: orderSaga }],
});

await bus.start();
```

## Configuration Patterns

### Environment-Based

```typescript
function createTransport() {
  if (process.env.NODE_ENV === 'test') {
    return new InMemoryTransport();
  }
  return new RabbitMqTransport({
    url: process.env.RABBITMQ_URL!,
  });
}
```
