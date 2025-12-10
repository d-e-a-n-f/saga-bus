import Fastify from "fastify";
import { collectDefaultMetrics, register } from "prom-client";

export interface HealthServer {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export function createHealthServer(
  port: number,
  host: string,
  checkHealth: () => Promise<{ status: string; checks: Record<string, boolean> }>
): HealthServer {
  const fastify = Fastify({ logger: false });

  // Collect default Node.js metrics (uses global registry)
  collectDefaultMetrics();

  // Health endpoint
  fastify.get("/health", async () => {
    const health = await checkHealth();
    return health;
  });

  // Liveness probe (always returns 200 if server is running)
  fastify.get("/health/live", async () => {
    return { status: "ok" };
  });

  // Readiness probe (checks dependencies)
  fastify.get("/health/ready", async (request, reply) => {
    const health = await checkHealth();
    const isReady = Object.values(health.checks).every((v) => v);
    reply.code(isReady ? 200 : 503);
    return health;
  });

  // Metrics endpoint for Prometheus (uses global registry which includes saga-bus metrics)
  fastify.get("/metrics", async (request, reply) => {
    reply.header("Content-Type", register.contentType);
    return register.metrics();
  });

  return {
    async start() {
      await fastify.listen({ port, host });
      console.log(`Health server listening on http://${host}:${port}`);
    },
    async stop() {
      await fastify.close();
    },
  };
}
