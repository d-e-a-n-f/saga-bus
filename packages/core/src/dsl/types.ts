import type {
  BaseMessage,
  SagaState,
  SagaContext,
  SagaHandlerResult,
} from "../types/index.js";

/**
 * Options for correlating a message type.
 */
export interface CorrelateOptions {
  /** Whether this message type can start a new saga instance */
  canStart?: boolean;
}

/**
 * Configuration for a single message type's correlation.
 */
export interface CorrelationConfig<TMessage extends BaseMessage> {
  canStart: boolean;
  getCorrelationId: (message: TMessage) => string | null;
}

/**
 * Handler function signature.
 */
export type SagaHandler<
  TState extends SagaState,
  TMessage extends BaseMessage
> = (
  message: TMessage,
  state: TState,
  ctx: SagaContext
) => Promise<SagaHandlerResult<TState>>;

/**
 * State guard function.
 */
export type StateGuard<TState extends SagaState> = (state: TState) => boolean;

/**
 * Handler registration with optional state guard.
 */
export interface HandlerRegistration<
  TState extends SagaState,
  TMessage extends BaseMessage
> {
  messageType: string;
  guard?: StateGuard<TState>;
  handler: SagaHandler<TState, TMessage>;
}

/**
 * Initial state factory function.
 */
export type InitialStateFactory<
  TState extends SagaState,
  TMessage extends BaseMessage
> = (message: TMessage, ctx: SagaContext) => TState | Promise<TState>;
