---
sidebar_position: 2
---

# Types Reference

Complete TypeScript type definitions for saga-bus.

## Message Types

### `BaseMessage`

Base interface for all messages.

```typescript
interface BaseMessage {
  // Message type identifier
  type: string;

  // Optional message ID (auto-generated if not provided)
  messageId?: string;

  // Correlation ID for saga routing
  correlationId?: string;

  // Message timestamp
  timestamp?: string;
}
```

### `MessageEnvelope<T>`

Wrapper containing message and metadata.

```typescript
interface MessageEnvelope<T extends BaseMessage> {
  // The actual message
  message: T;

  // Message metadata
  metadata: MessageMetadata;

  // Retry information
  retryInfo: RetryInfo;
}

interface MessageMetadata {
  // Unique message ID
  messageId: string;

  // Correlation ID
  correlationId: string;

  // ISO timestamp
  timestamp: string;

  // Custom headers
  headers: Record<string, string>;

  // Source information
  source?: string;
}

interface RetryInfo {
  // Current attempt number (starts at 1)
  attempt: number;

  // Maximum attempts allowed
  maxAttempts: number;

  // History of previous failures
  failures: FailureRecord[];
}

interface FailureRecord {
  error: string;
  timestamp: string;
  attempt: number;
}
```

## Saga Types

### `SagaDefinition<TState>`

Definition of a saga including handlers and configuration.

```typescript
interface SagaDefinition<TState> {
  // Unique saga name
  name: string;

  // Factory for initial state
  initialState: () => TState;

  // Extract correlation ID from message
  correlationId: (message: any) => string;

  // Message handlers
  handlers: Record<string, SagaHandler<TState>>;

  // Optional saga-level configuration
  config?: SagaConfig;
}

interface SagaConfig {
  // Per-saga concurrency limit
  concurrency?: number;

  // Saga timeout (ms)
  timeout?: number;

  // Custom retry configuration
  retry?: RetryConfig;
}
```

### `SagaHandler<TState>`

Handler function signature.

```typescript
type SagaHandler<TState> = (
  context: SagaContext<TState>
) => Promise<void> | void;
```

### `SagaContext<TState>`

Context provided to saga handlers.

```typescript
interface SagaContext<TState> {
  // Current saga state
  readonly state: TState;

  // Incoming message
  readonly message: any;

  // Correlation ID
  readonly correlationId: string;

  // Saga name
  readonly sagaName: string;

  // Message metadata
  readonly metadata: Map<string, any>;

  // Logger instance
  readonly logger: Logger;

  // Update saga state
  setState(newState: TState): void;

  // Publish a message
  publish(message: any): void;

  // Publish multiple messages
  publishAll(messages: any[]): void;

  // Mark saga as completed
  complete(): void;

  // Schedule timeout
  scheduleTimeout(options: TimeoutOptions): void;

  // Cancel scheduled timeout
  cancelTimeout(timeoutId: string): void;
}

interface TimeoutOptions {
  // Timeout message type
  type: string;

  // Delay in milliseconds
  delay: number;

  // Additional timeout payload
  [key: string]: any;
}
```

### `SagaRecord<TState>`

Persisted saga instance data.

```typescript
interface SagaRecord<TState> {
  // Saga name
  sagaName: string;

  // Correlation ID
  correlationId: string;

  // Current state
  state: TState;

  // Version for optimistic concurrency
  version: number;

  // Completion status
  completed: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}
```

### `SagaRegistration`

Configuration for registering a saga with the bus.

```typescript
interface SagaRegistration<TState = any> {
  // Saga definition
  definition: SagaDefinition<TState>;

  // Override store for this saga
  store?: SagaStore<TState>;

  // Saga-specific options
  options?: SagaOptions;
}

interface SagaOptions {
  // Enable/disable this saga
  enabled?: boolean;

  // Custom correlation ID extractor
  correlationId?: (message: any) => string;
}
```

## Transport Types

### `Transport`

Interface for message transport implementations.

```typescript
interface Transport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(handler: MessageHandler, options?: SubscribeOptions): Promise<Subscription>;
  publish(message: any, options?: PublishOptions): Promise<void>;
  isConnected(): boolean;
}

type MessageHandler = (envelope: MessageEnvelope<any>) => Promise<void>;

interface Subscription {
  unsubscribe(): Promise<void>;
}
```

### `SubscribeOptions`

Options for subscribing to messages.

```typescript
interface SubscribeOptions {
  // Message types to subscribe to
  messageTypes?: string[];

  // Queue/topic name
  queue?: string;

  // Consumer group
  consumerGroup?: string;

  // Prefetch count
  prefetch?: number;
}
```

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

  // Partition key
  partitionKey?: string;

  // Message priority (1-10)
  priority?: number;

  // Message expiration (ms)
  expiration?: number;
}
```

## Store Types

### `SagaStore<TState>`

Interface for saga state persistence.

```typescript
interface SagaStore<TState = any> {
  getByCorrelationId(sagaName: string, correlationId: string): Promise<SagaRecord<TState> | null>;
  insert(sagaName: string, correlationId: string, state: TState): Promise<void>;
  update(sagaName: string, correlationId: string, state: TState, version: number): Promise<void>;
  complete(sagaName: string, correlationId: string): Promise<void>;
  close(): Promise<void>;
}
```

### `StoreOptions`

Common options for store implementations.

```typescript
interface StoreOptions {
  // Table/collection name
  tableName?: string;

  // Schema name (SQL stores)
  schema?: string;

  // TTL for completed sagas
  completedTtl?: number;

  // Enable encryption
  encryption?: EncryptionOptions;
}

interface EncryptionOptions {
  enabled: boolean;
  key: string;
  algorithm?: string;
}
```

## Middleware Types

### `Middleware`

Middleware interface.

```typescript
interface Middleware {
  // Middleware name
  name: string;

  // Called before handler
  beforeHandle?: (ctx: MiddlewareContext) => Promise<void>;

  // Called after successful handler
  afterHandle?: (ctx: MiddlewareContext & { result: any }) => Promise<void>;

  // Called on handler error
  onError?: (ctx: MiddlewareContext & { error: Error }) => Promise<void>;
}

interface MiddlewareContext {
  message: any;
  metadata: Map<string, any>;
  sagaName?: string;
  correlationId?: string;
  logger: Logger;
}
```

## Configuration Types

### `BusConfig`

Full bus configuration.

```typescript
interface BusConfig {
  transport: Transport;
  store?: SagaStore;
  sagas: SagaRegistration[];
  middleware?: Middleware[];
  concurrency?: number;
  retry?: RetryConfig;
  logger?: Logger;
  metrics?: MetricsCollector;
  errorHandler?: ErrorHandler;
}
```

### `RetryConfig`

Retry configuration.

```typescript
interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryOn?: (error: Error) => boolean;
}
```

## Utility Types

### `Logger`

Logger interface.

```typescript
interface Logger {
  debug(message: string, context?: Record<string, any>): void;
  info(message: string, context?: Record<string, any>): void;
  warn(message: string, context?: Record<string, any>): void;
  error(message: string, context?: Record<string, any>): void;
}
```

### `MetricsCollector`

Metrics collection interface.

```typescript
interface MetricsCollector {
  increment(name: string, labels?: Record<string, string>): void;
  gauge(name: string, value: number, labels?: Record<string, string>): void;
  histogram(name: string, value: number, labels?: Record<string, string>): void;
}
```

### `ErrorHandler`

Custom error handler.

```typescript
interface ErrorHandler {
  onTransientError(error: Error, envelope: MessageEnvelope<any>): Promise<void>;
  onPermanentError(error: Error, envelope: MessageEnvelope<any>): Promise<void>;
}
```

## Type Exports

Import types from `@saga-bus/core`:

```typescript
import type {
  // Messages
  BaseMessage,
  MessageEnvelope,
  MessageMetadata,

  // Saga
  SagaDefinition,
  SagaHandler,
  SagaContext,
  SagaRecord,
  SagaRegistration,

  // Transport
  Transport,
  SubscribeOptions,
  PublishOptions,

  // Store
  SagaStore,
  StoreOptions,

  // Middleware
  Middleware,
  MiddlewareContext,

  // Config
  BusConfig,
  RetryConfig,

  // Utility
  Logger,
  MetricsCollector,
  ErrorHandler,
} from '@saga-bus/core';
```

## See Also

- [Core API Reference](/docs/api/core)
- [Errors Reference](/docs/api/errors)
