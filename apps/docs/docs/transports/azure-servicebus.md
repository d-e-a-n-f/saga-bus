---
sidebar_position: 6
title: Azure Service Bus
---

# Azure Service Bus Transport

Enterprise-grade transport using Azure Service Bus with sessions support.

## Installation

```bash npm2yarn
npm install @saga-bus/transport-azure-servicebus @azure/service-bus
```

## Basic Usage

```typescript
import { AzureServiceBusTransport } from '@saga-bus/transport-azure-servicebus';

const transport = new AzureServiceBusTransport({
  connectionString: process.env.AZURE_SERVICEBUS_CONNECTION_STRING!,
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
| `connectionString` | `string` | Required | Service Bus connection string |
| `namespace` | `string` | - | Namespace (alternative to connection string) |
| `credential` | `TokenCredential` | - | Azure credential for auth |
| `topicPrefix` | `string` | `'saga-bus'` | Prefix for topic names |
| `subscriptionPrefix` | `string` | `'saga-bus'` | Prefix for subscriptions |
| `maxConcurrentCalls` | `number` | `10` | Max concurrent message handlers |
| `autoDeleteOnIdle` | `string` | - | Auto-delete idle subscriptions |

## Full Configuration Example

```typescript
import { AzureServiceBusTransport } from '@saga-bus/transport-azure-servicebus';
import { DefaultAzureCredential } from '@azure/identity';

const transport = new AzureServiceBusTransport({
  // Option 1: Connection string
  connectionString: process.env.AZURE_SERVICEBUS_CONNECTION_STRING,

  // Option 2: Managed Identity
  namespace: 'my-namespace.servicebus.windows.net',
  credential: new DefaultAzureCredential(),

  // Topic/Subscription settings
  topicPrefix: 'orders',
  subscriptionPrefix: 'order-service',

  // Processing settings
  maxConcurrentCalls: 10,
  autoDeleteOnIdle: 'P7D', // ISO 8601 duration
});
```

## Topic Naming

Topics and subscriptions are created automatically:

```
Topics:
  {topicPrefix}-{SagaName}-{MessageType}

Subscriptions:
  {subscriptionPrefix}-{SagaName}
```

For example:
- Topic: `orders-OrderSaga-OrderSubmitted`
- Subscription: `order-service-OrderSaga`

## Sessions Support

Service Bus sessions ensure ordered processing per saga instance:

```typescript
// Messages with same correlationId go to same session
// Guarantees FIFO processing per saga instance

const transport = new AzureServiceBusTransport({
  connectionString: process.env.AZURE_SERVICEBUS_CONNECTION_STRING,
  requiresSession: true, // Enable sessions
});
```

## Managed Identity

For Azure-hosted applications, use Managed Identity:

```typescript
import { DefaultAzureCredential } from '@azure/identity';

const transport = new AzureServiceBusTransport({
  namespace: 'my-namespace.servicebus.windows.net',
  credential: new DefaultAzureCredential(),
});
```

Required RBAC roles:
- `Azure Service Bus Data Sender`
- `Azure Service Bus Data Receiver`

## Message Scheduling

Schedule messages for future delivery:

```typescript
// Built-in support for scheduled delivery
// Useful for saga timeouts and delays
```

## Dead Letter Queue

Failed messages automatically go to the DLQ:

```typescript
const transport = new AzureServiceBusTransport({
  connectionString: process.env.AZURE_SERVICEBUS_CONNECTION_STRING,
  maxDeliveryCount: 10, // Move to DLQ after 10 failures
});
```

Access DLQ messages via Azure Portal or programmatically:

```typescript
// DLQ path: {topic}/{subscription}/$deadletterqueue
```

## Local Development

Use Azure Service Bus Emulator for local development:

```yaml
# docker-compose.yml
services:
  servicebus-emulator:
    image: mcr.microsoft.com/azure-messaging/servicebus-emulator:latest
    ports:
      - "5672:5672"
    environment:
      - ACCEPT_EULA=Y
```

```typescript
const transport = new AzureServiceBusTransport({
  connectionString: 'Endpoint=sb://localhost;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=test',
});
```

## Best Practices

### Use Premium Tier for Production

```typescript
// Premium tier provides:
// - Dedicated resources
// - Predictable performance
// - Message size up to 100MB
// - Availability zones
```

### Enable Auto-Forwarding

For complex routing scenarios:

```typescript
// Configure in Azure Portal or ARM templates
// Auto-forward from input topic to processing topic
```

### Monitor Queue Depth

```typescript
// Use Azure Monitor alerts for:
// - Active message count
// - Dead-letter message count
// - Scheduled message count
```

## Error Handling

Configure retry policies:

```typescript
const transport = new AzureServiceBusTransport({
  connectionString: process.env.AZURE_SERVICEBUS_CONNECTION_STRING,
  retryOptions: {
    maxRetries: 3,
    delay: 1000, // ms
    maxDelay: 30000, // ms
    mode: 'exponential',
  },
});
```

## See Also

- [Transports Overview](/docs/transports/overview)
- [Error Handling](/docs/core-concepts/error-handling)
- [Deployment](/docs/production/deployment)
