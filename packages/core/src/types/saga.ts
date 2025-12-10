import type { BaseMessage, MessageEnvelope } from "./messages.js";
import type { TransportPublishOptions } from "./transport.js";

/**
 * Metadata tracked for every saga instance.
 */
export interface SagaStateMetadata {
  /** Unique identifier for this saga instance */
  readonly sagaId: string;
  /** Optimistic concurrency version */
  readonly version: number;
  /** When the saga was created */
  readonly createdAt: Date;
  /** When the saga was last updated */
  readonly updatedAt: Date;
  /** Whether the saga has completed */
  readonly isCompleted: boolean;
  /** When the saga was archived (if applicable) */
  readonly archivedAt?: Date | null;
}

/**
 * Base interface for saga state. All saga states must include metadata.
 */
export interface SagaState {
  readonly metadata: SagaStateMetadata;
}

/**
 * Storage interface for saga instances.
 * Implementations include in-memory, Postgres, Prisma, etc.
 */
export interface SagaStore<TState extends SagaState> {
  /**
   * Get a saga instance by its ID.
   */
  getById(sagaName: string, sagaId: string): Promise<TState | null>;

  /**
   * Get a saga instance by correlation ID.
   */
  getByCorrelationId(
    sagaName: string,
    correlationId: string
  ): Promise<TState | null>;

  /**
   * Insert a new saga instance.
   * @throws if a saga with the same ID already exists
   */
  insert(sagaName: string, state: TState): Promise<void>;

  /**
   * Update an existing saga instance with optimistic concurrency.
   * @param expectedVersion - The version the state should be at before update
   * @throws ConcurrencyError if version mismatch
   */
  update(
    sagaName: string,
    state: TState,
    expectedVersion: number
  ): Promise<void>;

  /**
   * Delete a saga instance.
   */
  delete(sagaName: string, sagaId: string): Promise<void>;
}

/**
 * Context available to saga handlers.
 */
export interface SagaContext {
  /** Name of the saga being executed */
  readonly sagaName: string;
  /** Unique ID of this saga instance */
  readonly sagaId: string;
  /** Correlation ID for this saga */
  readonly correlationId: string;
  /** The message envelope being processed */
  readonly envelope: MessageEnvelope;
  /** Arbitrary metadata for middleware/handlers */
  readonly metadata: Record<string, unknown>;

  /**
   * Publish a message to another endpoint.
   */
  publish<TMessage extends BaseMessage>(
    message: TMessage,
    options?: Partial<TransportPublishOptions>
  ): Promise<void>;

  /**
   * Schedule a message for delayed delivery.
   */
  schedule<TMessage extends BaseMessage>(
    message: TMessage,
    delayMs: number,
    options?: Partial<TransportPublishOptions>
  ): Promise<void>;

  /**
   * Mark the saga as complete.
   */
  complete(): void;

  /**
   * Set a metadata value.
   */
  setMetadata(key: string, value: unknown): void;

  /**
   * Get a metadata value.
   */
  getMetadata<T = unknown>(key: string): T | undefined;
}

/**
 * Result returned from a saga handler.
 */
export interface SagaHandlerResult<TState extends SagaState> {
  /** The updated saga state */
  readonly newState: TState;
  /** Whether the saga should be marked as complete */
  readonly isCompleted?: boolean;
}

/**
 * Correlation configuration for a message type.
 */
export interface SagaCorrelation<TMessage extends BaseMessage> {
  /** Whether this message can start a new saga instance */
  readonly canStart: boolean;
  /**
   * Extract the correlation ID from a message.
   * @returns null if the message cannot be correlated
   */
  getCorrelationId(message: TMessage): string | null;
}

/**
 * A complete saga definition produced by the DSL builder.
 */
export interface SagaDefinition<
  TState extends SagaState,
  TMessageUnion extends BaseMessage
> {
  /** Unique name for this saga */
  readonly name: string;

  /** All message types this saga handles */
  readonly handledMessageTypes: ReadonlyArray<TMessageUnion["type"]>;

  /**
   * Get correlation configuration for a message.
   */
  getCorrelation<T extends TMessageUnion>(message: T): SagaCorrelation<T>;

  /**
   * Create initial state for a new saga instance.
   */
  createInitialState<T extends TMessageUnion>(
    message: T,
    ctx: SagaContext
  ): Promise<TState>;

  /**
   * Handle a message and return the updated state.
   */
  handle<T extends TMessageUnion>(
    message: T,
    state: TState,
    ctx: SagaContext
  ): Promise<SagaHandlerResult<TState>>;
}
