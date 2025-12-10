# @saga-bus/transport-gcp-pubsub

Google Cloud Pub/Sub transport for saga-bus.

## Installation

```bash
npm install @saga-bus/transport-gcp-pubsub @google-cloud/pubsub
# or
pnpm add @saga-bus/transport-gcp-pubsub @google-cloud/pubsub
```

## Features

- **Topic/Subscription Model**: GCP Pub/Sub native architecture
- **Message Ordering**: Optional ordering key support
- **Auto-Creation**: Automatically creates topics and subscriptions
- **Dead-Letter Queues**: Support for DLQ configuration
- **Authentication**: Google Cloud ADC and service account support

## Quick Start

```typescript
import { createBus } from "@saga-bus/core";
import { GcpPubSubTransport } from "@saga-bus/transport-gcp-pubsub";

const transport = new GcpPubSubTransport({
  projectId: "my-gcp-project",
  defaultTopic: "saga-events",
});

const bus = createBus({
  transport,
  // ... other config
});

await bus.start();
```

## Configuration

```typescript
interface GcpPubSubTransportOptions {
  /** Existing PubSub client instance */
  pubsub?: PubSub;

  /** Client config for creating new PubSub instance */
  clientConfig?: ClientConfig;

  /** Project ID (required if not in clientConfig) */
  projectId?: string;

  /** Default topic for publishing */
  defaultTopic?: string;

  /** Subscription name prefix (default: "saga-bus-") */
  subscriptionPrefix?: string;

  /** Whether to use ordering keys for message ordering (default: false) */
  enableOrdering?: boolean;

  /** Max messages to pull at once (default: 10) */
  maxMessages?: number;

  /** Ack deadline in seconds (default: 60) */
  ackDeadlineSeconds?: number;

  /** Whether to auto-create topics/subscriptions (default: true) */
  autoCreate?: boolean;

  /** Dead-letter topic for failed messages */
  deadLetterTopic?: string;

  /** Max delivery attempts before dead-letter (default: 5) */
  maxDeliveryAttempts?: number;
}
```

## Examples

### Basic Usage

```typescript
import { GcpPubSubTransport } from "@saga-bus/transport-gcp-pubsub";

const transport = new GcpPubSubTransport({
  projectId: "my-project",
  defaultTopic: "saga-events",
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

### With Message Ordering

```typescript
const transport = new GcpPubSubTransport({
  projectId: "my-project",
  enableOrdering: true,
});

await transport.start();

// Messages with the same key will be delivered in order
await transport.publish(
  { type: "OrderCreated", orderId: "123" },
  { endpoint: "orders", key: "order-123" }
);

await transport.publish(
  { type: "OrderShipped", orderId: "123" },
  { endpoint: "orders", key: "order-123" }
);
```

### Using Existing PubSub Client

```typescript
import { PubSub } from "@google-cloud/pubsub";

const pubsub = new PubSub({
  projectId: "my-project",
  keyFilename: "/path/to/service-account.json",
});

const transport = new GcpPubSubTransport({
  pubsub,
  defaultTopic: "saga-events",
});
```

### With Dead-Letter Topic

```typescript
const transport = new GcpPubSubTransport({
  projectId: "my-project",
  deadLetterTopic: "saga-dlq",
  maxDeliveryAttempts: 5,
});
```

## Message Format

Messages are published as JSON with attributes:

```json
{
  "data": {
    "id": "msg-uuid",
    "type": "OrderCreated",
    "payload": { "type": "OrderCreated", "orderId": "123" },
    "headers": {},
    "timestamp": "2024-01-01T00:00:00.000Z",
    "partitionKey": "order-123"
  },
  "attributes": {
    "messageType": "OrderCreated",
    "messageId": "msg-uuid",
    "correlationId": "order-123"
  },
  "orderingKey": "order-123"
}
```

## Limitations

### No Delayed Messages

GCP Pub/Sub does not support native delayed message delivery. Attempting to publish with `delayMs` will throw an error:

```typescript
// This will throw an error
await transport.publish(message, { delayMs: 5000 });
// Error: GCP Pub/Sub does not support delayed messages.
//        Use Cloud Scheduler or Cloud Tasks for delayed delivery.
```

**Alternatives for delayed delivery:**

1. **Cloud Scheduler**: Schedule messages at specific times
2. **Cloud Tasks**: Queue tasks with delay
3. **Cloud Functions with Pub/Sub**: Implement custom delay logic

## Authentication

The transport uses Google Cloud's Application Default Credentials (ADC):

1. **Local Development**: Use `gcloud auth application-default login`
2. **Service Account**: Set `GOOGLE_APPLICATION_CREDENTIALS` environment variable
3. **GCP Services**: Automatically uses metadata service

```bash
# Local development
gcloud auth application-default login

# Or use service account
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
```

## Testing

For testing, you can use the GCP Pub/Sub emulator:

```bash
# Start emulator
gcloud beta emulators pubsub start --project=test-project

# Set environment variable
export PUBSUB_EMULATOR_HOST=localhost:8085
```

## License

MIT
