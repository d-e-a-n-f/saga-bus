import { describe, it, expect, beforeEach, vi } from "vitest";
import type {
  BaseMessage,
  SagaState,
  SagaStateMetadata,
} from "../../types/index.js";
import { createSagaMachine } from "../../dsl/index.js";
import { createBus } from "../BusImpl.js";

// Mock InMemoryTransport
class MockTransport {
  private handlers = new Map<string, Array<(envelope: unknown) => Promise<void>>>();
  started = false;

  async start() {
    this.started = true;
  }

  async stop() {
    this.started = false;
  }

  async subscribe(
    options: { endpoint: string },
    handler: (envelope: unknown) => Promise<void>
  ) {
    const existing = this.handlers.get(options.endpoint) ?? [];
    existing.push(handler);
    this.handlers.set(options.endpoint, existing);
  }

  async publish(message: BaseMessage, options: { endpoint: string }) {
    const handlers = this.handlers.get(options.endpoint) ?? [];
    const envelope = {
      id: "msg-" + Math.random(),
      type: message.type,
      payload: message,
      headers: {},
      timestamp: new Date(),
    };

    for (const handler of handlers) {
      await handler(envelope);
    }
  }
}

// Mock InMemorySagaStore
class MockStore<T extends SagaState> {
  private store = new Map<string, T>();
  private correlationIndex = new Map<string, string>();

  async getById(sagaName: string, sagaId: string): Promise<T | null> {
    return this.store.get(`${sagaName}:${sagaId}`) ?? null;
  }

  async getByCorrelationId(sagaName: string, correlationId: string): Promise<T | null> {
    const sagaId = this.correlationIndex.get(`${sagaName}:${correlationId}`);
    if (!sagaId) return null;
    return this.getById(sagaName, sagaId);
  }

  async insert(sagaName: string, state: T): Promise<void> {
    this.store.set(`${sagaName}:${state.metadata.sagaId}`, { ...state });
  }

  indexByCorrelationId(sagaName: string, correlationId: string, sagaId: string): void {
    this.correlationIndex.set(`${sagaName}:${correlationId}`, sagaId);
  }

  async update(sagaName: string, state: T, expectedVersion: number): Promise<void> {
    const key = `${sagaName}:${state.metadata.sagaId}`;
    const existing = this.store.get(key);
    if (!existing || existing.metadata.version !== expectedVersion) {
      throw new Error("Concurrency error");
    }
    this.store.set(key, { ...state });
  }

  async delete(sagaName: string, sagaId: string): Promise<void> {
    this.store.delete(`${sagaName}:${sagaId}`);
  }
}

// Test types
interface OrderSubmitted extends BaseMessage {
  type: "OrderSubmitted";
  orderId: string;
}

interface PaymentReceived extends BaseMessage {
  type: "PaymentReceived";
  orderId: string;
  amount: number;
}

type OrderMessages = OrderSubmitted | PaymentReceived;

interface OrderState extends SagaState {
  metadata: SagaStateMetadata;
  orderId: string;
  status: "submitted" | "paid";
  amount?: number;
}

// Silent logger for tests
const silentLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe("BusImpl", () => {
  let transport: MockTransport;
  let store: MockStore<OrderState>;

  beforeEach(() => {
    transport = new MockTransport();
    store = new MockStore<OrderState>();
    vi.clearAllMocks();
  });

  it("should start and stop", async () => {
    const bus = createBus({
      transport: transport as never,
      sagas: [],
      logger: silentLogger,
    });

    expect(bus.isRunning()).toBe(false);

    await bus.start();
    expect(transport.started).toBe(true);
    expect(bus.isRunning()).toBe(true);

    await bus.stop();
    expect(transport.started).toBe(false);
    expect(bus.isRunning()).toBe(false);
  });

  it("should create saga on starting message", async () => {
    const saga = createSagaMachine<OrderState, OrderMessages>()
      .name("OrderSaga")
      .correlate("OrderSubmitted", (msg) => msg.orderId, { canStart: true })
      .initial<OrderSubmitted>((msg, ctx) => ({
        metadata: {
          sagaId: ctx.sagaId,
          version: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          isCompleted: false,
        },
        orderId: msg.orderId,
        status: "submitted",
      }))
      .build();

    const bus = createBus({
      transport: transport as never,
      sagas: [{ definition: saga, store: store as never }],
      logger: silentLogger,
    });

    await bus.start();

    // Publish a starting message
    await bus.publish({ type: "OrderSubmitted", orderId: "order-123" });

    // Check that saga was created
    const state = await store.getByCorrelationId("OrderSaga", "order-123");
    expect(state).not.toBeNull();
    expect(state?.orderId).toBe("order-123");
    expect(state?.status).toBe("submitted");

    await bus.stop();
  });

  it("should update saga on subsequent messages", async () => {
    const saga = createSagaMachine<OrderState, OrderMessages>()
      .name("OrderSaga")
      .correlate("OrderSubmitted", (msg) => msg.orderId, { canStart: true })
      .correlate("*", (msg) => msg.orderId)
      .initial<OrderSubmitted>((msg, ctx) => ({
        metadata: {
          sagaId: ctx.sagaId,
          version: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          isCompleted: false,
        },
        orderId: msg.orderId,
        status: "submitted",
      }))
      .on("PaymentReceived")
      .handle(async (msg, state) => ({
        newState: {
          ...state,
          status: "paid",
          amount: msg.amount,
        },
      }))
      .build();

    const bus = createBus({
      transport: transport as never,
      sagas: [{ definition: saga, store: store as never }],
      logger: silentLogger,
    });

    await bus.start();

    // Create saga
    await bus.publish({ type: "OrderSubmitted", orderId: "order-123" });

    // Update saga
    await bus.publish({
      type: "PaymentReceived",
      orderId: "order-123",
      amount: 99.99,
    });

    const state = await store.getByCorrelationId("OrderSaga", "order-123");
    expect(state?.status).toBe("paid");
    expect(state?.amount).toBe(99.99);
    expect(state?.metadata.version).toBe(2); // Initial + update

    await bus.stop();
  });

  it("should complete saga when complete() is called", async () => {
    const saga = createSagaMachine<OrderState, OrderMessages>()
      .name("OrderSaga")
      .correlate("OrderSubmitted", (msg) => msg.orderId, { canStart: true })
      .correlate("*", (msg) => msg.orderId)
      .initial<OrderSubmitted>((msg, ctx) => ({
        metadata: {
          sagaId: ctx.sagaId,
          version: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          isCompleted: false,
        },
        orderId: msg.orderId,
        status: "submitted",
      }))
      .on("PaymentReceived")
      .handle(async (msg, state, ctx) => {
        ctx.complete();
        return {
          newState: { ...state, status: "paid", amount: msg.amount },
        };
      })
      .build();

    const bus = createBus({
      transport: transport as never,
      sagas: [{ definition: saga, store: store as never }],
      logger: silentLogger,
    });

    await bus.start();

    await bus.publish({ type: "OrderSubmitted", orderId: "order-123" });
    await bus.publish({
      type: "PaymentReceived",
      orderId: "order-123",
      amount: 50,
    });

    const state = await store.getByCorrelationId("OrderSaga", "order-123");
    expect(state?.metadata.isCompleted).toBe(true);

    await bus.stop();
  });

  it("should execute middleware", async () => {
    const middlewareCalls: string[] = [];

    const saga = createSagaMachine<OrderState, OrderMessages>()
      .name("OrderSaga")
      .correlate("OrderSubmitted", (msg) => msg.orderId, { canStart: true })
      .initial<OrderSubmitted>((msg, ctx) => ({
        metadata: {
          sagaId: ctx.sagaId,
          version: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          isCompleted: false,
        },
        orderId: msg.orderId,
        status: "submitted",
      }))
      .build();

    const bus = createBus({
      transport: transport as never,
      sagas: [{ definition: saga, store: store as never }],
      logger: silentLogger,
      middleware: [
        async (_ctx, next) => {
          middlewareCalls.push("before");
          await next();
          middlewareCalls.push("after");
        },
      ],
    });

    await bus.start();
    await bus.publish({ type: "OrderSubmitted", orderId: "order-123" });

    expect(middlewareCalls).toEqual(["before", "after"]);

    await bus.stop();
  });

  it("should not start saga for non-starting message", async () => {
    const saga = createSagaMachine<OrderState, OrderMessages>()
      .name("OrderSaga")
      .correlate("OrderSubmitted", (msg) => msg.orderId, { canStart: true })
      .correlate("PaymentReceived", (msg) => msg.orderId) // canStart: false
      .initial<OrderSubmitted>((msg, ctx) => ({
        metadata: {
          sagaId: ctx.sagaId,
          version: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          isCompleted: false,
        },
        orderId: msg.orderId,
        status: "submitted",
      }))
      .on("PaymentReceived")
      .handle(async (msg, state) => ({
        newState: { ...state, status: "paid", amount: msg.amount },
      }))
      .build();

    const bus = createBus({
      transport: transport as never,
      sagas: [{ definition: saga, store: store as never }],
      logger: silentLogger,
    });

    await bus.start();

    // Try to start with PaymentReceived (should not create saga)
    await bus.publish({
      type: "PaymentReceived",
      orderId: "order-123",
      amount: 50,
    });

    const state = await store.getByCorrelationId("OrderSaga", "order-123");
    expect(state).toBeNull();

    await bus.stop();
  });

  it("should ignore messages for completed sagas", async () => {
    const handlerCalls: string[] = [];

    const saga = createSagaMachine<OrderState, OrderMessages>()
      .name("OrderSaga")
      .correlate("OrderSubmitted", (msg) => msg.orderId, { canStart: true })
      .correlate("*", (msg) => msg.orderId)
      .initial<OrderSubmitted>((msg, ctx) => ({
        metadata: {
          sagaId: ctx.sagaId,
          version: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          isCompleted: false,
        },
        orderId: msg.orderId,
        status: "submitted",
      }))
      .on("PaymentReceived")
      .handle(async (msg, state, ctx) => {
        handlerCalls.push("PaymentReceived");
        ctx.complete();
        return {
          newState: { ...state, status: "paid", amount: msg.amount },
        };
      })
      .build();

    const bus = createBus({
      transport: transport as never,
      sagas: [{ definition: saga, store: store as never }],
      logger: silentLogger,
    });

    await bus.start();

    await bus.publish({ type: "OrderSubmitted", orderId: "order-123" });
    await bus.publish({ type: "PaymentReceived", orderId: "order-123", amount: 50 });

    // Handler called once
    expect(handlerCalls).toEqual(["PaymentReceived"]);

    // Send another payment (should be ignored)
    await bus.publish({ type: "PaymentReceived", orderId: "order-123", amount: 100 });

    // Handler still only called once
    expect(handlerCalls).toEqual(["PaymentReceived"]);

    await bus.stop();
  });
});
