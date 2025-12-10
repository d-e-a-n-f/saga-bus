import type {
  BaseMessage,
  SagaState,
  SagaDefinition,
} from "../types/index.js";
import type {
  CorrelateOptions,
  CorrelationConfig,
  HandlerRegistration,
  InitialStateFactory,
} from "./types.js";
import { HandlerBuilder } from "./HandlerBuilder.js";
import { SagaDefinitionImpl } from "./SagaDefinitionImpl.js";

/**
 * Fluent builder for creating saga definitions.
 *
 * @example
 * ```typescript
 * const saga = createSagaMachine<OrderState, OrderMessages>()
 *   .name("OrderSaga")
 *   .correlate("OrderSubmitted", msg => msg.orderId, { canStart: true })
 *   .correlate("*", msg => msg.orderId)
 *   .initial<OrderSubmitted>((msg, ctx) => ({ ... }))
 *   .on("PaymentCaptured").when(s => s.status === "pending").handle(...)
 *   .build();
 * ```
 */
export class SagaMachineBuilder<
  TState extends SagaState,
  TMessages extends BaseMessage
> {
  private sagaName?: string;
  private readonly correlations = new Map<
    string,
    CorrelationConfig<TMessages>
  >();
  private wildcardCorrelation?: CorrelationConfig<TMessages>;
  private readonly handlers = new Map<
    string,
    Array<HandlerRegistration<TState, TMessages>>
  >();
  private initialFactory?: InitialStateFactory<TState, TMessages>;

  /**
   * Set the saga name.
   */
  name(sagaName: string): this {
    this.sagaName = sagaName;
    return this;
  }

  /**
   * Define how to correlate messages to saga instances.
   *
   * @param messageType - The message type to correlate, or "*" for wildcard
   * @param getCorrelationId - Function to extract correlation ID from message
   * @param options - Correlation options (e.g., canStart)
   */
  correlate<TType extends TMessages["type"] | "*">(
    messageType: TType,
    getCorrelationId: TType extends "*"
      ? (message: TMessages) => string | null
      : (
          message: Extract<TMessages, { type: TType }>
        ) => string | null,
    options: CorrelateOptions = {}
  ): this {
    const config: CorrelationConfig<TMessages> = {
      canStart: options.canStart ?? false,
      getCorrelationId: getCorrelationId as (
        message: TMessages
      ) => string | null,
    };

    if (messageType === "*") {
      this.wildcardCorrelation = config;
    } else {
      this.correlations.set(messageType, config);
    }

    return this;
  }

  /**
   * Define the initial state factory for new saga instances.
   *
   * @param factory - Function to create initial state from the starting message
   */
  initial<TStartMessage extends TMessages>(
    factory: InitialStateFactory<TState, TStartMessage>
  ): this {
    this.initialFactory = factory as InitialStateFactory<TState, TMessages>;
    return this;
  }

  /**
   * Start defining a handler for a specific message type.
   *
   * @param messageType - The message type to handle
   * @returns A HandlerBuilder for chaining .when() and .handle()
   */
  on<TType extends TMessages["type"]>(
    messageType: TType
  ): HandlerBuilder<TState, TMessages, Extract<TMessages, { type: TType }>> {
    return new HandlerBuilder<
      TState,
      TMessages,
      Extract<TMessages, { type: TType }>
    >(this, messageType);
  }

  /**
   * Internal method called by HandlerBuilder to register a handler.
   * @internal
   */
  _registerHandler(
    registration: HandlerRegistration<TState, TMessages>
  ): this {
    const existing = this.handlers.get(registration.messageType);
    if (existing) {
      existing.push(registration);
    } else {
      this.handlers.set(registration.messageType, [registration]);
    }
    return this;
  }

  /**
   * Build the saga definition.
   *
   * @throws Error if required configuration is missing
   */
  build(): SagaDefinition<TState, TMessages> {
    if (!this.sagaName) {
      throw new Error("Saga name is required. Call .name() before .build()");
    }

    // Validate that at least one correlation can start
    let hasStartingCorrelation = false;
    for (const config of this.correlations.values()) {
      if (config.canStart) {
        hasStartingCorrelation = true;
        break;
      }
    }
    if (this.wildcardCorrelation?.canStart) {
      hasStartingCorrelation = true;
    }

    if (!hasStartingCorrelation) {
      throw new Error(
        `Saga "${this.sagaName}" has no correlation with canStart: true`
      );
    }

    if (!this.initialFactory) {
      throw new Error(
        `Saga "${this.sagaName}" requires an initial state factory. Call .initial() before .build()`
      );
    }

    return new SagaDefinitionImpl<TState, TMessages>({
      name: this.sagaName,
      correlations: this.correlations,
      wildcardCorrelation: this.wildcardCorrelation,
      handlers: this.handlers,
      initialFactory: this.initialFactory,
    });
  }
}

/**
 * Create a new saga machine builder.
 *
 * @example
 * ```typescript
 * const saga = createSagaMachine<OrderState, OrderMessages>()
 *   .name("OrderSaga")
 *   .correlate("OrderSubmitted", msg => msg.orderId, { canStart: true })
 *   .initial<OrderSubmitted>((msg, ctx) => ({ ... }))
 *   .on("PaymentCaptured").handle(...)
 *   .build();
 * ```
 */
export function createSagaMachine<
  TState extends SagaState,
  TMessages extends BaseMessage
>(): SagaMachineBuilder<TState, TMessages> {
  return new SagaMachineBuilder<TState, TMessages>();
}
