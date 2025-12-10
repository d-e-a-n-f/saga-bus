# @saga-bus/transport-azure-servicebus

Azure Service Bus transport for saga-bus. Provides integration with Azure Service Bus topics and subscriptions with support for sessions, scheduled messages, and dead-letter queues.

## Installation

```bash
pnpm add @saga-bus/transport-azure-servicebus @azure/service-bus
```

## Usage

### Basic Setup

```typescript
import { AzureServiceBusTransport } from "@saga-bus/transport-azure-servicebus";
import { createBus } from "@saga-bus/core";

const transport = new AzureServiceBusTransport({
  connectionString: process.env.AZURE_SERVICE_BUS_CONNECTION_STRING,
  subscriptionName: "my-worker",
});

const bus = createBus({
  transport,
  store,
  sagas: [OrderSaga],
});

await bus.start();
```

### Azure AD Authentication

```typescript
import { DefaultAzureCredential } from "@azure/identity";

const transport = new AzureServiceBusTransport({
  fullyQualifiedNamespace: "mybus.servicebus.windows.net",
  credential: new DefaultAzureCredential(),
  subscriptionName: "my-worker",
});
```

### Session-Based Ordering

Enable sessions for guaranteed message ordering per correlation ID:

```typescript
const transport = new AzureServiceBusTransport({
  connectionString: process.env.AZURE_SERVICE_BUS_CONNECTION_STRING,
  subscriptionName: "my-worker",
  sessionEnabled: true, // Uses correlation ID as session ID
});
```

## Features

- **Topic/Subscription Model** - Publish to topics, subscribe via subscriptions
- **Session Support** - Ordered message processing using sessions
- **Scheduled Messages** - Native delayed delivery via `scheduledEnqueueTimeUtc`
- **Dead-Letter Queue** - Automatic DLQ for invalid messages
- **Auto-Lock Renewal** - Prevents message loss during long processing
- **Azure AD Authentication** - Support for managed identities

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `connectionString` | `string` | - | Connection string for Service Bus |
| `fullyQualifiedNamespace` | `string` | - | Namespace for Azure AD auth |
| `credential` | `TokenCredential` | - | Azure AD credential |
| `subscriptionName` | `string` | - | Subscription name for receiving |
| `defaultTopic` | `string` | message type | Default topic for publishing |
| `sessionEnabled` | `boolean` | `false` | Enable session-based ordering |
| `maxConcurrentCalls` | `number` | `1` | Concurrent message handlers |
| `maxAutoLockRenewalDurationInMs` | `number` | `300000` | Lock renewal duration |
| `autoCompleteMessages` | `boolean` | `false` | Auto-complete on success |
| `receiveMode` | `"peekLock" \| "receiveAndDelete"` | `"peekLock"` | Message receive mode |
| `entityPrefix` | `string` | `""` | Prefix for topic/queue names |

## Delayed Messages

The transport uses Azure Service Bus native scheduled messages:

```typescript
// In a saga handler
await ctx.schedule(
  { type: "PaymentTimeout", orderId },
  60000 // 1 minute delay
);
```

## Error Handling

- **Invalid messages** are sent to the dead-letter queue
- **Handler errors** cause message abandonment for retry
- **Connection errors** are logged and the receiver continues

## License

MIT
