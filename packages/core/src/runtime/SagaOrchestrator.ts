import type {
  BaseMessage,
  MessageEnvelope,
  SagaDefinition,
  SagaState,
  SagaStore,
  SagaPipelineContext,
  Transport,
  Logger,
  SagaTimeoutExpired,
} from "../types/index.js";
import { SAGA_TIMEOUT_MESSAGE_TYPE } from "../types/index.js";
import { ConcurrencyError } from "../errors/index.js";
import { SagaContextImpl } from "./SagaContextImpl.js";
import { MiddlewarePipeline } from "./MiddlewarePipeline.js";
import { generateSagaId, now } from "./utils.js";

export interface SagaOrchestratorOptions<
  TState extends SagaState,
  TMessages extends BaseMessage
> {
  definition: SagaDefinition<TState, TMessages>;
  store: SagaStore<TState>;
  transport: Transport;
  pipeline: MiddlewarePipeline;
  logger: Logger;
  /** Default endpoint for publishing messages (including timeout messages) */
  defaultEndpoint?: string;
}

/**
 * Orchestrates saga execution for a single saga definition.
 */
export class SagaOrchestrator<
  TState extends SagaState,
  TMessages extends BaseMessage
> {
  private readonly definition: SagaDefinition<TState, TMessages>;
  private readonly store: SagaStore<TState>;
  private readonly transport: Transport;
  private readonly pipeline: MiddlewarePipeline;
  private readonly logger: Logger;
  private readonly defaultEndpoint?: string;

  constructor(options: SagaOrchestratorOptions<TState, TMessages>) {
    this.definition = options.definition;
    this.store = options.store;
    this.transport = options.transport;
    this.pipeline = options.pipeline;
    this.logger = options.logger;
    this.defaultEndpoint = options.defaultEndpoint;
  }

  /**
   * Process an incoming message.
   */
  async processMessage(envelope: MessageEnvelope<TMessages>): Promise<void> {
    const message = envelope.payload;
    const correlation = this.definition.getCorrelation(message);
    const correlationId = correlation.getCorrelationId(message);

    if (!correlationId) {
      this.logger.warn("Could not correlate message", {
        sagaName: this.definition.name,
        messageType: message.type,
        messageId: envelope.id,
      });
      return;
    }

    // Load existing saga state BEFORE pipeline executes
    // This allows middleware (e.g., tracing) to access stored trace context
    const existingState = await this.store.getByCorrelationId(
      this.definition.name,
      correlationId
    );

    // Create pipeline context with mutable trace context
    let traceContext: { traceParent: string; traceState: string | null } | undefined;

    const pipelineCtx: SagaPipelineContext = {
      envelope,
      sagaName: this.definition.name,
      correlationId,
      existingState, // Provide existing state to middleware
      metadata: {},
      setTraceContext(traceParent: string, traceState: string | null) {
        traceContext = { traceParent, traceState };
        pipelineCtx.traceContext = traceContext;
      },
    };

    try {
      await this.pipeline.execute(pipelineCtx, async () => {
        await this.handleMessage(envelope, correlationId, correlation.canStart, existingState, pipelineCtx);
      });
    } catch (error) {
      pipelineCtx.error = error;
      throw error;
    }
  }

  private async handleMessage(
    envelope: MessageEnvelope<TMessages>,
    correlationId: string,
    canStart: boolean,
    existingState: TState | null,
    pipelineCtx: SagaPipelineContext
  ): Promise<void> {
    const message = envelope.payload;

    // Use the pre-loaded existing state
    let state = existingState;

    let sagaId: string;

    if (!state) {
      // No existing saga
      if (!canStart) {
        this.logger.debug("Message cannot start saga and no existing saga found", {
          sagaName: this.definition.name,
          messageType: message.type,
          correlationId,
        });
        return;
      }

      // Create new saga
      sagaId = generateSagaId();

      const ctx = new SagaContextImpl({
        sagaName: this.definition.name,
        sagaId,
        correlationId,
        envelope,
        transport: this.transport,
      });

      state = await this.definition.createInitialState(message, ctx);

      // Ensure metadata is set correctly, including trace context if set by middleware
      state = {
        ...state,
        metadata: {
          ...state.metadata,
          sagaId,
          version: 0,
          createdAt: now(),
          updatedAt: now(),
          isCompleted: false,
          traceParent: pipelineCtx.traceContext?.traceParent ?? null,
          traceState: pipelineCtx.traceContext?.traceState ?? null,
        },
      };

      // Insert the new saga
      await this.store.insert(this.definition.name, correlationId, state);

      this.logger.info("Created new saga instance", {
        sagaName: this.definition.name,
        sagaId,
        correlationId,
        messageType: message.type,
      });
    } else {
      sagaId = state.metadata.sagaId;
    }

    // Update pipeline context
    pipelineCtx.sagaId = sagaId;
    pipelineCtx.preState = state;

    // Check if saga is already completed
    if (state.metadata.isCompleted) {
      this.logger.debug("Ignoring message for completed saga", {
        sagaName: this.definition.name,
        sagaId,
        messageType: message.type,
      });
      return;
    }

    // Create handler context with current metadata for timeout tracking
    const ctx = new SagaContextImpl({
      sagaName: this.definition.name,
      sagaId,
      correlationId,
      envelope,
      transport: this.transport,
      defaultEndpoint: this.defaultEndpoint,
      currentMetadata: state.metadata,
    });

    // Execute handler
    const result = await this.definition.handle(message, state, ctx);

    // Determine completion
    const isCompleted = result.isCompleted ?? ctx.isCompleted;

    // Build new metadata with timeout changes
    const expectedVersion = state.metadata.version;
    const pendingTimeout = ctx.pendingTimeoutChange;

    let timeoutMs = state.metadata.timeoutMs;
    let timeoutExpiresAt = state.metadata.timeoutExpiresAt;

    if (pendingTimeout) {
      if (pendingTimeout.type === "clear") {
        timeoutMs = null;
        timeoutExpiresAt = null;
      } else if (pendingTimeout.type === "set") {
        timeoutMs = pendingTimeout.timeoutMs ?? null;
        timeoutExpiresAt = pendingTimeout.timeoutExpiresAt ?? null;
      }
    }

    // Update state with new metadata
    const newState: TState = {
      ...result.newState,
      metadata: {
        ...result.newState.metadata,
        version: expectedVersion + 1,
        updatedAt: now(),
        isCompleted,
        timeoutMs,
        timeoutExpiresAt,
      },
    };

    // Update pipeline context
    pipelineCtx.postState = newState;
    pipelineCtx.handlerResult = result;

    // Persist the updated state
    try {
      await this.store.update(this.definition.name, newState, expectedVersion);
    } catch (error) {
      if (error instanceof ConcurrencyError) {
        this.logger.warn("Concurrency conflict, message will be retried", {
          sagaName: this.definition.name,
          sagaId,
          expectedVersion,
          actualVersion: error.actualVersion,
        });
      }
      throw error;
    }

    // Schedule timeout message if timeout was set (and saga not completed)
    if (pendingTimeout?.type === "set" && !isCompleted && pendingTimeout.timeoutMs) {
      await this.scheduleTimeoutMessage(
        sagaId,
        correlationId,
        pendingTimeout.timeoutMs,
        pendingTimeout.timeoutExpiresAt ?? new Date()
      );
    }

    if (isCompleted) {
      this.logger.info("Saga completed", {
        sagaName: this.definition.name,
        sagaId,
        correlationId,
      });
    } else {
      this.logger.debug("Saga state updated", {
        sagaName: this.definition.name,
        sagaId,
        version: newState.metadata.version,
      });
    }
  }

  /**
   * Schedule a timeout message for delayed delivery.
   */
  private async scheduleTimeoutMessage(
    sagaId: string,
    correlationId: string,
    timeoutMs: number,
    timeoutExpiresAt: Date
  ): Promise<void> {
    const timeoutMessage: SagaTimeoutExpired = {
      type: SAGA_TIMEOUT_MESSAGE_TYPE,
      sagaId,
      sagaName: this.definition.name,
      correlationId,
      timeoutMs,
      timeoutSetAt: new Date(timeoutExpiresAt.getTime() - timeoutMs),
    };

    const endpoint = this.defaultEndpoint ?? SAGA_TIMEOUT_MESSAGE_TYPE;

    await this.transport.publish(timeoutMessage, {
      endpoint,
      delayMs: timeoutMs,
      key: correlationId, // Use correlation ID for ordering
    });

    this.logger.debug("Scheduled timeout message", {
      sagaName: this.definition.name,
      sagaId,
      correlationId,
      timeoutMs,
      timeoutExpiresAt: timeoutExpiresAt.toISOString(),
    });
  }

  /**
   * Get the saga name.
   */
  get name(): string {
    return this.definition.name;
  }

  /**
   * Get the handled message types.
   */
  get handledMessageTypes(): ReadonlyArray<string> {
    return this.definition.handledMessageTypes;
  }
}
