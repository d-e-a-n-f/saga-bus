---
sidebar_position: 2
---

# Types Reference

TypeScript type definitions for Saga Bus.

## Core Types

```typescript
export type {
  BaseMessage,
  MessageEnvelope,
  Transport,
  TransportSubscribeOptions,
  TransportPublishOptions,
  SagaState,
  SagaStateMetadata,
  SagaStore,
  SagaContext,
  SagaHandlerResult,
  SagaCorrelation,
  SagaDefinition,
  Bus,
  BusConfig,
  SagaRegistration,
  WorkerConfig,
  WorkerRetryPolicy,
  TimeoutBounds,
  SagaPipelineContext,
  SagaMiddleware,
  Logger,
  Metrics,
  Tracer,
  ErrorHandler,
};
```

See `@saga-bus/core` package for full type definitions.
