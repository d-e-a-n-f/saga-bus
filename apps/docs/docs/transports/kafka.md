---
sidebar_position: 4
title: Kafka
---

# Kafka Transport

High-throughput transport using Apache Kafka with consumer groups.

## Installation

```bash npm2yarn
npm install @saga-bus/transport-kafka kafkajs
```

## Basic Usage

```typescript
import { KafkaTransport } from '@saga-bus/transport-kafka';

const transport = new KafkaTransport({
  clientId: 'my-app',
  brokers: ['localhost:9092'],
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
| `clientId` | `string` | Required | Kafka client identifier |
| `brokers` | `string[]` | Required | Kafka broker addresses |
| `groupId` | `string` | `'saga-bus'` | Consumer group ID |
| `topicPrefix` | `string` | `'saga-bus'` | Prefix for topic names |
| `ssl` | `boolean \| object` | `false` | SSL/TLS configuration |
| `sasl` | `object` | - | SASL authentication |
| `connectionTimeout` | `number` | `10000` | Connection timeout (ms) |
| `requestTimeout` | `number` | `30000` | Request timeout (ms) |

## Full Configuration Example

```typescript
const transport = new KafkaTransport({
  clientId: 'order-service',
  brokers: [
    'kafka-1.example.com:9092',
    'kafka-2.example.com:9092',
    'kafka-3.example.com:9092',
  ],
  groupId: 'order-saga-consumers',
  topicPrefix: 'orders',

  // SSL configuration
  ssl: {
    rejectUnauthorized: true,
    ca: [fs.readFileSync('/path/to/ca.pem', 'utf-8')],
  },

  // SASL authentication
  sasl: {
    mechanism: 'scram-sha-256',
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
  },

  // Timeouts
  connectionTimeout: 10000,
  requestTimeout: 30000,
});
```

## Consumer Groups

Kafka uses consumer groups for parallel processing:

```typescript
// Multiple instances share the same group
const transport = new KafkaTransport({
  clientId: `order-service-${process.env.INSTANCE_ID}`,
  brokers: ['localhost:9092'],
  groupId: 'order-saga-group', // Same group = shared consumption
});
```

## Topic Naming

Topics are created automatically with the pattern:

```
{topicPrefix}.{sagaName}.{messageType}
```

For example:
- `orders.OrderSaga.OrderSubmitted`
- `orders.OrderSaga.PaymentCaptured`

## Partitioning

Messages are partitioned by correlation ID for ordering:

```typescript
// Messages with same orderId go to same partition
// Ensures in-order processing per saga instance
```

## Docker Setup

```yaml
# docker-compose.yml
services:
  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181

  kafka:
    image: confluentinc/cp-kafka:7.5.0
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
```

## AWS MSK

For Amazon MSK:

```typescript
const transport = new KafkaTransport({
  clientId: 'my-app',
  brokers: [
    'b-1.mycluster.kafka.us-east-1.amazonaws.com:9092',
    'b-2.mycluster.kafka.us-east-1.amazonaws.com:9092',
  ],
  ssl: true,
  sasl: {
    mechanism: 'aws',
    authorizationIdentity: process.env.AWS_ACCESS_KEY_ID,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
```

## Confluent Cloud

```typescript
const transport = new KafkaTransport({
  clientId: 'my-app',
  brokers: ['pkc-xxxxx.us-east-1.aws.confluent.cloud:9092'],
  ssl: true,
  sasl: {
    mechanism: 'plain',
    username: process.env.CONFLUENT_API_KEY,
    password: process.env.CONFLUENT_API_SECRET,
  },
});
```

## Best Practices

### Use Meaningful Client IDs

```typescript
// Include service name and instance
clientId: `${serviceName}-${hostname}-${pid}`
```

### Configure Appropriate Timeouts

```typescript
// For high-latency networks
connectionTimeout: 30000,
requestTimeout: 60000,
```

### Monitor Consumer Lag

Use Kafka tools to monitor consumer group lag:

```bash
kafka-consumer-groups.sh --bootstrap-server localhost:9092 \
  --group order-saga-group --describe
```

## Error Handling

Failed messages are sent to a dead letter topic:

```
{topicPrefix}.{sagaName}.dlq
```

## See Also

- [Transports Overview](/docs/transports/overview)
- [Error Handling](/docs/core-concepts/error-handling)
- [Scaling](/docs/production/scaling)
