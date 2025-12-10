import type { ModuleMetadata, Type, InjectionToken } from "@nestjs/common";
import type { Transport, SagaStore, SagaMiddleware, SagaState } from "@saga-bus/core";

/**
 * Options for configuring the SagaBusModule.
 */
export interface SagaBusModuleOptions {
  /**
   * Transport implementation for message delivery.
   */
  transport: Transport;

  /**
   * Saga store implementation for state persistence.
   */
  store: SagaStore<SagaState>;

  /**
   * Middleware pipeline for message processing.
   */
  middleware?: SagaMiddleware[];

  /**
   * Whether to automatically start the transport.
   * @default true
   */
  autoStart?: boolean;

  /**
   * Whether to automatically stop the transport on module destroy.
   * @default true
   */
  autoStop?: boolean;
}

/**
 * Factory for creating module options asynchronously.
 */
export interface SagaBusOptionsFactory {
  createSagaBusOptions():
    | Promise<SagaBusModuleOptions>
    | SagaBusModuleOptions;
}

/**
 * Async options for configuring the SagaBusModule.
 */
export interface SagaBusModuleAsyncOptions
  extends Pick<ModuleMetadata, "imports"> {
  /**
   * Factory function for creating options.
   */
  useFactory?: (
    ...args: unknown[]
  ) => Promise<SagaBusModuleOptions> | SagaBusModuleOptions;

  /**
   * Dependencies to inject into the factory.
   */
  inject?: InjectionToken[];

  /**
   * Class that implements SagaBusOptionsFactory.
   */
  useClass?: Type<SagaBusOptionsFactory>;

  /**
   * Existing provider to use.
   */
  useExisting?: Type<SagaBusOptionsFactory>;
}
