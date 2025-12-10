import Fastify from "fastify";
import { Registry, collectDefaultMetrics, Counter, Histogram } from "prom-client";

export interface HealthServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  incrementMessagesProcessed(messageType: string): void;
  recordProcessingDuration(messageType: string, durationMs: number): void;
}

export function createHealthServer(
  port: number,
  host: string,
  checkHealth: () => Promise<{ status: string; checks: Record<string, boolean> }>
): HealthServer {
  const fastify = Fastify({ logger: false });
  const register = new Registry();

  // Collect default Node.js metrics
  collectDefaultMetrics({ register });

  // Custom metrics
  const messagesProcessed = new Counter({
    name: "saga_bus_messages_processed_total",
    help: "Total messages processed by type",
    labelNames: ["message_type"],
    registers: [register],
  });

  const processingDuration = new Histogram({
    name: "saga_bus_message_processing_duration_ms",
    help: "Message processing duration in milliseconds",
    labelNames: ["message_type"],
    buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    registers: [register],
  });

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

  // Metrics endpoint for Prometheus
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
    incrementMessagesProcessed(messageType: string) {
      messagesProcessed.inc({ message_type: messageType });
    },
    recordProcessingDuration(messageType: string, durationMs: number) {
      processingDuration.observe({ message_type: messageType }, durationMs);
    },
  };
}
