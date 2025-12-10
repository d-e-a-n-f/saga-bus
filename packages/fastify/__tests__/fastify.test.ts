import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import type { Bus } from "@saga-bus/core";
import { sagaBusFastifyPlugin } from "../src/plugin.js";

describe("sagaBusFastifyPlugin", () => {
  let mockBus: Bus;

  beforeEach(() => {
    mockBus = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      publish: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
    } as unknown as Bus;
  });

  describe("plugin registration", () => {
    it("should decorate fastify with bus", async () => {
      const app = Fastify();
      await app.register(sagaBusFastifyPlugin, {
        bus: mockBus,
        autoStart: false,
        autoStop: false,
      });

      expect(app.bus).toBe(mockBus);
      await app.close();
    });
  });

  describe("request decoration", () => {
    it("should decorate request with bus", async () => {
      const app = Fastify();
      await app.register(sagaBusFastifyPlugin, {
        bus: mockBus,
        autoStart: false,
        autoStop: false,
      });

      let requestBus: Bus | undefined;
      app.get("/test", async (request) => {
        requestBus = request.bus;
        return { ok: true };
      });

      await app.inject({ method: "GET", url: "/test" });

      expect(requestBus).toBe(mockBus);
      await app.close();
    });

    it("should extract correlation ID from header", async () => {
      const app = Fastify();
      await app.register(sagaBusFastifyPlugin, {
        bus: mockBus,
        autoStart: false,
        autoStop: false,
      });

      let requestCorrelationId: string | undefined;
      app.get("/test", async (request) => {
        requestCorrelationId = request.correlationId;
        return { ok: true };
      });

      await app.inject({
        method: "GET",
        url: "/test",
        headers: { "x-correlation-id": "test-correlation-123" },
      });

      expect(requestCorrelationId).toBe("test-correlation-123");
      await app.close();
    });

    it("should use custom correlation ID header", async () => {
      const app = Fastify();
      await app.register(sagaBusFastifyPlugin, {
        bus: mockBus,
        autoStart: false,
        autoStop: false,
        correlationIdHeader: "x-request-id",
      });

      let requestCorrelationId: string | undefined;
      app.get("/test", async (request) => {
        requestCorrelationId = request.correlationId;
        return { ok: true };
      });

      await app.inject({
        method: "GET",
        url: "/test",
        headers: { "x-request-id": "custom-123" },
      });

      expect(requestCorrelationId).toBe("custom-123");
      await app.close();
    });

    it("should generate correlation ID when not present", async () => {
      const app = Fastify();
      await app.register(sagaBusFastifyPlugin, {
        bus: mockBus,
        autoStart: false,
        autoStop: false,
      });

      let requestCorrelationId: string | undefined;
      app.get("/test", async (request) => {
        requestCorrelationId = request.correlationId;
        return { ok: true };
      });

      await app.inject({ method: "GET", url: "/test" });

      expect(requestCorrelationId).toBeDefined();
      expect(requestCorrelationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
      await app.close();
    });

    it("should use custom correlation ID generator", async () => {
      const customGenerator = vi.fn(() => "custom-generated-id");
      const app = Fastify();
      await app.register(sagaBusFastifyPlugin, {
        bus: mockBus,
        autoStart: false,
        autoStop: false,
        correlationIdGenerator: customGenerator,
      });

      let requestCorrelationId: string | undefined;
      app.get("/test", async (request) => {
        requestCorrelationId = request.correlationId;
        return { ok: true };
      });

      await app.inject({ method: "GET", url: "/test" });

      expect(customGenerator).toHaveBeenCalled();
      expect(requestCorrelationId).toBe("custom-generated-id");
      await app.close();
    });

    it("should not generate correlation ID when disabled", async () => {
      const app = Fastify();
      await app.register(sagaBusFastifyPlugin, {
        bus: mockBus,
        autoStart: false,
        autoStop: false,
        generateCorrelationId: false,
      });

      let requestCorrelationId: string | undefined;
      app.get("/test", async (request) => {
        requestCorrelationId = request.correlationId;
        return { ok: true };
      });

      await app.inject({ method: "GET", url: "/test" });

      expect(requestCorrelationId).toBe("");
      await app.close();
    });

    it("should set correlation ID on response header", async () => {
      const app = Fastify();
      await app.register(sagaBusFastifyPlugin, {
        bus: mockBus,
        autoStart: false,
        autoStop: false,
      });

      app.get("/test", async () => ({ ok: true }));

      const response = await app.inject({
        method: "GET",
        url: "/test",
        headers: { "x-correlation-id": "test-123" },
      });

      expect(response.headers["x-correlation-id"]).toBe("test-123");
      await app.close();
    });
  });

  describe("lifecycle hooks", () => {
    it("should auto-start bus on ready", async () => {
      const app = Fastify();
      await app.register(sagaBusFastifyPlugin, {
        bus: mockBus,
        autoStart: true,
        autoStop: false,
      });

      await app.ready();

      expect(mockBus.start).toHaveBeenCalled();
      await app.close();
    });

    it("should not auto-start bus when disabled", async () => {
      const app = Fastify();
      await app.register(sagaBusFastifyPlugin, {
        bus: mockBus,
        autoStart: false,
        autoStop: false,
      });

      await app.ready();

      expect(mockBus.start).not.toHaveBeenCalled();
      await app.close();
    });

    it("should auto-stop bus on close", async () => {
      const app = Fastify();
      await app.register(sagaBusFastifyPlugin, {
        bus: mockBus,
        autoStart: false,
        autoStop: true,
      });

      await app.ready();
      await app.close();

      expect(mockBus.stop).toHaveBeenCalled();
    });

    it("should not auto-stop bus when disabled", async () => {
      const app = Fastify();
      await app.register(sagaBusFastifyPlugin, {
        bus: mockBus,
        autoStart: false,
        autoStop: false,
      });

      await app.ready();
      await app.close();

      expect(mockBus.stop).not.toHaveBeenCalled();
    });
  });

  describe("health check", () => {
    it("should register health check route when enabled", async () => {
      const app = Fastify();
      await app.register(sagaBusFastifyPlugin, {
        bus: mockBus,
        autoStart: false,
        autoStop: false,
        healthCheck: true,
      });

      const response = await app.inject({ method: "GET", url: "/health" });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toMatchObject({
        status: "healthy",
        checks: {
          bus: { status: "pass" },
        },
      });
      await app.close();
    });

    it("should use custom health check path", async () => {
      const app = Fastify();
      await app.register(sagaBusFastifyPlugin, {
        bus: mockBus,
        autoStart: false,
        autoStop: false,
        healthCheck: { path: "/status" },
      });

      const response = await app.inject({ method: "GET", url: "/status" });

      expect(response.statusCode).toBe(200);
      await app.close();
    });

    it("should run additional health checks", async () => {
      const customCheck = vi.fn().mockResolvedValue(true);
      const app = Fastify();
      await app.register(sagaBusFastifyPlugin, {
        bus: mockBus,
        autoStart: false,
        autoStop: false,
        healthCheck: {
          checks: [{ name: "database", check: customCheck }],
        },
      });

      const response = await app.inject({ method: "GET", url: "/health" });

      expect(customCheck).toHaveBeenCalled();
      expect(JSON.parse(response.body).checks.database).toEqual({
        status: "pass",
      });
      await app.close();
    });

    it("should return unhealthy when check fails", async () => {
      const failingCheck = vi.fn().mockResolvedValue(false);
      const app = Fastify();
      await app.register(sagaBusFastifyPlugin, {
        bus: mockBus,
        autoStart: false,
        autoStop: false,
        healthCheck: {
          checks: [{ name: "database", check: failingCheck }],
        },
      });

      const response = await app.inject({ method: "GET", url: "/health" });

      expect(response.statusCode).toBe(503);
      expect(JSON.parse(response.body)).toMatchObject({
        status: "unhealthy",
        checks: {
          database: { status: "fail" },
        },
      });
      await app.close();
    });

    it("should handle check exceptions", async () => {
      const throwingCheck = vi.fn().mockRejectedValue(new Error("DB failed"));
      const app = Fastify();
      await app.register(sagaBusFastifyPlugin, {
        bus: mockBus,
        autoStart: false,
        autoStop: false,
        healthCheck: {
          checks: [{ name: "database", check: throwingCheck }],
        },
      });

      const response = await app.inject({ method: "GET", url: "/health" });

      expect(response.statusCode).toBe(503);
      expect(JSON.parse(response.body).checks.database).toMatchObject({
        status: "fail",
        message: "DB failed",
      });
      await app.close();
    });

    it("should include timestamp in health response", async () => {
      const app = Fastify();
      await app.register(sagaBusFastifyPlugin, {
        bus: mockBus,
        autoStart: false,
        autoStop: false,
        healthCheck: true,
      });

      const response = await app.inject({ method: "GET", url: "/health" });
      const body = JSON.parse(response.body);

      expect(body.timestamp).toBeDefined();
      expect(new Date(body.timestamp).getTime()).not.toBeNaN();
      await app.close();
    });
  });

  describe("error handler", () => {
    it("should handle SagaTimeoutError with 408 status", async () => {
      const app = Fastify();
      await app.register(sagaBusFastifyPlugin, {
        bus: mockBus,
        autoStart: false,
        autoStop: false,
      });

      app.get("/timeout", async () => {
        const error = new Error("Saga timed out");
        error.name = "SagaTimeoutError";
        throw error;
      });

      const response = await app.inject({
        method: "GET",
        url: "/timeout",
        headers: { "x-correlation-id": "test-123" },
      });

      expect(response.statusCode).toBe(408);
      expect(JSON.parse(response.body)).toMatchObject({
        error: "Saga Timeout",
        message: "Saga timed out",
        correlationId: "test-123",
      });
      await app.close();
    });

    it("should handle ConcurrencyError with 409 status", async () => {
      const app = Fastify();
      await app.register(sagaBusFastifyPlugin, {
        bus: mockBus,
        autoStart: false,
        autoStop: false,
      });

      app.get("/conflict", async () => {
        const error = new Error("Concurrency conflict");
        error.name = "ConcurrencyError";
        throw error;
      });

      const response = await app.inject({
        method: "GET",
        url: "/conflict",
        headers: { "x-correlation-id": "test-123" },
      });

      expect(response.statusCode).toBe(409);
      expect(JSON.parse(response.body)).toMatchObject({
        error: "Concurrency Conflict",
        message: "Concurrency conflict",
        correlationId: "test-123",
      });
      await app.close();
    });
  });
});
