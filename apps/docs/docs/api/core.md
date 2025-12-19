---
sidebar_position: 1
---

# Core API Reference

Complete API reference for `@saga-bus/core`.

## Functions

### `defineSaga<TState, TMessages>(options)`

Creates a saga definition with typed state and message handlers.

```typescript
import { defineSaga } from '@saga-bus/core';

interface OrderState {
  orderId: string;
  status: string;
}

const orderSaga = defineSaga<OrderState>({
  name: 'OrderSaga',
  initialState: () => ({
    orderId: '',
    status: 'initial',
  }),
  correlationId: (message) => message.orderId,
  handlers: {
    OrderSubmitted: async (ctx) => {
      // Handler implementation
    },
  },
});
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Unique saga identifier |
| `initialState` | `() => TState` | Factory function returning initial state |
| `correlationId` | `(message: any) => string` | Extract correlation ID from messages |
| `handlers` | `Record<string, Handler>` | Message type to handler mapping |

**Returns:** `SagaDefinition<TState>`

---

### `createBus(config)`

Creates and configures a message bus instance.

```typescript
import { createBus } from '@saga-bus/core';

const bus = createBus({
  transport,
  store,
  sagas: [{ definition: orderSaga }],
  middleware: [loggingMiddleware],
  concurrency: 10,
});
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `transport` | `Transport` | Yes | Message transport implementation |
| `store` | `SagaStore` | No | State persistence store |
| `sagas` | `SagaRegistration[]` | Yes | Saga definitions to register |
| `middleware` | `Middleware[]` | No | Middleware pipeline |
| `concurrency` | `number` | No | Max concurrent message processing (default: 10) |
| `retry` | `RetryConfig` | No | Retry configuration |
| `logger` | `Logger` | No | Custom logger |

**Returns:** `Bus`

---

### `createMiddleware(options)`

Creates a custom middleware.

```typescript
import { createMiddleware } from '@saga-bus/core';

const loggingMiddleware = createMiddleware({
  name: 'logging',
  beforeHandle: async ({ message, context }) => {
    console.log('Processing:', message.type);
  },
  afterHandle: async ({ message, context, result }) => {
    console.log('Completed:', message.type);
  },
  onError: async ({ error, message, context }) => {
    console.error('Error:', error.message);
  },
});
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Middleware identifier |
| `beforeHandle` | `(ctx) => Promise<void>` | Called before handler execution |
| `afterHandle` | `(ctx) => Promise<void>` | Called after successful execution |
| `onError` | `(ctx) => Promise<void>` | Called on handler error |

**Returns:** `Middleware`

---

### `createHandler(options)`

Creates a standalone message handler (not part of a saga).

```typescript
import { createHandler } from '@saga-bus/core';

const paymentHandler = createHandler({
  messageType: 'PaymentRequested',
  handler: async (ctx) => {
    const result = await paymentService.capture(ctx.message);
    ctx.publish({
      type: 'PaymentCaptured',
      transactionId: result.transactionId,
    });
  },
});
```

---

## Classes

### `Bus`

Main message bus class.

#### Methods

##### `start(): Promise<void>`

Start the bus and begin processing messages.

```typescript
await bus.start();
```

##### `stop(): Promise<void>`

Stop the bus and cease message processing.

```typescript
await bus.stop();
```

##### `drain(options?): Promise<void>`

Wait for in-flight messages to complete before stopping.

```typescript
await bus.drain({ timeout: 30000 });
```

##### `isRunning(): boolean`

Check if the bus is currently running.

```typescript
if (bus.isRunning()) {
  console.log('Bus is active');
}
```

##### `publish<T>(message: T, options?): Promise<void>`

Publish a message to the transport.

```typescript
await bus.publish({
  type: 'OrderSubmitted',
  orderId: '123',
  total: 99.99,
});

// With options
await bus.publish(message, {
  correlationId: 'custom-id',
  metadata: { userId: 'user-123' },
});
```

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `correlationId` | `string` | Override correlation ID |
| `metadata` | `Record<string, any>` | Additional message metadata |
| `delay` | `number` | Delay delivery (ms) |

##### `getSagaState(sagaName: string, correlationId: string): Promise<TState | null>`

Get the current state of a saga instance.

```typescript
const state = await bus.getSagaState('OrderSaga', 'order-123');
if (state) {
  console.log('Order status:', state.status);
}
```

---

## Interfaces

### `SagaContext<TState>`

Context passed to saga handlers.

```typescript
interface SagaContext<TState> {
  // Current saga state
  state: TState;

  // Incoming message
  message: any;

  // Update saga state
  setState(newState: TState): void;

  // Publish a message
  publish(message: any): void;

  // Mark saga as completed
  complete(): void;

  // Schedule a timeout
  scheduleTimeout(options: TimeoutOptions): void;

  // Cancel a timeout
  cancelTimeout(timeoutId: string): void;

  // Correlation ID for this saga instance
  correlationId: string;

  // Saga name
  sagaName: string;

  // Message metadata
  metadata: Map<string, any>;

  // Logger instance
  logger: Logger;
}
```

#### Methods

##### `setState(newState: TState): void`

Update the saga's persisted state.

```typescript
ctx.setState({
  ...ctx.state,
  status: 'paid',
  transactionId: ctx.message.transactionId,
});
```

##### `publish(message: any): void`

Publish a new message.

```typescript
ctx.publish({
  type: 'PaymentRequested',
  orderId: ctx.state.orderId,
  amount: ctx.state.total,
});
```

##### `complete(): void`

Mark the saga as completed (no more messages will be processed).

```typescript
ctx.setState({ ...ctx.state, status: 'completed' });
ctx.complete();
```

##### `scheduleTimeout(options): void`

Schedule a delayed message.

```typescript
ctx.scheduleTimeout({
  type: 'PaymentTimeout',
  orderId: ctx.state.orderId,
  delay: 15 * 60 * 1000, // 15 minutes
});
```

---

### `Transport`

Interface for message transport implementations.

```typescript
interface Transport {
  // Connect to the transport
  connect(): Promise<void>;

  // Disconnect from the transport
  disconnect(): Promise<void>;

  // Subscribe to messages
  subscribe(
    handler: MessageHandler,
    options?: SubscribeOptions
  ): Promise<Subscription>;

  // Publish a message
  publish(message: any, options?: PublishOptions): Promise<void>;

  // Check connection status
  isConnected(): boolean;
}
```

---

### `SagaStore<TState>`

Interface for saga state persistence.

```typescript
interface SagaStore<TState> {
  // Get saga state by correlation ID
  getByCorrelationId(
    sagaName: string,
    correlationId: string
  ): Promise<SagaRecord<TState> | null>;

  // Insert new saga state
  insert(
    sagaName: string,
    correlationId: string,
    state: TState
  ): Promise<void>;

  // Update existing saga state
  update(
    sagaName: string,
    correlationId: string,
    state: TState,
    version: number
  ): Promise<void>;

  // Mark saga as completed
  complete(
    sagaName: string,
    correlationId: string
  ): Promise<void>;

  // Close store connection
  close(): Promise<void>;
}
```

---

### `BusConfig`

Configuration options for `createBus()`.

```typescript
interface BusConfig {
  // Message transport
  transport: Transport;

  // State store (optional for stateless handlers)
  store?: SagaStore;

  // Saga registrations
  sagas: SagaRegistration[];

  // Middleware pipeline
  middleware?: Middleware[];

  // Concurrent message processing limit
  concurrency?: number;

  // Retry configuration
  retry?: RetryConfig;

  // Custom logger
  logger?: Logger;

  // Metrics collector
  metrics?: MetricsCollector;

  // Error handler
  errorHandler?: ErrorHandler;
}
```

---

### `RetryConfig`

Configuration for automatic retries.

```typescript
interface RetryConfig {
  // Maximum retry attempts
  maxAttempts: number;

  // Initial retry delay (ms)
  initialDelay: number;

  // Maximum retry delay (ms)
  maxDelay: number;

  // Backoff multiplier
  backoffMultiplier: number;

  // Add random jitter to delays
  jitter: boolean;
}
```

**Defaults:**

```typescript
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  initialDelay: 1000,
  maxDelay: 60000,
  backoffMultiplier: 2,
  jitter: true,
};
```

---

### `PublishOptions`

Options for publishing messages.

```typescript
interface PublishOptions {
  // Override correlation ID
  correlationId?: string;

  // Additional metadata
  metadata?: Record<string, any>;

  // Delay delivery (ms)
  delay?: number;

  // Partition key (for partitioned transports)
  partitionKey?: string;

  // Message priority
  priority?: number;
}
```

---

## Constants

### `DEFAULT_RETRY_POLICY`

```typescript
const DEFAULT_RETRY_POLICY = {
  maxRetries: 5,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};
```

### `DEFAULT_TIMEOUT_BOUNDS`

```typescript
const DEFAULT_TIMEOUT_BOUNDS = {
  minTimeoutMs: 1000,
  maxTimeoutMs: 7 * 24 * 60 * 60 * 1000, // 7 days
};
```

### `DEFAULT_CONCURRENCY`

```typescript
const DEFAULT_CONCURRENCY = 10;
```

## See Also

- [Types Reference](/docs/api/types)
- [Errors Reference](/docs/api/errors)
- [Getting Started](/docs/getting-started/installation)
