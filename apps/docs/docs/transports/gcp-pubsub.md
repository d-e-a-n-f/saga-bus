---
sidebar_position: 7
title: GCP Pub/Sub
---

# GCP Pub/Sub Transport

Globally distributed transport using Google Cloud Pub/Sub.

## Installation

```bash npm2yarn
npm install @saga-bus/transport-gcp-pubsub @google-cloud/pubsub
```

## Basic Usage

```typescript
import { GcpPubSubTransport } from '@saga-bus/transport-gcp-pubsub';

const transport = new GcpPubSubTransport({
  projectId: 'my-project',
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
| `projectId` | `string` | Required | GCP project ID |
| `keyFilename` | `string` | - | Path to service account key |
| `credentials` | `object` | - | Service account credentials object |
| `topicPrefix` | `string` | `'saga-bus'` | Prefix for topic names |
| `subscriptionPrefix` | `string` | `'saga-bus'` | Prefix for subscriptions |
| `flowControl` | `object` | - | Flow control settings |
| `ackDeadline` | `number` | `10` | Acknowledgment deadline (seconds) |

## Full Configuration Example

```typescript
import { GcpPubSubTransport } from '@saga-bus/transport-gcp-pubsub';

const transport = new GcpPubSubTransport({
  projectId: 'my-project-id',

  // Auth option 1: Key file
  keyFilename: '/path/to/service-account.json',

  // Auth option 2: Credentials object
  credentials: {
    client_email: process.env.GCP_CLIENT_EMAIL,
    private_key: process.env.GCP_PRIVATE_KEY,
  },

  // Naming
  topicPrefix: 'orders',
  subscriptionPrefix: 'order-service',

  // Flow control
  flowControl: {
    maxMessages: 100,
    maxBytes: 100 * 1024 * 1024, // 100MB
  },

  // Acknowledgment
  ackDeadline: 30,
});
```

## Topic Naming

Topics and subscriptions are created automatically:

```
Topics:
  {topicPrefix}-{SagaName}-{MessageType}

Subscriptions:
  {subscriptionPrefix}-{SagaName}-{MessageType}
```

For example:
- Topic: `orders-OrderSaga-OrderSubmitted`
- Subscription: `order-service-OrderSaga-OrderSubmitted`

## Authentication

### Local Development

Use Application Default Credentials:

```bash
# Install gcloud CLI and authenticate
gcloud auth application-default login
```

```typescript
const transport = new GcpPubSubTransport({
  projectId: 'my-project',
  // Credentials auto-discovered from environment
});
```

### Service Account

```typescript
// Option 1: Key file path
const transport = new GcpPubSubTransport({
  projectId: 'my-project',
  keyFilename: '/path/to/service-account.json',
});

// Option 2: Environment variable
// Set GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
const transport = new GcpPubSubTransport({
  projectId: 'my-project',
});
```

### Workload Identity (GKE)

```typescript
// Uses workload identity automatically
const transport = new GcpPubSubTransport({
  projectId: 'my-project',
});
```

Required IAM roles:
- `roles/pubsub.publisher`
- `roles/pubsub.subscriber`

## Message Ordering

Enable ordering for FIFO processing:

```typescript
const transport = new GcpPubSubTransport({
  projectId: 'my-project',
  enableMessageOrdering: true,
});

// Messages with same correlationId maintain order
```

## Dead Letter Topics

Configure dead letter handling:

```typescript
const transport = new GcpPubSubTransport({
  projectId: 'my-project',
  deadLetterPolicy: {
    deadLetterTopic: 'projects/my-project/topics/saga-bus-dlq',
    maxDeliveryAttempts: 5,
  },
});
```

## Flow Control

Prevent memory issues with flow control:

```typescript
const transport = new GcpPubSubTransport({
  projectId: 'my-project',
  flowControl: {
    maxMessages: 100,    // Max outstanding messages
    maxBytes: 104857600, // 100MB max outstanding bytes
  },
});
```

## Emulator for Local Development

Use the Pub/Sub emulator for local testing:

```bash
# Start emulator
gcloud beta emulators pubsub start --project=test-project
```

```typescript
const transport = new GcpPubSubTransport({
  projectId: 'test-project',
  apiEndpoint: 'localhost:8085',
});
```

Docker Compose:

```yaml
services:
  pubsub-emulator:
    image: gcr.io/google.com/cloudsdktool/cloud-sdk:latest
    command: gcloud beta emulators pubsub start --host-port=0.0.0.0:8085 --project=test-project
    ports:
      - "8085:8085"
```

## Multi-Region Setup

Pub/Sub automatically replicates globally:

```typescript
// Messages published in any region are delivered globally
// No additional configuration needed
```

## Best Practices

### Use Appropriate Acknowledgment Deadlines

```typescript
// Set deadline longer than expected processing time
const transport = new GcpPubSubTransport({
  projectId: 'my-project',
  ackDeadline: 60, // 60 seconds for long processing
});
```

### Enable Retry on Failure

```typescript
// Configure subscription retry policy
const transport = new GcpPubSubTransport({
  projectId: 'my-project',
  retryPolicy: {
    minimumBackoff: '10s',
    maximumBackoff: '600s',
  },
});
```

### Monitor Subscription Backlog

```typescript
// Use Cloud Monitoring for:
// - subscription/num_undelivered_messages
// - subscription/oldest_unacked_message_age
```

## Cost Optimization

- Use batch publishing for high-volume scenarios
- Configure appropriate retention periods
- Use filtering to reduce delivery volume

```typescript
const transport = new GcpPubSubTransport({
  projectId: 'my-project',
  batchOptions: {
    maxMessages: 100,
    maxMilliseconds: 100,
  },
});
```

## See Also

- [Transports Overview](/docs/transports/overview)
- [Error Handling](/docs/core-concepts/error-handling)
- [Scaling](/docs/production/scaling)
