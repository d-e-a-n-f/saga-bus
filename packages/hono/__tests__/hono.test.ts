import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Bus } from "@saga-bus/core";
import { sagaBusMiddleware, sagaErrorHandler } from "../src/middleware.js";
import { createHealthHandler } from "../src/health.js";
import type { SagaBusEnv } from "../src/types.js";

describe("sagaBusMiddleware", () => {
  let mockBus: Bus;

  beforeEach(() => {
    mockBus = {
      start: vi.fn(),
      stop: vi.fn(),
      publish: vi.fn(),
      subscribe: vi.fn(),
    } as unknown as Bus;
  });

  it("should set bus on context", async () => {
    const app = new Hono<SagaBusEnv>();
    app.use("*", sagaBusMiddleware({ bus: mockBus }));

    let contextBus: Bus | undefined;
    app.get("/test", (c) => {
      contextBus = c.get("bus");
      return c.json({ ok: true });
    });

    await app.request("/test");

    expect(contextBus).toBe(mockBus);
  });

  it("should extract correlation ID from header", async () => {
    const app = new Hono<SagaBusEnv>();
    app.use("*", sagaBusMiddleware({ bus: mockBus }));

    let contextCorrelationId: string | undefined;
    app.get("/test", (c) => {
      contextCorrelationId = c.get("correlationId");
      return c.json({ ok: true });
    });

    await app.request("/test", {
      headers: { "x-correlation-id": "test-correlation-123" },
    });

    expect(contextCorrelationId).toBe("test-correlation-123");
  });

  it("should use custom correlation ID header", async () => {
    const app = new Hono<SagaBusEnv>();
    app.use("*", sagaBusMiddleware({
      bus: mockBus,
      correlationIdHeader: "x-request-id",
    }));

    let contextCorrelationId: string | undefined;
    app.get("/test", (c) => {
      contextCorrelationId = c.get("correlationId");
      return c.json({ ok: true });
    });

    await app.request("/test", {
      headers: { "x-request-id": "custom-123" },
    });

    expect(contextCorrelationId).toBe("custom-123");
  });

  it("should generate correlation ID when not present", async () => {
    const app = new Hono<SagaBusEnv>();
    app.use("*", sagaBusMiddleware({ bus: mockBus }));

    let contextCorrelationId: string | undefined;
    app.get("/test", (c) => {
      contextCorrelationId = c.get("correlationId");
      return c.json({ ok: true });
    });

    await app.request("/test");

    expect(contextCorrelationId).toBeDefined();
    expect(contextCorrelationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it("should use custom correlation ID generator", async () => {
    const customGenerator = vi.fn(() => "custom-generated-id");
    const app = new Hono<SagaBusEnv>();
    app.use("*", sagaBusMiddleware({
      bus: mockBus,
      correlationIdGenerator: customGenerator,
    }));

    let contextCorrelationId: string | undefined;
    app.get("/test", (c) => {
      contextCorrelationId = c.get("correlationId");
      return c.json({ ok: true });
    });

    await app.request("/test");

    expect(customGenerator).toHaveBeenCalled();
    expect(contextCorrelationId).toBe("custom-generated-id");
  });

  it("should not generate correlation ID when disabled", async () => {
    const app = new Hono<SagaBusEnv>();
    app.use("*", sagaBusMiddleware({
      bus: mockBus,
      generateCorrelationId: false,
    }));

    let contextCorrelationId: string | undefined;
    app.get("/test", (c) => {
      contextCorrelationId = c.get("correlationId");
      return c.json({ ok: true });
    });

    await app.request("/test");

    expect(contextCorrelationId).toBeUndefined();
  });

  it("should set correlation ID on response header", async () => {
    const app = new Hono<SagaBusEnv>();
    app.use("*", sagaBusMiddleware({ bus: mockBus }));

    app.get("/test", (c) => c.json({ ok: true }));

    const response = await app.request("/test", {
      headers: { "x-correlation-id": "test-123" },
    });

    expect(response.headers.get("x-correlation-id")).toBe("test-123");
  });
});

describe("sagaErrorHandler", () => {
  let mockBus: Bus;

  beforeEach(() => {
    mockBus = {
      start: vi.fn(),
      stop: vi.fn(),
      publish: vi.fn(),
      subscribe: vi.fn(),
    } as unknown as Bus;
  });

  it("should handle SagaTimeoutError with 408 status", async () => {
    const app = new Hono<SagaBusEnv>();
    app.use("*", sagaBusMiddleware({ bus: mockBus }));
    app.onError(sagaErrorHandler());

    app.get("/timeout", () => {
      const error = new Error("Saga timed out");
      error.name = "SagaTimeoutError";
      throw error;
    });

    const response = await app.request("/timeout", {
      headers: { "x-correlation-id": "test-123" },
    });

    expect(response.status).toBe(408);
    const body = await response.json();
    expect(body).toMatchObject({
      error: "Saga Timeout",
      message: "Saga timed out",
      correlationId: "test-123",
    });
  });

  it("should handle ConcurrencyError with 409 status", async () => {
    const app = new Hono<SagaBusEnv>();
    app.use("*", sagaBusMiddleware({ bus: mockBus }));
    app.onError(sagaErrorHandler());

    app.get("/conflict", () => {
      const error = new Error("Concurrency conflict");
      error.name = "ConcurrencyError";
      throw error;
    });

    const response = await app.request("/conflict", {
      headers: { "x-correlation-id": "test-123" },
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body).toMatchObject({
      error: "Concurrency Conflict",
      message: "Concurrency conflict",
      correlationId: "test-123",
    });
  });

  it("should return 500 for other errors", async () => {
    const app = new Hono<SagaBusEnv>();
    app.use("*", sagaBusMiddleware({ bus: mockBus }));
    app.onError(sagaErrorHandler());

    app.get("/error", () => {
      throw new Error("Some other error");
    });

    const response = await app.request("/error");

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toMatchObject({
      error: "Internal Server Error",
      message: "Some other error",
    });
  });
});

describe("createHealthHandler", () => {
  let mockBus: Bus;

  beforeEach(() => {
    mockBus = {
      start: vi.fn(),
      stop: vi.fn(),
      publish: vi.fn(),
      subscribe: vi.fn(),
    } as unknown as Bus;
  });

  it("should return healthy status when bus is available", async () => {
    const app = new Hono<SagaBusEnv>();
    app.get("/health", createHealthHandler({ bus: mockBus }));

    const response = await app.request("/health");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      status: "healthy",
      checks: {
        bus: { status: "pass" },
      },
    });
  });

  it("should include timestamp in response", async () => {
    const app = new Hono<SagaBusEnv>();
    app.get("/health", createHealthHandler({ bus: mockBus }));

    const response = await app.request("/health");
    const body = await response.json();

    expect(body.timestamp).toBeDefined();
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();
  });

  it("should run additional checks", async () => {
    const customCheck = vi.fn().mockResolvedValue(true);
    const app = new Hono<SagaBusEnv>();
    app.get("/health", createHealthHandler({
      bus: mockBus,
      checks: [{ name: "database", check: customCheck }],
    }));

    const response = await app.request("/health");

    expect(customCheck).toHaveBeenCalled();
    const body = await response.json();
    expect(body.checks.database).toEqual({ status: "pass" });
  });

  it("should return unhealthy when check fails", async () => {
    const failingCheck = vi.fn().mockResolvedValue(false);
    const app = new Hono<SagaBusEnv>();
    app.get("/health", createHealthHandler({
      bus: mockBus,
      checks: [{ name: "database", check: failingCheck }],
    }));

    const response = await app.request("/health");

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toMatchObject({
      status: "unhealthy",
      checks: {
        database: { status: "fail" },
      },
    });
  });

  it("should handle check exceptions", async () => {
    const throwingCheck = vi.fn().mockRejectedValue(new Error("DB failed"));
    const app = new Hono<SagaBusEnv>();
    app.get("/health", createHealthHandler({
      bus: mockBus,
      checks: [{ name: "database", check: throwingCheck }],
    }));

    const response = await app.request("/health");

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.checks.database).toMatchObject({
      status: "fail",
      message: "DB failed",
    });
  });
});
