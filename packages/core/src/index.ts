// Types
export type {
  // Messages
  BaseMessage,
  MessageEnvelope,
  // Transport
  Transport,
  TransportSubscribeOptions,
  TransportPublishOptions,
  // Saga
  SagaState,
  SagaStateMetadata,
  SagaStore,
  SagaContext,
  SagaHandlerResult,
  SagaCorrelation,
  SagaDefinition,
  // Bus
  Bus,
  BusConfig,
  SagaRegistration,
  WorkerConfig,
  WorkerRetryPolicy,
  // Middleware
  SagaPipelineContext,
  SagaMiddleware,
  // Observability
  Logger,
  Metrics,
  Tracer,
  ErrorHandler,
} from "./types/index.js";

// Errors
export {
  ConcurrencyError,
  TransientError,
  ValidationError,
} from "./errors/index.js";

// Functions will be added in later phases:
// - createBus (Phase 5)
// - createSagaMachine (Phase 4)
