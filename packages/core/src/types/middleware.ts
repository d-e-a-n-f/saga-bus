import type { MessageEnvelope } from "./messages.js";
import type { SagaState, SagaHandlerResult } from "./saga.js";

/**
 * Context passed through the middleware pipeline.
 */
export interface SagaPipelineContext {
  /** The message being processed */
  readonly envelope: MessageEnvelope;
  /** Name of the saga */
  readonly sagaName: string;
  /** Correlation ID */
  readonly correlationId: string;
  /** Saga instance ID (set after state is loaded/created) */
  sagaId?: string;
  /** State before handler execution */
  preState?: SagaState;
  /** State after handler execution */
  postState?: SagaState;
  /** Result from the handler */
  handlerResult?: SagaHandlerResult<SagaState>;
  /** Arbitrary metadata */
  readonly metadata: Record<string, unknown>;
  /** Error if one occurred */
  error?: unknown;
}

/**
 * Middleware function for the saga pipeline.
 */
export type SagaMiddleware = (
  ctx: SagaPipelineContext,
  next: () => Promise<void>
) => Promise<void>;
