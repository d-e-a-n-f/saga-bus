import { describe, it, expect, vi } from "vitest";
import type {
  BaseMessage,
  SagaState,
  SagaStateMetadata,
  SagaContext,
} from "../../types/index.js";
import { createSagaMachine } from "../SagaMachineBuilder.js";

// Test message types
interface OrderSubmitted extends BaseMessage {
  type: "OrderSubmitted";
  orderId: string;
  customerId: string;
}

interface PaymentCaptured extends BaseMessage {
  type: "PaymentCaptured";
  orderId: string;
  amount: number;
}

interface OrderShipped extends BaseMessage {
  type: "OrderShipped";
  orderId: string;
  trackingNumber: string;
}

type OrderMessages = OrderSubmitted | PaymentCaptured | OrderShipped;

// Test state
interface OrderState extends SagaState {
  metadata: SagaStateMetadata;
  orderId: string;
  customerId: string;
  status: "submitted" | "paid" | "shipped";
  amount?: number;
  trackingNumber?: string;
}

// Mock context factory
function createMockContext(overrides: Partial<SagaContext> = {}): SagaContext {
  return {
    sagaName: "TestSaga",
    sagaId: "test-saga-id",
    correlationId: "test-correlation-id",
    envelope: {
      id: "msg-1",
      type: "TestMessage",
      payload: { type: "TestMessage" },
      headers: {},
      timestamp: new Date(),
    },
    metadata: {},
    publish: vi.fn(),
    schedule: vi.fn(),
    complete: vi.fn(),
    setMetadata: vi.fn(),
    getMetadata: vi.fn(),
    ...overrides,
  };
}

describe("createSagaMachine", () => {
  describe("builder validation", () => {
    it("should throw if name is not set", () => {
      expect(() =>
        createSagaMachine<OrderState, OrderMessages>()
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
            customerId: msg.customerId,
            status: "submitted",
          }))
          .build()
      ).toThrow("Saga name is required");
    });

    it("should throw if no canStart correlation exists", () => {
      expect(() =>
        createSagaMachine<OrderState, OrderMessages>()
          .name("OrderSaga")
          .correlate("OrderSubmitted", (msg) => msg.orderId) // No canStart
          .initial<OrderSubmitted>((msg, ctx) => ({
            metadata: {
              sagaId: ctx.sagaId,
              version: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
              isCompleted: false,
            },
            orderId: msg.orderId,
            customerId: msg.customerId,
            status: "submitted",
          }))
          .build()
      ).toThrow("no correlation with canStart");
    });

    it("should throw if initial factory is not set", () => {
      expect(() =>
        createSagaMachine<OrderState, OrderMessages>()
          .name("OrderSaga")
          .correlate("OrderSubmitted", (msg) => msg.orderId, { canStart: true })
          .build()
      ).toThrow("requires an initial state factory");
    });
  });

  describe("correlation", () => {
    it("should handle specific message correlation", () => {
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
          customerId: msg.customerId,
          status: "submitted",
        }))
        .build();

      const message: OrderSubmitted = {
        type: "OrderSubmitted",
        orderId: "order-123",
        customerId: "customer-456",
      };

      const correlation = saga.getCorrelation(message);
      expect(correlation.canStart).toBe(true);
      expect(correlation.getCorrelationId(message)).toBe("order-123");
    });

    it("should handle wildcard correlation", () => {
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
          customerId: msg.customerId,
          status: "submitted",
        }))
        .build();

      const payment: PaymentCaptured = {
        type: "PaymentCaptured",
        orderId: "order-123",
        amount: 99.99,
      };

      const correlation = saga.getCorrelation(payment);
      expect(correlation.canStart).toBe(false);
      expect(correlation.getCorrelationId(payment)).toBe("order-123");
    });

    it("should prefer specific over wildcard correlation", () => {
      const saga = createSagaMachine<OrderState, OrderMessages>()
        .name("OrderSaga")
        .correlate("OrderSubmitted", (msg) => `specific-${msg.orderId}`, {
          canStart: true,
        })
        .correlate("*", (msg) => `wildcard-${msg.orderId}`)
        .initial<OrderSubmitted>((msg, ctx) => ({
          metadata: {
            sagaId: ctx.sagaId,
            version: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            isCompleted: false,
          },
          orderId: msg.orderId,
          customerId: msg.customerId,
          status: "submitted",
        }))
        .build();

      const submitted: OrderSubmitted = {
        type: "OrderSubmitted",
        orderId: "123",
        customerId: "456",
      };

      expect(saga.getCorrelation(submitted).getCorrelationId(submitted)).toBe(
        "specific-123"
      );
    });
  });

  describe("initial state", () => {
    it("should create initial state from factory", async () => {
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
          customerId: msg.customerId,
          status: "submitted",
        }))
        .build();

      const message: OrderSubmitted = {
        type: "OrderSubmitted",
        orderId: "order-123",
        customerId: "customer-456",
      };
      const ctx = createMockContext({ sagaId: "saga-001" });

      const state = await saga.createInitialState(message, ctx);

      expect(state.metadata.sagaId).toBe("saga-001");
      expect(state.orderId).toBe("order-123");
      expect(state.customerId).toBe("customer-456");
      expect(state.status).toBe("submitted");
    });

    it("should support async initial factory", async () => {
      const saga = createSagaMachine<OrderState, OrderMessages>()
        .name("OrderSaga")
        .correlate("OrderSubmitted", (msg) => msg.orderId, { canStart: true })
        .initial<OrderSubmitted>(async (msg, ctx) => {
          await Promise.resolve(); // Simulate async work
          return {
            metadata: {
              sagaId: ctx.sagaId,
              version: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
              isCompleted: false,
            },
            orderId: msg.orderId,
            customerId: msg.customerId,
            status: "submitted",
          };
        })
        .build();

      const ctx = createMockContext();
      const state = await saga.createInitialState(
        { type: "OrderSubmitted", orderId: "123", customerId: "456" },
        ctx
      );

      expect(state.status).toBe("submitted");
    });
  });

  describe("handlers", () => {
    it("should handle messages without guards", async () => {
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
          customerId: msg.customerId,
          status: "submitted",
        }))
        .on("PaymentCaptured")
        .handle(async (msg, state) => ({
          newState: {
            ...state,
            status: "paid",
            amount: msg.amount,
          },
        }))
        .build();

      const state: OrderState = {
        metadata: {
          sagaId: "saga-1",
          version: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          isCompleted: false,
        },
        orderId: "order-123",
        customerId: "customer-456",
        status: "submitted",
      };

      const payment: PaymentCaptured = {
        type: "PaymentCaptured",
        orderId: "order-123",
        amount: 99.99,
      };

      const result = await saga.handle(payment, state, createMockContext());

      expect(result.newState.status).toBe("paid");
      expect(result.newState.amount).toBe(99.99);
    });

    it("should respect state guards", async () => {
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
          customerId: msg.customerId,
          status: "submitted",
        }))
        .on("PaymentCaptured")
        .when((state) => state.status === "submitted")
        .handle(async (msg, state) => ({
          newState: { ...state, status: "paid" },
        }))
        .build();

      // Should handle when guard passes
      const submittedState: OrderState = {
        metadata: {
          sagaId: "saga-1",
          version: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          isCompleted: false,
        },
        orderId: "order-123",
        customerId: "customer-456",
        status: "submitted",
      };

      const result1 = await saga.handle(
        { type: "PaymentCaptured", orderId: "order-123", amount: 99 },
        submittedState,
        createMockContext()
      );
      expect(result1.newState.status).toBe("paid");

      // Should NOT handle when guard fails
      const paidState: OrderState = { ...submittedState, status: "paid" };

      const result2 = await saga.handle(
        { type: "PaymentCaptured", orderId: "order-123", amount: 99 },
        paidState,
        createMockContext()
      );
      expect(result2.newState.status).toBe("paid"); // Unchanged
    });

    it("should chain multiple guards with AND logic", async () => {
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
          customerId: msg.customerId,
          status: "submitted",
        }))
        .on("PaymentCaptured")
        .when((state) => state.status === "submitted")
        .when((state) => state.customerId === "vip-customer")
        .handle(async (msg, state) => ({
          newState: { ...state, status: "paid" },
        }))
        .build();

      const state: OrderState = {
        metadata: {
          sagaId: "saga-1",
          version: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          isCompleted: false,
        },
        orderId: "order-123",
        customerId: "regular-customer",
        status: "submitted",
      };

      // First guard passes, second fails
      const result = await saga.handle(
        { type: "PaymentCaptured", orderId: "order-123", amount: 99 },
        state,
        createMockContext()
      );
      expect(result.newState.status).toBe("submitted"); // Unchanged

      // Both guards pass
      const vipState = { ...state, customerId: "vip-customer" };
      const result2 = await saga.handle(
        { type: "PaymentCaptured", orderId: "order-123", amount: 99 },
        vipState,
        createMockContext()
      );
      expect(result2.newState.status).toBe("paid");
    });

    it("should return state unchanged for unhandled message types", async () => {
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
          customerId: msg.customerId,
          status: "submitted",
        }))
        // No handler for OrderShipped
        .build();

      const state: OrderState = {
        metadata: {
          sagaId: "saga-1",
          version: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          isCompleted: false,
        },
        orderId: "order-123",
        customerId: "customer-456",
        status: "submitted",
      };

      const result = await saga.handle(
        { type: "OrderShipped", orderId: "order-123", trackingNumber: "TRACK" },
        state,
        createMockContext()
      );

      expect(result.newState).toEqual(state);
    });

    it("should support multiple handlers for same message type", async () => {
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
          customerId: msg.customerId,
          status: "submitted",
        }))
        // First handler - for submitted status
        .on("PaymentCaptured")
        .when((state) => state.status === "submitted")
        .handle(async (msg, state) => ({
          newState: { ...state, status: "paid", amount: msg.amount },
        }))
        // Second handler - for paid status (duplicate payment)
        .on("PaymentCaptured")
        .when((state) => state.status === "paid")
        .handle(async (_msg, state) => ({
          newState: state, // Ignore duplicate
        }))
        .build();

      const state: OrderState = {
        metadata: {
          sagaId: "saga-1",
          version: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          isCompleted: false,
        },
        orderId: "order-123",
        customerId: "customer-456",
        status: "submitted",
      };

      // First payment
      const result1 = await saga.handle(
        { type: "PaymentCaptured", orderId: "order-123", amount: 99 },
        state,
        createMockContext()
      );
      expect(result1.newState.status).toBe("paid");

      // Second payment (duplicate)
      const result2 = await saga.handle(
        { type: "PaymentCaptured", orderId: "order-123", amount: 99 },
        result1.newState,
        createMockContext()
      );
      expect(result2.newState.status).toBe("paid"); // Unchanged
    });
  });

  describe("handledMessageTypes", () => {
    it("should collect all handled message types", () => {
      const saga = createSagaMachine<OrderState, OrderMessages>()
        .name("OrderSaga")
        .correlate("OrderSubmitted", (msg) => msg.orderId, { canStart: true })
        .correlate("PaymentCaptured", (msg) => msg.orderId)
        .initial<OrderSubmitted>((msg, ctx) => ({
          metadata: {
            sagaId: ctx.sagaId,
            version: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            isCompleted: false,
          },
          orderId: msg.orderId,
          customerId: msg.customerId,
          status: "submitted",
        }))
        .on("PaymentCaptured")
        .handle(async (_msg, state) => ({ newState: state }))
        .on("OrderShipped")
        .handle(async (_msg, state) => ({ newState: state }))
        .build();

      expect(saga.handledMessageTypes).toContain("OrderSubmitted");
      expect(saga.handledMessageTypes).toContain("PaymentCaptured");
      expect(saga.handledMessageTypes).toContain("OrderShipped");
    });
  });
});
