import type { FastifyPluginAsync, FastifyError } from "fastify";
import fp from "fastify-plugin";
import { randomUUID } from "crypto";
import type { Bus } from "@saga-bus/core";
import type { SagaBusFastifyOptions, HealthCheckConfig, HealthStatus } from "./types.js";

const sagaBusPlugin: FastifyPluginAsync<SagaBusFastifyOptions> = async (
  fastify,
  options
) => {
  const {
    bus,
    autoStart = true,
    autoStop = true,
    correlationIdHeader = "x-correlation-id",
    generateCorrelationId = true,
    correlationIdGenerator = randomUUID,
    healthCheck = false,
  } = options;

  // Decorate fastify instance with bus
  fastify.decorate("bus", bus);

  // Decorate request with bus and correlationId
  // @ts-expect-error - Fastify decorateRequest typing is complex, null is valid for initial decoration
  fastify.decorateRequest("bus", null);
  fastify.decorateRequest("correlationId", "");

  // Add hook to set bus and correlation ID on request
  fastify.addHook("onRequest", async (request, reply) => {
    request.bus = bus;

    // Extract or generate correlation ID
    let correlationId = request.headers[correlationIdHeader.toLowerCase()] as string | undefined;

    if (!correlationId && generateCorrelationId) {
      correlationId = correlationIdGenerator();
    }

    if (correlationId) {
      request.correlationId = correlationId;
      reply.header(correlationIdHeader, correlationId);
    }
  });

  // Auto-start bus
  if (autoStart) {
    fastify.addHook("onReady", async () => {
      await bus.start();
      fastify.log.info("Saga bus started");
    });
  }

  // Auto-stop bus
  if (autoStop) {
    fastify.addHook("onClose", async () => {
      await bus.stop();
      fastify.log.info("Saga bus stopped");
    });
  }

  // Register health check route
  if (healthCheck) {
    const config: HealthCheckConfig = typeof healthCheck === "boolean"
      ? { path: "/health", checks: [] }
      : { path: "/health", checks: [], ...healthCheck };

    fastify.get(config.path!, async (_request, reply) => {
      const healthStatus: HealthStatus = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        checks: {},
      };

      // Check bus
      try {
        if (bus) {
          healthStatus.checks.bus = { status: "pass" };
        } else {
          throw new Error("Bus not available");
        }
      } catch (error) {
        healthStatus.status = "unhealthy";
        healthStatus.checks.bus = {
          status: "fail",
          message: error instanceof Error ? error.message : "Unknown error",
        };
      }

      // Run additional checks
      for (const check of config.checks || []) {
        try {
          const result = await check.check();
          healthStatus.checks[check.name] = {
            status: result ? "pass" : "fail",
          };
          if (!result) {
            healthStatus.status = "unhealthy";
          }
        } catch (error) {
          healthStatus.status = "unhealthy";
          healthStatus.checks[check.name] = {
            status: "fail",
            message: error instanceof Error ? error.message : "Unknown error",
          };
        }
      }

      const statusCode = healthStatus.status === "healthy" ? 200 : 503;
      reply.code(statusCode).send(healthStatus);
    });
  }

  // Error handler for saga errors
  fastify.setErrorHandler((error: FastifyError, request, reply) => {
    if (error.name === "SagaTimeoutError") {
      reply.code(408).send({
        error: "Saga Timeout",
        message: error.message,
        correlationId: request.correlationId,
      });
      return;
    }

    if (error.name === "ConcurrencyError") {
      reply.code(409).send({
        error: "Concurrency Conflict",
        message: error.message,
        correlationId: request.correlationId,
      });
      return;
    }

    // Default error handling
    reply.send(error);
  });
};

export const sagaBusFastifyPlugin = fp(sagaBusPlugin, {
  fastify: ">=4.0.0",
  name: "@saga-bus/fastify",
});
