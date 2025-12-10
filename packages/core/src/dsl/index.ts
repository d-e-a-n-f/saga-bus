export { createSagaMachine, SagaMachineBuilder } from "./SagaMachineBuilder.js";
export { HandlerBuilder } from "./HandlerBuilder.js";
export { SagaDefinitionImpl } from "./SagaDefinitionImpl.js";

// Re-export DSL types
export type {
  CorrelateOptions,
  CorrelationConfig,
  SagaHandler,
  StateGuard,
  HandlerRegistration,
  InitialStateFactory,
} from "./types.js";
