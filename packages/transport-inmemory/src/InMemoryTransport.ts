import { randomUUID } from "node:crypto";
import type {
  Transport,
  TransportSubscribeOptions,
  TransportPublishOptions,
  BaseMessage,
  MessageEnvelope,
} from "@saga-bus/core";
import { Semaphore } from "./Semaphore.js";

interface Subscription<T extends BaseMessage = BaseMessage> {
  options: TransportSubscribeOptions;
  handler: (envelope: MessageEnvelope<T>) => Promise<void>;
  semaphore: Semaphore;
}

export interface InMemoryTransportOptions {
  /**
   * Default concurrency for subscriptions (default: 1)
   */
  defaultConcurrency?: number;
}

/**
 * In-memory transport implementation for testing and local development.
 * Uses a simple pub/sub pattern with concurrency control.
 */
export class InMemoryTransport implements Transport {
  private readonly subscriptions = new Map<string, Subscription[]>();
  private readonly pendingTimeouts = new Set<ReturnType<typeof setTimeout>>();
  private readonly defaultConcurrency: number;
  private started = false;

  constructor(options: InMemoryTransportOptions = {}) {
    this.defaultConcurrency = options.defaultConcurrency ?? 1;
  }

  async start(): Promise<void> {
    this.started = true;
  }

  async stop(): Promise<void> {
    this.started = false;

    // Clear all pending delayed messages
    this.pendingTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.pendingTimeouts.clear();
  }

  async subscribe<TMessage extends BaseMessage>(
    options: TransportSubscribeOptions,
    handler: (envelope: MessageEnvelope<TMessage>) => Promise<void>
  ): Promise<void> {
    const { endpoint, concurrency = this.defaultConcurrency } = options;

    const subscription: Subscription<TMessage> = {
      options,
      handler,
      semaphore: new Semaphore(concurrency),
    };

    const existing = this.subscriptions.get(endpoint);
    if (existing) {
      existing.push(subscription as Subscription);
    } else {
      this.subscriptions.set(endpoint, [subscription as Subscription]);
    }
  }

  async publish<TMessage extends BaseMessage>(
    message: TMessage,
    options: TransportPublishOptions
  ): Promise<void> {
    const { endpoint, headers = {}, delayMs } = options;

    const envelope: MessageEnvelope<TMessage> = {
      id: randomUUID(),
      type: message.type,
      payload: message,
      headers: { ...headers },
      timestamp: new Date(),
      partitionKey: options.key,
    };

    if (delayMs && delayMs > 0) {
      const timeout = setTimeout(() => {
        this.pendingTimeouts.delete(timeout);
        void this.deliverToSubscribers(endpoint, envelope);
      }, delayMs);
      this.pendingTimeouts.add(timeout);
    } else {
      // Deliver asynchronously to avoid blocking publisher
      setImmediate(() => {
        void this.deliverToSubscribers(endpoint, envelope);
      });
    }
  }

  private async deliverToSubscribers<TMessage extends BaseMessage>(
    endpoint: string,
    envelope: MessageEnvelope<TMessage>
  ): Promise<void> {
    if (!this.started) {
      return;
    }

    const subscriptions = this.subscriptions.get(endpoint);
    if (!subscriptions || subscriptions.length === 0) {
      return;
    }

    // Deliver to all subscriptions (fan-out)
    // Each subscription handles its own concurrency
    const deliveries = subscriptions.map(async (sub) => {
      await sub.semaphore.withPermit(async () => {
        try {
          await sub.handler(envelope as MessageEnvelope);
        } catch (error) {
          // In-memory transport doesn't handle errors - let them propagate
          // Real error handling is done by the bus runtime
          console.error(
            `[InMemoryTransport] Handler error for ${endpoint}:`,
            error
          );
        }
      });
    });

    await Promise.all(deliveries);
  }

  /**
   * Get the number of subscriptions for an endpoint.
   * Useful for testing.
   */
  getSubscriptionCount(endpoint: string): number {
    return this.subscriptions.get(endpoint)?.length ?? 0;
  }

  /**
   * Check if the transport is started.
   */
  get isStarted(): boolean {
    return this.started;
  }

  /**
   * Clear all subscriptions. Useful for testing.
   */
  clearSubscriptions(): void {
    this.subscriptions.clear();
  }
}
