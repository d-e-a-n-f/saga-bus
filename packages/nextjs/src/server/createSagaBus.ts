import type {
  Transport,
  SagaStore,
  SagaState,
  SagaMiddleware,
  BaseMessage,
  TransportPublishOptions,
} from "@saga-bus/core";

/**
 * Saga bus configuration options.
 */
export interface SagaBusConfig {
  /**
   * Transport implementation.
   */
  transport: Transport;

  /**
   * Saga store implementation.
   */
  store: SagaStore<SagaState>;

  /**
   * Middleware pipeline.
   */
  middleware?: SagaMiddleware[];

  /**
   * Default endpoint for publishing messages.
   * @default "saga-bus"
   */
  defaultEndpoint?: string;
}

/**
 * Saga bus instance for Next.js.
 */
export interface SagaBus {
  /**
   * Publish a message.
   */
  publish<TMessage extends BaseMessage>(
    message: TMessage,
    options?: Partial<TransportPublishOptions>
  ): Promise<void>;

  /**
   * Get saga state by ID.
   */
  getState<T extends SagaState>(
    sagaName: string,
    sagaId: string
  ): Promise<T | null>;

  /**
   * Get saga state by correlation ID.
   */
  getStateByCorrelation<T extends SagaState>(
    sagaName: string,
    correlationId: string
  ): Promise<T | null>;

  /**
   * Start the transport.
   */
  start(): Promise<void>;

  /**
   * Stop the transport.
   */
  stop(): Promise<void>;

  /**
   * Get the underlying transport.
   */
  getTransport(): Transport;

  /**
   * Get the underlying store.
   */
  getStore(): SagaStore<SagaState>;
}

let initialized = false;

/**
 * Create a saga bus instance for Next.js.
 *
 * @example
 * ```typescript
 * // lib/saga-bus.ts
 * import { createSagaBus } from "@saga-bus/nextjs/server";
 *
 * export const sagaBus = createSagaBus({
 *   transport: new InMemoryTransport(),
 *   store: new InMemorySagaStore(),
 * });
 * ```
 */
export function createSagaBus(config: SagaBusConfig): SagaBus {
  const { transport, store, defaultEndpoint = "saga-bus" } = config;

  // Auto-start in non-edge environments
  if (
    typeof globalThis !== "undefined" &&
    !("EdgeRuntime" in globalThis) &&
    !initialized
  ) {
    initialized = true;
    transport.start().catch(console.error);
  }

  return {
    async publish<TMessage extends BaseMessage>(
      message: TMessage,
      options?: Partial<TransportPublishOptions>
    ): Promise<void> {
      await transport.publish(message, {
        endpoint: defaultEndpoint,
        ...options,
      });
    },

    async getState<T extends SagaState>(
      sagaName: string,
      sagaId: string
    ): Promise<T | null> {
      return store.getById(sagaName, sagaId) as Promise<T | null>;
    },

    async getStateByCorrelation<T extends SagaState>(
      sagaName: string,
      correlationId: string
    ): Promise<T | null> {
      return store.getByCorrelationId(sagaName, correlationId) as Promise<
        T | null
      >;
    },

    async start(): Promise<void> {
      await transport.start();
    },

    async stop(): Promise<void> {
      await transport.stop();
    },

    getTransport(): Transport {
      return transport;
    },

    getStore(): SagaStore<SagaState> {
      return store;
    },
  };
}

/**
 * Get saga state helper for server components.
 */
export async function getSagaState<T extends SagaState>(
  bus: SagaBus,
  sagaName: string,
  sagaId: string
): Promise<T | null> {
  return bus.getState<T>(sagaName, sagaId);
}
