import type {
  BaseMessage,
  SagaState,
  SagaDefinition,
  Bus,
  SagaStore,
} from "@saga-bus/core";
import { createBus } from "@saga-bus/core";
import { InMemoryTransport } from "@saga-bus/transport-inmemory";
import { InMemorySagaStore } from "@saga-bus/store-inmemory";

/**
 * Options for creating a TestHarness.
 */
export interface TestHarnessOptions<
  TState extends SagaState,
  TMessages extends BaseMessage
> {
  /**
   * Saga definitions to register with the test bus.
   */
  sagas: SagaDefinition<TState, TMessages>[];

  /**
   * Optional custom stores per saga (by name).
   * If not provided, an InMemorySagaStore is created.
   */
  stores?: Record<string, SagaStore<TState>>;
}

/**
 * A captured published message.
 */
export interface CapturedMessage<T extends BaseMessage = BaseMessage> {
  message: T;
  endpoint: string;
  timestamp: Date;
}

/**
 * Test harness for saga testing.
 * Provides an isolated environment with in-memory transport and stores.
 *
 * @example
 * ```typescript
 * const harness = await TestHarness.create({ sagas: [orderSaga] });
 *
 * await harness.publish({ type: "OrderSubmitted", orderId: "123" });
 *
 * const state = await harness.getSagaState("OrderSaga", "123");
 * expect(state?.status).toBe("submitted");
 *
 * const messages = harness.getPublishedMessages();
 * expect(messages).toContainEqual(expect.objectContaining({ type: "OrderCreated" }));
 * ```
 */
export class TestHarness<
  TState extends SagaState,
  TMessages extends BaseMessage
> {
  private readonly bus: Bus;
  private readonly transport: InMemoryTransport;
  private readonly stores: Map<string, InMemorySagaStore<TState>>;
  private readonly capturedMessages: CapturedMessage<TMessages>[] = [];

  private constructor(
    bus: Bus,
    transport: InMemoryTransport,
    stores: Map<string, InMemorySagaStore<TState>>
  ) {
    this.bus = bus;
    this.transport = transport;
    this.stores = stores;
  }

  /**
   * Create a new test harness.
   */
  static async create<TState extends SagaState, TMessages extends BaseMessage>(
    options: TestHarnessOptions<TState, TMessages>
  ): Promise<TestHarness<TState, TMessages>> {
    const transport = new InMemoryTransport({ defaultConcurrency: 1 });
    const stores = new Map<string, InMemorySagaStore<TState>>();

    // Create registrations
    const registrations = options.sagas.map((definition) => {
      // Use provided store or create new one
      let store: SagaStore<TState>;
      if (options.stores?.[definition.name]) {
        store = options.stores[definition.name]!;
      } else {
        const memStore = new InMemorySagaStore<TState>();
        stores.set(definition.name, memStore);
        store = memStore;
      }

      return {
        definition,
        store,
      };
    });

    const bus = createBus({
      transport,
      sagas: registrations,
      // Disable retries in tests - fail fast, surface errors immediately
      worker: {
        retryPolicy: {
          maxAttempts: 1,
          baseDelayMs: 0,
          maxDelayMs: 0,
          backoff: "linear",
        },
      },
    });

    const harness = new TestHarness<TState, TMessages>(bus, transport, stores);

    // Start the bus
    await bus.start();

    return harness;
  }

  /**
   * Publish a message to the bus.
   * Waits for message processing to complete.
   */
  async publish<T extends TMessages>(
    message: T,
    options?: { endpoint?: string }
  ): Promise<void> {
    const endpoint = options?.endpoint ?? message.type;

    // Capture the message
    this.capturedMessages.push({
      message: message as TMessages,
      endpoint,
      timestamp: new Date(),
    });

    // Publish through the bus
    await this.bus.publish(message, { endpoint });

    // Small delay to ensure async processing completes
    await this.flush();
  }

  /**
   * Get a saga state by saga name and correlation/saga ID.
   *
   * @param sagaName - Name of the saga
   * @param id - Either the saga ID or correlation ID
   */
  async getSagaState(sagaName: string, id: string): Promise<TState | null> {
    const store = this.stores.get(sagaName);
    if (!store) {
      throw new Error(`No store found for saga "${sagaName}"`);
    }

    // Try by correlation ID first
    let state = await store.getByCorrelationId(sagaName, id);
    if (state) {
      return state;
    }

    // Fall back to saga ID
    state = await store.getById(sagaName, id);
    return state;
  }

  /**
   * Get all saga states for a given saga name.
   */
  getAllSagaStates(sagaName: string): TState[] {
    const store = this.stores.get(sagaName);
    if (!store) {
      throw new Error(`No store found for saga "${sagaName}"`);
    }

    return store.getAll();
  }

  /**
   * Get all messages that were published during the test.
   */
  getPublishedMessages(): CapturedMessage<TMessages>[] {
    return [...this.capturedMessages];
  }

  /**
   * Get published messages filtered by type.
   */
  getPublishedMessagesByType<T extends TMessages["type"]>(
    type: T
  ): CapturedMessage<Extract<TMessages, { type: T }>>[] {
    return this.capturedMessages.filter(
      (m) => m.message.type === type
    ) as CapturedMessage<Extract<TMessages, { type: T }>>[];
  }

  /**
   * Clear captured messages.
   */
  clearPublishedMessages(): void {
    this.capturedMessages.length = 0;
  }

  /**
   * Reset the harness state (clears all stores and captured messages).
   */
  reset(): void {
    for (const store of this.stores.values()) {
      store.clear();
    }
    this.capturedMessages.length = 0;
  }

  /**
   * Wait for any pending async operations to complete.
   */
  async flush(delayMs = 10): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  /**
   * Stop the test harness.
   */
  async stop(): Promise<void> {
    await this.bus.stop();
  }

  /**
   * Get the underlying bus instance.
   */
  getBus(): Bus {
    return this.bus;
  }

  /**
   * Get the underlying transport.
   */
  getTransport(): InMemoryTransport {
    return this.transport;
  }

  /**
   * Get the store for a specific saga.
   */
  getStore(sagaName: string): InMemorySagaStore<TState> | undefined {
    return this.stores.get(sagaName);
  }
}
