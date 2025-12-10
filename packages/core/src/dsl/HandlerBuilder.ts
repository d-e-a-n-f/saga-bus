import type { BaseMessage, SagaState } from "../types/index.js";
import type {
  SagaHandler,
  StateGuard,
  HandlerRegistration,
} from "./types.js";
import type { SagaMachineBuilder } from "./SagaMachineBuilder.js";

/**
 * Builder for configuring a message handler with optional state guards.
 */
export class HandlerBuilder<
  TState extends SagaState,
  TMessages extends BaseMessage,
  TCurrentMessage extends TMessages
> {
  private guard?: StateGuard<TState>;

  constructor(
    private readonly parent: SagaMachineBuilder<TState, TMessages>,
    private readonly messageType: TCurrentMessage["type"]
  ) {}

  /**
   * Add a state guard that must pass for the handler to execute.
   * Multiple guards can be chained with multiple .when() calls.
   */
  when(
    guard: StateGuard<TState>
  ): HandlerBuilder<TState, TMessages, TCurrentMessage> {
    if (this.guard) {
      // Chain guards with AND logic
      const existingGuard = this.guard;
      this.guard = (state) => existingGuard(state) && guard(state);
    } else {
      this.guard = guard;
    }
    return this;
  }

  /**
   * Register the handler function and return to the parent builder.
   */
  handle(
    handler: SagaHandler<TState, TCurrentMessage>
  ): SagaMachineBuilder<TState, TMessages> {
    const registration: HandlerRegistration<TState, TCurrentMessage> = {
      messageType: this.messageType,
      guard: this.guard,
      handler,
    };

    return this.parent._registerHandler(
      registration as HandlerRegistration<TState, TMessages>
    );
  }
}
