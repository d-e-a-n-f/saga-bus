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
  /** Existing state loaded from store (null if new saga) */
  existingState?: SagaState | null;
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
  /** Trace context to store with saga (set by tracing middleware) */
  traceContext?: { traceParent: string; traceState: string | null };
  /**
   * Set trace context to be stored with the saga state.
   * Called by tracing middleware for new sagas.
   */
  setTraceContext(traceParent: string, traceState: string | null): void;
}

/**
 * Middleware function for the saga pipeline.
 */
export type SagaMiddleware = (
  ctx: SagaPipelineContext,
  next: () => Promise<void>
) => Promise<void>;
