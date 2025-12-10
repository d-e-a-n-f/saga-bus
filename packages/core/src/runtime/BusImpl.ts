import type {
  Bus,
  BusConfig,
  BaseMessage,
  TransportPublishOptions,
  SagaState,
  Logger,
  ErrorHandler,
  WorkerRetryPolicy,
} from "../types/index.js";
import { SagaOrchestrator } from "./SagaOrchestrator.js";
import { MiddlewarePipeline } from "./MiddlewarePipeline.js";
import { DefaultLogger } from "./DefaultLogger.js";
import { DefaultErrorHandler } from "./DefaultErrorHandler.js";
import {
  RetryHandler,
  DEFAULT_RETRY_POLICY,
  defaultDlqNaming,
  getAttemptCount,
} from "./RetryHandler.js";

/**
 * Main bus implementation with retry and DLQ support.
 */
export class BusImpl implements Bus {
  private readonly config: BusConfig;
  private readonly logger: Logger;
  private readonly errorHandler: ErrorHandler;
  private readonly pipeline: MiddlewarePipeline;
  private readonly orchestrators: SagaOrchestrator<SagaState, BaseMessage>[];
  private readonly retryHandler: RetryHandler;
  private readonly defaultRetryPolicy: WorkerRetryPolicy;
  private started = false;

  constructor(config: BusConfig) {
    this.config = config;
    this.logger = config.logger ?? new DefaultLogger();
    this.errorHandler = config.errorHandler ?? new DefaultErrorHandler();
    this.pipeline = new MiddlewarePipeline(config.middleware ? [...config.middleware] : []);

    // Set up retry configuration
    this.defaultRetryPolicy = config.worker?.retryPolicy ?? DEFAULT_RETRY_POLICY;
    const dlqNaming = config.worker?.dlqNaming ?? defaultDlqNaming;

    this.retryHandler = new RetryHandler({
      transport: config.transport,
      logger: this.logger,
      defaultPolicy: this.defaultRetryPolicy,
      dlqNaming,
    });

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
        const endpoint = messageType;
        const subscriptionKey = endpoint;

        if (subscribed.has(subscriptionKey)) {
          continue;
        }
        subscribed.add(subscriptionKey);

        const concurrency =
          this.config.worker?.sagas?.[orchestrator.name]?.concurrency ??
          this.config.worker?.defaultConcurrency ??
          1;

        await this.config.transport.subscribe(
          { endpoint, concurrency },
          async (envelope) => {
            const handlers = this.orchestrators.filter((o) =>
              o.handledMessageTypes.includes(envelope.type)
            );

            for (const handler of handlers) {
              // Get the retry policy for this specific saga
              const retryPolicy =
                this.config.worker?.sagas?.[handler.name]?.retryPolicy ??
                this.defaultRetryPolicy;

              try {
                await handler.processMessage(envelope);
              } catch (error) {
                // Log the error
                this.logger.error("Error processing message", {
                  sagaName: handler.name,
                  messageType: envelope.type,
                  messageId: envelope.id,
                  attempt: getAttemptCount(envelope),
                  error: error instanceof Error ? error.message : String(error),
                });

                // Classify the error
                const action = await this.errorHandler.handle(error, {
                  envelope,
                  sagaName: handler.name,
                  correlationId: "",
                  metadata: {},
                  error,
                });

                if (action === "retry") {
                  await this.retryHandler.handleFailure(
                    envelope,
                    endpoint,
                    error,
                    retryPolicy
                  );
                } else if (action === "dlq") {
                  await this.retryHandler.sendToDlq(envelope, endpoint, error);
                }
                // action === "drop" means we just drop the message

                // Don't re-throw - we've handled the error
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
