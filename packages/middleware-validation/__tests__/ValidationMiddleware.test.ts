import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import type { MessageEnvelope, SagaPipelineContext } from "@saga-bus/core";
import {
  createValidationMiddleware,
  createZodValidator,
  createZodValidators,
  createFunctionValidator,
  combineValidators,
  MessageValidationError,
} from "../src/index.js";

interface OrderCreated {
  type: "OrderCreated";
  orderId: string;
  customerId: string;
  items: Array<{ sku: string; quantity: number }>;
}

interface OrderShipped {
  type: "OrderShipped";
  orderId: string;
  trackingNumber: string;
}

function createMockEnvelope<T extends { type: string }>(
  id: string,
  payload: T
): MessageEnvelope<T> {
  return {
    id,
    type: payload.type,
    payload,
    headers: {},
    timestamp: new Date(),
  };
}

function createMockContext(envelope: MessageEnvelope): SagaPipelineContext {
  return {
    envelope,
    sagaName: "TestSaga",
    correlationId: "test-correlation-123",
    metadata: {},
    setTraceContext: vi.fn(),
  };
}

describe("createZodValidator", () => {
  const OrderCreatedSchema = z.object({
    type: z.literal("OrderCreated"),
    orderId: z.string().min(1),
    customerId: z.string().min(1),
    items: z.array(
      z.object({
        sku: z.string(),
        quantity: z.number().positive(),
      })
    ).min(1),
  });

  it("should return valid for valid messages", () => {
    const validator = createZodValidator<OrderCreated>(OrderCreatedSchema);
    const result = validator({
      type: "OrderCreated",
      orderId: "order-123",
      customerId: "customer-456",
      items: [{ sku: "SKU-1", quantity: 2 }],
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it("should return errors for invalid messages", () => {
    const validator = createZodValidator<OrderCreated>(OrderCreatedSchema);
    const result = validator({
      type: "OrderCreated",
      orderId: "",
      customerId: "customer-456",
      items: [],
    } as OrderCreated);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it("should include error paths", () => {
    const validator = createZodValidator<OrderCreated>(OrderCreatedSchema);
    const result = validator({
      type: "OrderCreated",
      orderId: "",
      customerId: "customer-456",
      items: [{ sku: "", quantity: -1 }],
    } as OrderCreated);

    expect(result.valid).toBe(false);
    const paths = result.errors!.map((e) => e.path);
    expect(paths).toContain("orderId");
    expect(paths.some((p) => p.includes("items"))).toBe(true);
  });
});

describe("createZodValidators", () => {
  it("should create validators for multiple schemas", () => {
    const validators = createZodValidators({
      OrderCreated: z.object({
        type: z.literal("OrderCreated"),
        orderId: z.string(),
      }),
      OrderShipped: z.object({
        type: z.literal("OrderShipped"),
        orderId: z.string(),
        trackingNumber: z.string(),
      }),
    });

    expect(validators.OrderCreated).toBeDefined();
    expect(validators.OrderShipped).toBeDefined();

    const validResult = validators.OrderCreated({ type: "OrderCreated", orderId: "123" });
    expect(validResult.valid).toBe(true);

    const invalidResult = validators.OrderShipped({ type: "OrderShipped", orderId: "123" } as OrderShipped);
    expect(invalidResult.valid).toBe(false);
  });
});

describe("createFunctionValidator", () => {
  it("should return valid when function returns true", async () => {
    const validator = createFunctionValidator<OrderCreated>(() => true);
    const result = await validator({
      type: "OrderCreated",
      orderId: "123",
      customerId: "456",
      items: [],
    });

    expect(result.valid).toBe(true);
  });

  it("should return error when function returns false", async () => {
    const validator = createFunctionValidator<OrderCreated>(() => false);
    const result = await validator({
      type: "OrderCreated",
      orderId: "123",
      customerId: "456",
      items: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors![0].message).toBe("Validation failed");
  });

  it("should return error message when function returns string", async () => {
    const validator = createFunctionValidator<OrderCreated>((msg) =>
      msg.items.length > 0 ? true : "Order must have items"
    );
    const result = await validator({
      type: "OrderCreated",
      orderId: "123",
      customerId: "456",
      items: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors![0].message).toBe("Order must have items");
  });

  it("should return multiple errors when function returns array", async () => {
    const validator = createFunctionValidator<OrderCreated>((msg) => {
      const errors: string[] = [];
      if (!msg.orderId) errors.push("orderId required");
      if (msg.items.length === 0) errors.push("items required");
      return errors.length === 0 ? true : errors;
    });

    const result = await validator({
      type: "OrderCreated",
      orderId: "",
      customerId: "456",
      items: [],
    } as OrderCreated);

    expect(result.valid).toBe(false);
    expect(result.errors!.length).toBe(2);
  });

  it("should handle async validators", async () => {
    const validator = createFunctionValidator<OrderCreated>(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return "Async error";
    });

    const result = await validator({
      type: "OrderCreated",
      orderId: "123",
      customerId: "456",
      items: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors![0].message).toBe("Async error");
  });
});

describe("combineValidators", () => {
  it("should pass when all validators pass", async () => {
    const validator = combineValidators<OrderCreated>([
      createFunctionValidator(() => true),
      createFunctionValidator(() => true),
    ]);

    const result = await validator({
      type: "OrderCreated",
      orderId: "123",
      customerId: "456",
      items: [],
    });

    expect(result.valid).toBe(true);
  });

  it("should collect errors from all validators", async () => {
    const validator = combineValidators<OrderCreated>([
      createFunctionValidator(() => "Error 1"),
      createFunctionValidator(() => "Error 2"),
    ]);

    const result = await validator({
      type: "OrderCreated",
      orderId: "123",
      customerId: "456",
      items: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors!.length).toBe(2);
    expect(result.errors!.map((e) => e.message)).toContain("Error 1");
    expect(result.errors!.map((e) => e.message)).toContain("Error 2");
  });
});

describe("createValidationMiddleware", () => {
  const OrderCreatedSchema = z.object({
    type: z.literal("OrderCreated"),
    orderId: z.string().min(1),
    customerId: z.string().min(1),
    items: z.array(z.object({ sku: z.string(), quantity: z.number() })).min(1),
  });

  const validators = {
    OrderCreated: createZodValidator<OrderCreated>(OrderCreatedSchema),
  };

  it("should pass valid messages", async () => {
    const middleware = createValidationMiddleware({ validators });
    const envelope = createMockEnvelope("msg-1", {
      type: "OrderCreated",
      orderId: "123",
      customerId: "456",
      items: [{ sku: "SKU-1", quantity: 1 }],
    } as OrderCreated);
    const ctx = createMockContext(envelope);
    const next = vi.fn();

    await middleware(ctx, next);

    expect(next).toHaveBeenCalled();
  });

  it("should throw for invalid messages by default", async () => {
    const middleware = createValidationMiddleware({ validators });
    const envelope = createMockEnvelope("msg-1", {
      type: "OrderCreated",
      orderId: "",
      customerId: "456",
      items: [],
    } as OrderCreated);
    const ctx = createMockContext(envelope);
    const next = vi.fn();

    await expect(middleware(ctx, next)).rejects.toThrow(MessageValidationError);
    expect(next).not.toHaveBeenCalled();
  });

  it("should skip messages without validators by default", async () => {
    const middleware = createValidationMiddleware({ validators });
    const envelope = createMockEnvelope("msg-1", {
      type: "UnknownMessage",
    });
    const ctx = createMockContext(envelope);
    const next = vi.fn();

    await middleware(ctx, next);

    expect(next).toHaveBeenCalled();
  });

  it("should reject messages without validators in strict mode", async () => {
    const middleware = createValidationMiddleware({
      validators,
      strictMode: true,
    });
    const envelope = createMockEnvelope("msg-1", {
      type: "UnknownMessage",
    });
    const ctx = createMockContext(envelope);
    const next = vi.fn();

    await expect(middleware(ctx, next)).rejects.toThrow(MessageValidationError);
    expect(next).not.toHaveBeenCalled();
  });

  it("should skip invalid messages when onInvalid is skip", async () => {
    const middleware = createValidationMiddleware({
      validators,
      onInvalid: "skip",
    });
    const envelope = createMockEnvelope("msg-1", {
      type: "OrderCreated",
      orderId: "",
      customerId: "456",
      items: [],
    } as OrderCreated);
    const ctx = createMockContext(envelope);
    const next = vi.fn();

    await middleware(ctx, next);

    expect(next).not.toHaveBeenCalled();
  });

  it("should log and skip when onInvalid is log", async () => {
    const logger = { warn: vi.fn(), error: vi.fn() };
    const middleware = createValidationMiddleware({
      validators,
      onInvalid: "log",
      logger,
    });
    const envelope = createMockEnvelope("msg-1", {
      type: "OrderCreated",
      orderId: "",
      customerId: "456",
      items: [],
    } as OrderCreated);
    const ctx = createMockContext(envelope);
    const next = vi.fn();

    await middleware(ctx, next);

    expect(next).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      "Invalid message detected, skipping",
      expect.objectContaining({
        messageId: "msg-1",
        messageType: "OrderCreated",
      })
    );
  });

  it("should send to DLQ when onInvalid is dlq", async () => {
    const deadLetterHandler = vi.fn();
    const logger = { warn: vi.fn(), error: vi.fn() };
    const middleware = createValidationMiddleware({
      validators,
      onInvalid: "dlq",
      deadLetterHandler,
      logger,
    });
    const envelope = createMockEnvelope("msg-1", {
      type: "OrderCreated",
      orderId: "",
      customerId: "456",
      items: [],
    } as OrderCreated);
    const ctx = createMockContext(envelope);
    const next = vi.fn();

    await middleware(ctx, next);

    expect(next).not.toHaveBeenCalled();
    expect(deadLetterHandler).toHaveBeenCalledWith(
      envelope,
      expect.arrayContaining([
        expect.objectContaining({ path: expect.any(String) }),
      ])
    );
    expect(logger.error).toHaveBeenCalled();
  });

  it("should throw if dlq is configured without handler", () => {
    expect(() =>
      createValidationMiddleware({
        validators,
        onInvalid: "dlq",
      })
    ).toThrow("deadLetterHandler is required");
  });

  it("should exclude specified message types", async () => {
    const middleware = createValidationMiddleware({
      validators,
      excludeTypes: ["Heartbeat"],
    });
    const envelope = createMockEnvelope("msg-1", { type: "Heartbeat" });
    const ctx = createMockContext(envelope);
    const next = vi.fn();

    await middleware(ctx, next);

    expect(next).toHaveBeenCalled();
  });
});

describe("MessageValidationError", () => {
  it("should have correct properties", () => {
    const errors = [
      { path: "orderId", message: "Required" },
      { path: "items", message: "Must have at least 1 item" },
    ];
    const error = new MessageValidationError("msg-123", "OrderCreated", errors);

    expect(error.name).toBe("MessageValidationError");
    expect(error.messageId).toBe("msg-123");
    expect(error.messageType).toBe("OrderCreated");
    expect(error.validationErrors).toEqual(errors);
    expect(error.message).toContain("msg-123");
    expect(error.message).toContain("orderId");
    expect(error.message).toContain("items");
  });

  it("should be instanceof Error", () => {
    const error = new MessageValidationError("msg-123", "OrderCreated", []);
    expect(error).toBeInstanceOf(Error);
  });
});
