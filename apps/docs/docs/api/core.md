---
sidebar_position: 1
---

# Core API Reference

API reference for `@saga-bus/core`.

## Functions

### `createSagaMachine<TState, TMessages>()`

Creates a saga builder:

```typescript
const builder = createSagaMachine<OrderState, OrderMessages>();
```

### `createBus(config: BusConfig)`

Creates a bus instance:

```typescript
const bus = createBus({
  transport,
  store,
  sagas: [{ definition: orderSaga }],
  middleware: [],
  logger: DefaultLogger,
  errorHandler: createErrorHandler(),
  worker: { /* config */ },
});
```

### `createErrorHandler(options)`

Creates custom error handler:

```typescript
const errorHandler = createErrorHandler({
  onTransientError: (error, envelope) => { ... },
  onPermanentError: (error, envelope) => { ... },
});
```

## Interfaces

### `Bus`

```typescript
interface Bus {
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
  publish<T>(message: T, options?: PublishOptions): Promise<void>;
}
```

### `BusConfig`

```typescript
interface BusConfig {
  transport: Transport;
  store?: SagaStore<SagaState>;
  sagas: SagaRegistration[];
  middleware?: SagaMiddleware[];
  logger?: Logger;
  metrics?: Metrics;
  tracer?: Tracer;
  errorHandler?: ErrorHandler;
  worker?: WorkerConfig;
}
```

### `SagaRegistration`

```typescript
interface SagaRegistration {
  definition: SagaDefinition;
  store?: SagaStore<SagaState>;
}
```

## Constants

### `DEFAULT_RETRY_POLICY`

```typescript
{
  maxRetries: 5,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
}
```

### `DEFAULT_TIMEOUT_BOUNDS`

```typescript
{
  minTimeoutMs: 1000,
  maxTimeoutMs: 7 * 24 * 60 * 60 * 1000, // 7 days
}
```

See also:
- [Types Reference](/docs/api/types)
- [Errors Reference](/docs/api/errors)
