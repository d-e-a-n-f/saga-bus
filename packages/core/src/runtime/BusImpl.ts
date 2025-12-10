import type {
  Bus,
  BusConfig,
  BaseMessage,
  TransportPublishOptions,
  SagaState,
  Logger,
} from "../types/index.js";
import { SagaOrchestrator } from "./SagaOrchestrator.js";
import { MiddlewarePipeline } from "./MiddlewarePipeline.js";
import { DefaultLogger } from "./DefaultLogger.js";

/**
 * Main bus implementation.
 */
export class BusImpl implements Bus {
  private readonly config: BusConfig;
  private readonly logger: Logger;
  private readonly pipeline: MiddlewarePipeline;
  private readonly orchestrators: SagaOrchestrator<SagaState, BaseMessage>[];
  private started = false;

  constructor(config: BusConfig) {
    this.config = config;
    this.logger = config.logger ?? new DefaultLogger();
    this.pipeline = new MiddlewarePipeline(config.middleware ? [...config.middleware] : []);

    // Create orchestrators for each registered saga
    this.orchestrators = config.sagas.map((registration) => {
      return new SagaOrchestrator({
        definition: registration.definition,
        store: registration.store,
        transport: config.transport,
        pipeline: this.pipeline,
        logger: this.logger,
      });
    });
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    this.logger.info("Starting saga bus...");

    // Start the transport
    await this.config.transport.start();

    // Subscribe to endpoints for each saga's message types
    const subscribed = new Set<string>();

    for (const orchestrator of this.orchestrators) {
      for (const messageType of orchestrator.handledMessageTypes) {
        // Use message type as endpoint (can be customized later)
        const endpoint = messageType;

        // Avoid duplicate subscriptions if multiple sagas handle same message
        const subscriptionKey = `${endpoint}`;
        if (subscribed.has(subscriptionKey)) {
          continue;
        }
        subscribed.add(subscriptionKey);

        const concurrency =
          this.config.worker?.sagas?.[orchestrator.name]?.concurrency ??
          this.config.worker?.defaultConcurrency ??
          1;

        await this.config.transport.subscribe(
          {
            endpoint,
            concurrency,
          },
          async (envelope) => {
            // Find all orchestrators that handle this message type
            const handlers = this.orchestrators.filter((o) =>
              o.handledMessageTypes.includes(envelope.type)
            );

            // Process through each orchestrator
            for (const handler of handlers) {
              try {
                await handler.processMessage(envelope);
              } catch (error) {
                this.logger.error("Error processing message", {
                  sagaName: handler.name,
                  messageType: envelope.type,
                  messageId: envelope.id,
                  error: error instanceof Error ? error.message : String(error),
                });
                // Re-throw for transport to handle (retry/DLQ)
                throw error;
              }
            }
          }
        );

        this.logger.debug("Subscribed to endpoint", {
          endpoint,
          messageType,
          concurrency,
        });
      }
    }

    this.started = true;
    this.logger.info("Saga bus started", {
      sagaCount: this.orchestrators.length,
      endpointCount: subscribed.size,
    });
  }

  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    this.logger.info("Stopping saga bus...");

    // Stop the transport (handles graceful shutdown)
    await this.config.transport.stop();

    this.started = false;
    this.logger.info("Saga bus stopped");
  }

  isRunning(): boolean {
    return this.started;
  }

  async publish<TMessage extends BaseMessage>(
    message: TMessage,
    options?: Partial<TransportPublishOptions>
  ): Promise<void> {
    const endpoint = options?.endpoint ?? message.type;

    await this.config.transport.publish(message, {
      endpoint,
      ...options,
    });
  }
}

/**
 * Create a new bus instance.
 */
export function createBus(config: BusConfig): Bus {
  return new BusImpl(config);
}
