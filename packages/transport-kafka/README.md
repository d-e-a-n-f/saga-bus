# @saga-bus/transport-kafka

Apache Kafka transport for saga-bus using KafkaJS.

## Installation

```bash
pnpm add @saga-bus/transport-kafka kafkajs
```

## Usage

```typescript
import { Kafka } from "kafkajs";
import { KafkaTransport } from "@saga-bus/transport-kafka";
import { createBus } from "@saga-bus/core";

const kafka = new Kafka({
  clientId: "my-app",
  brokers: ["localhost:9092"],
});

const transport = new KafkaTransport({
  kafka,
  groupId: "my-consumer-group",
  defaultTopic: "saga-events",
});

const bus = createBus({
  transport,
  sagas: [...],
});

await bus.start();
```

## Features

- Topic-based message routing
- Consumer group coordination
- Automatic topic creation (optional)
- Configurable partitions and replication
- Message key routing via correlation ID
- Offset management

## Message Format

Messages are published with:

| Field | Value |
|-------|-------|
| `key` | Correlation ID (for partition affinity) |
| `value` | JSON-serialized message envelope |
| `headers.type` | Message type |
| `headers.correlationId` | Correlation ID |
| `headers.messageId` | Unique message ID |

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `kafka` | `Kafka` | required | KafkaJS instance |
| `defaultTopic` | `string` | - | Default topic |
| `groupId` | `string` | - | Consumer group ID |
| `createTopics` | `boolean` | `false` | Auto-create topics |
| `numPartitions` | `number` | `3` | Partitions for new topics |
| `replicationFactor` | `number` | `1` | Replication factor |
| `fromBeginning` | `boolean` | `false` | Start from earliest |
| `sessionTimeout` | `number` | `30000` | Session timeout (ms) |
| `heartbeatInterval` | `number` | `3000` | Heartbeat interval (ms) |

## Topic Routing

Override the default topic per-publish:

```typescript
await bus.publish(
  { type: "OrderCreated", payload: { orderId: "123" } },
  { endpoint: "orders-topic" }
);
```

## Partition Affinity

Messages with the same correlation ID are routed to the same partition, ensuring ordered processing per saga instance.

## License

MIT
