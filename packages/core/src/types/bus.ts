import type { BaseMessage } from "./messages.js";
import type { Transport, TransportPublishOptions } from "./transport.js";
import type { SagaDefinition, SagaState, SagaStore } from "./saga.js";
import type { SagaMiddleware } from "./middleware.js";
import type { Logger, Metrics, Tracer, ErrorHandler } from "./observability.js";

/**
 * Registration of a saga with its store.
 */
export interface SagaRegistration<
  TState extends SagaState,
  TMessageUnion extends BaseMessage
> {
  readonly definition: SagaDefinition<TState, TMessageUnion>;
  /** Store for this saga. If not provided, uses the default store from BusConfig. */
  readonly store?: SagaStore<TState>;
}

/**
 * Retry policy configuration.
 */
export interface WorkerRetryPolicy {
  /** Maximum number of attempts before sending to DLQ */
  readonly maxAttempts: number;
  /** Base delay between retries in milliseconds */
  readonly baseDelayMs: number;
  /** Maximum delay between retries in milliseconds */
  readonly maxDelayMs: number;
  /** Backoff strategy */
  readonly backoff: "linear" | "exponential";
}

/**
 * Worker configuration for message processing.
 */
export interface WorkerConfig {
  /** Default concurrency for all subscriptions */
  readonly defaultConcurrency?: number;
  /** Timeout for graceful shutdown in milliseconds */
  readonly shutdownTimeoutMs?: number;
  /** Default retry policy */
  readonly retryPolicy?: WorkerRetryPolicy;
  /** Per-saga configuration overrides */
  readonly sagas?: Record<
    string,
    {
      readonly concurrency?: number;
      readonly retryPolicy?: WorkerRetryPolicy;
    }
  >;
  /** Function to generate DLQ endpoint names */
  readonly dlqNaming?: (endpoint: string) => string;
}

/**
 * Configuration for creating a bus instance.
 */
export interface BusConfig {
  /** Transport implementation */
  readonly transport: Transport;
  /** Default store for all sagas. Can be overridden per-saga in the registration. */
  readonly store?: SagaStore<SagaState>;
  /** Registered sagas */
  readonly sagas: ReadonlyArray<SagaRegistration<SagaState, BaseMessage>>;
  /** Middleware pipeline */
  readonly middleware?: ReadonlyArray<SagaMiddleware>;
  /** Logger implementation */
  readonly logger?: Logger;
  /** Metrics implementation */
  readonly metrics?: Metrics;
  /** Tracer implementation */
  readonly tracer?: Tracer;
  /** Error handler implementation */
  readonly errorHandler?: ErrorHandler;
  /** Worker configuration */
  readonly worker?: WorkerConfig;
}

/**
 * The main bus interface for publishing messages.
 */
export interface Bus {
  /**
   * Start the bus (connect transport, subscribe to endpoints).
   */
  start(): Promise<void>;

  /**
   * Stop the bus (graceful shutdown).
   */
  stop(): Promise<void>;

  /**
   * Check if the bus is running.
   */
  isRunning(): boolean;

  /**
   * Publish a message.
   */
  publish<TMessage extends BaseMessage>(
    message: TMessage,
    options?: Partial<TransportPublishOptions>
  ): Promise<void>;
}
