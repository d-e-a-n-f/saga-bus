import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
} from "@nestjs/common";
import type {
  Transport,
  SagaStore,
  SagaMiddleware,
  SagaState,
  BaseMessage,
  TransportPublishOptions,
} from "@saga-bus/core";
import type { SagaBusModuleOptions } from "./interfaces/module-options.interface.js";

export const SAGA_BUS_OPTIONS = "SAGA_BUS_OPTIONS";

/**
 * Service for interacting with the saga bus.
 *
 * Provides access to transport and store, and handles
 * lifecycle management (auto start/stop).
 */
@Injectable()
export class SagaBusService implements OnModuleInit, OnModuleDestroy {
  private readonly transport: Transport;
  private readonly store: SagaStore<SagaState>;
  private readonly middleware: SagaMiddleware[];
  private readonly autoStart: boolean;
  private readonly autoStop: boolean;

  constructor(@Inject(SAGA_BUS_OPTIONS) options: SagaBusModuleOptions) {
    this.transport = options.transport;
    this.store = options.store;
    this.middleware = options.middleware ?? [];
    this.autoStart = options.autoStart ?? true;
    this.autoStop = options.autoStop ?? true;
  }

  async onModuleInit(): Promise<void> {
    if (this.autoStart) {
      await this.transport.start();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.autoStop) {
      await this.transport.stop();
    }
  }

  /**
   * Publish a message to the transport.
   */
  async publish<TMessage extends BaseMessage>(
    message: TMessage,
    options: TransportPublishOptions
  ): Promise<void> {
    await this.transport.publish(message, options);
  }

  /**
   * Get the underlying transport.
   */
  getTransport(): Transport {
    return this.transport;
  }

  /**
   * Get the underlying store.
   */
  getStore(): SagaStore<SagaState> {
    return this.store;
  }

  /**
   * Get the middleware pipeline.
   */
  getMiddleware(): SagaMiddleware[] {
    return this.middleware;
  }
}
