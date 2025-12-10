# @saga-bus/transport-nats

NATS JetStream transport for saga-bus.

## Installation

```bash
npm install @saga-bus/transport-nats nats
# or
pnpm add @saga-bus/transport-nats nats
```

## Features

- **JetStream**: Persistent message storage with replay capability
- **Durable Consumers**: Reliable delivery with acknowledgment tracking
- **Work Queues**: Competing consumer pattern for load distribution
- **Low Latency**: High-performance messaging
- **Horizontal Scaling**: Native clustering support

## Quick Start

```typescript
import { createBus } from "@saga-bus/core";
import { NatsTransport } from "@saga-bus/transport-nats";

const transport = new NatsTransport({
  connectionOptions: { servers: "localhost:4222" },
  streamName: "SAGA_EVENTS",
});

const bus = createBus({
  transport,
  // ... other config
});

await bus.start();
```

## Configuration

```typescript
interface NatsTransportOptions {
  /** Existing NATS connection */
  connection?: NatsConnection;

  /** Connection options for creating new connection */
  connectionOptions?: ConnectionOptions;

  /** JetStream options */
  jetStreamOptions?: JetStreamOptions;

  /** Subject prefix for all messages (default: "saga-bus") */
  subjectPrefix?: string;

  /** Stream name for JetStream (default: "SAGA_BUS") */
  streamName?: string;

  /** Consumer name prefix (default: "saga-bus-consumer") */
  consumerPrefix?: string;

  /** Whether to auto-create streams (default: true) */
  autoCreateStream?: boolean;

  /** Stream retention policy (default: "workqueue") */
  retentionPolicy?: "limits" | "interest" | "workqueue";

  /** Max messages in stream (-1 for unlimited) */
  maxMessages?: number;

  /** Max bytes in stream (-1 for unlimited) */
  maxBytes?: number;

  /** Max age of messages in nanoseconds */
  maxAge?: number;

  /** Number of replicas (default: 1) */
  replicas?: number;

  /** Ack wait timeout in nanoseconds (default: 30s) */
  ackWait?: number;

  /** Max redelivery attempts (default: 5) */
  maxDeliver?: number;
}
```

## Examples

### Basic Usage

```typescript
import { NatsTransport } from "@saga-bus/transport-nats";

const transport = new NatsTransport({
  connectionOptions: { servers: "localhost:4222" },
});

await transport.start();

// Publish a message
await transport.publish(
  { type: "OrderCreated", orderId: "123" },
  { endpoint: "orders" }
);

// Subscribe to messages
await transport.subscribe(
  { endpoint: "orders", group: "order-processor" },
  async (envelope) => {
    console.log("Received:", envelope.payload);
  }
);
```

### With Existing Connection

```typescript
import { connect } from "nats";

const nc = await connect({
  servers: ["nats://server1:4222", "nats://server2:4222"],
  token: "my-secret-token",
});

const transport = new NatsTransport({
  connection: nc,
  streamName: "MY_STREAM",
});
```

### Custom Stream Configuration

```typescript
const transport = new NatsTransport({
  connectionOptions: { servers: "localhost:4222" },
  streamName: "ORDERS_STREAM",
  retentionPolicy: "limits",
  maxMessages: 100000,
  maxBytes: 100 * 1024 * 1024, // 100MB
  maxAge: 24 * 60 * 60 * 1000000000, // 24 hours in nanoseconds
  replicas: 3,
});
```

### Multiple Consumer Groups

```typescript
// Worker pool 1
await transport.subscribe(
  { endpoint: "orders", group: "order-validators" },
  async (envelope) => {
    await validateOrder(envelope.payload);
  }
);

// Worker pool 2
await transport.subscribe(
  { endpoint: "orders", group: "order-emailers" },
  async (envelope) => {
    await sendOrderEmail(envelope.payload);
  }
);
```

## Subject Hierarchy

Messages are published to subjects following this pattern:

```
{subjectPrefix}.{endpoint}.{messageType}
```

Examples:
- `saga-bus.orders.OrderCreated`
- `saga-bus.payments.PaymentReceived`
- `myapp.inventory.StockUpdated`

Consumers subscribe to patterns using `>` wildcard:
- `saga-bus.orders.>` - All order messages
- `saga-bus.>` - All messages

## Retention Policies

| Policy | Description | Use Case |
|--------|-------------|----------|
| `limits` | Messages kept until limits reached | Event sourcing, audit logs |
| `interest` | Messages kept while consumers interested | Standard pub/sub |
| `workqueue` | Messages removed after acknowledgment | Task queues, job processing |

## Message Format

Messages are published as JSON:

```json
{
  "id": "msg-uuid",
  "type": "OrderCreated",
  "payload": { "type": "OrderCreated", "orderId": "123" },
  "headers": {},
  "timestamp": "2024-01-01T00:00:00.000Z",
  "partitionKey": "order-123"
}
```

With NATS headers:
- `Nats-Msg-Id`: Unique message ID
- `X-Message-Type`: Message type
- `X-Correlation-Id`: Correlation/partition key

## Limitations

### No Delayed Messages

NATS JetStream does not support native delayed message delivery. Attempting to publish with `delayMs` will throw an error:

```typescript
// This will throw an error
await transport.publish(message, { delayMs: 5000 });
// Error: NATS JetStream does not support delayed messages.
//        Use an external scheduler for delayed delivery.
```

**Alternatives:**
- Use Redis sorted sets for scheduling
- Implement delay in application logic
- Use a separate scheduler service

## Error Handling

Messages that fail processing are automatically retried up to `maxDeliver` times:

```typescript
const transport = new NatsTransport({
  connectionOptions: { servers: "localhost:4222" },
  maxDeliver: 10, // Retry up to 10 times
  ackWait: 60_000_000_000, // 60 second ack timeout
});
```

## Testing

For testing, you can run NATS locally:

```bash
# Run NATS with JetStream enabled
docker run -p 4222:4222 nats:latest -js
```

Or use the NATS CLI:

```bash
nats-server -js
```

## License

MIT
