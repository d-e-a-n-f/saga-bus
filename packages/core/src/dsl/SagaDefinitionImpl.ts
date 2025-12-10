import type {
  BaseMessage,
  SagaState,
  SagaContext,
  SagaCorrelation,
  SagaDefinition,
  SagaHandlerResult,
} from "../types/index.js";
import type {
  CorrelationConfig,
  HandlerRegistration,
  InitialStateFactory,
} from "./types.js";

/**
 * Concrete implementation of SagaDefinition produced by the builder.
 */
export class SagaDefinitionImpl<
  TState extends SagaState,
  TMessages extends BaseMessage
> implements SagaDefinition<TState, TMessages>
{
  readonly name: string;
  readonly handledMessageTypes: ReadonlyArray<TMessages["type"]>;

  private readonly correlations: Map<string, CorrelationConfig<TMessages>>;
  private readonly wildcardCorrelation?: CorrelationConfig<TMessages>;
  private readonly handlers: Map<
    string,
    Array<HandlerRegistration<TState, TMessages>>
  >;
  private readonly initialFactory?: InitialStateFactory<TState, TMessages>;

  constructor(config: {
    name: string;
    correlations: Map<string, CorrelationConfig<TMessages>>;
    wildcardCorrelation?: CorrelationConfig<TMessages>;
    handlers: Map<string, Array<HandlerRegistration<TState, TMessages>>>;
    initialFactory?: InitialStateFactory<TState, TMessages>;
  }) {
    this.name = config.name;
    this.correlations = config.correlations;
    this.wildcardCorrelation = config.wildcardCorrelation;
    this.handlers = config.handlers;
    this.initialFactory = config.initialFactory;

    // Collect all handled message types
    const types = new Set<string>();
    for (const type of this.correlations.keys()) {
      types.add(type);
    }
    for (const type of this.handlers.keys()) {
      types.add(type);
    }
    this.handledMessageTypes = Array.from(types) as TMessages["type"][];
  }

  getCorrelation<T extends TMessages>(message: T): SagaCorrelation<T> {
    // Try specific correlation first
    const specific = this.correlations.get(message.type);
    if (specific) {
      return {
        canStart: specific.canStart,
        getCorrelationId: (msg: T) =>
          (specific.getCorrelationId as (m: T) => string | null)(msg),
      };
    }

    // Fall back to wildcard
    if (this.wildcardCorrelation) {
      return {
        canStart: this.wildcardCorrelation.canStart,
        getCorrelationId: (msg: T) =>
          (this.wildcardCorrelation!.getCorrelationId as (m: T) => string | null)(msg),
      };
    }

    // No correlation found - return a non-starting, non-correlating result
    return {
      canStart: false,
      getCorrelationId: () => null,
    };
  }

  async createInitialState<T extends TMessages>(
    message: T,
    ctx: SagaContext
  ): Promise<TState> {
    if (!this.initialFactory) {
      throw new Error(
        `No initial state factory defined for saga "${this.name}"`
      );
    }

    return this.initialFactory(message as TMessages, ctx);
  }

  async handle<T extends TMessages>(
    message: T,
    state: TState,
    ctx: SagaContext
  ): Promise<SagaHandlerResult<TState>> {
    const registrations = this.handlers.get(message.type);

    if (!registrations || registrations.length === 0) {
      // No handlers for this message type - return state unchanged
      return { newState: state };
    }

    // Find the first handler whose guard passes (or has no guard)
    for (const registration of registrations) {
      if (!registration.guard || registration.guard(state)) {
        return registration.handler(message as TMessages, state, ctx);
      }
    }

    // No handler matched (all guards failed) - return state unchanged
    return { newState: state };
  }
}
