# @saga-bus/transport-rabbitmq

RabbitMQ transport for production saga-bus deployments.

## Installation

```bash
pnpm add @saga-bus/transport-rabbitmq amqplib
```

## Usage

```typescript
import { RabbitMqTransport } from "@saga-bus/transport-rabbitmq";
import { createBus } from "@saga-bus/core";

const transport = new RabbitMqTransport({
  uri: "amqp://guest:guest@localhost:5672",
  exchange: "saga-bus",
  exchangeType: "topic",
  durable: true,
});

const bus = createBus({
  transport,
  sagas: [...],
});

await bus.start();
```

## Features

- Automatic reconnection with exponential backoff
- Topic exchange routing
- Prefetch-based concurrency control
- Durable queues and messages by default
- Queue prefix for multi-tenant setups

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `uri` | `string` | required | AMQP connection URL |
| `exchange` | `string` | required | Exchange name |
| `exchangeType` | `string` | `"topic"` | Exchange type |
| `durable` | `boolean` | `true` | Durable exchanges/queues |
| `queuePrefix` | `string` | `""` | Queue name prefix |
| `reconnect.maxAttempts` | `number` | `10` | Max reconnect attempts |
| `reconnect.initialDelayMs` | `number` | `1000` | Initial retry delay |
| `reconnect.maxDelayMs` | `number` | `30000` | Max retry delay |

## License

MIT
