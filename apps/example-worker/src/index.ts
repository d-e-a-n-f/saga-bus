// Initialize telemetry FIRST before any other imports
import { initTelemetry, shutdownTelemetry } from "./telemetry.js";
const telemetrySdk = initTelemetry();

import { Pool } from "pg";
import { createBus, type Bus } from "@saga-bus/core";
import { RabbitMqTransport } from "@saga-bus/transport-rabbitmq";
import { PostgresSagaStore } from "@saga-bus/store-postgres";
import { createLoggingMiddleware } from "@saga-bus/middleware-logging";
import { createMetricsMiddleware } from "@saga-bus/middleware-metrics";
import { createTracingMiddleware } from "@saga-bus/middleware-tracing";
import { OrderSaga, type OrderSagaState } from "@saga-bus/examples-shared";

import { loadConfig } from "./config.js";
import { createHealthServer, type HealthServer } from "./health.js";

async function main(): Promise<void> {
  const config = loadConfig();

  console.log("Starting saga-bus worker...");
  console.log(`RabbitMQ: ${config.rabbitmq.url}`);
  console.log(`PostgreSQL: ${config.postgres.connectionString.replace(/:[^:@]+@/, ":****@")}`);

  // Create PostgreSQL pool
  const pool = new Pool({
    connectionString: config.postgres.connectionString,
  });

  // Verify database connection
  try {
    await pool.query("SELECT 1");
    console.log("Connected to PostgreSQL");
  } catch (error) {
    console.error("Failed to connect to PostgreSQL:", error);
    process.exit(1);
  }

  // Create transport
  const transport = new RabbitMqTransport({
    uri: config.rabbitmq.url,
    exchange: config.rabbitmq.exchange,
    exchangeType: "topic",
    durable: true,
  });

  // Create store
  const store = new PostgresSagaStore<OrderSagaState>({ pool });

  // Create health server (before bus so we can use it in metrics middleware)
  const healthServer: HealthServer = createHealthServer(
    config.server.port,
    config.server.host,
    async () => ({
      status: transport.isConnected() ? "healthy" : "degraded",
      checks: {
        rabbitmq: transport.isConnected(),
        postgres: await checkPostgres(pool),
      },
    })
  );

  // Create middleware
  const loggingMiddleware = createLoggingMiddleware({
    level: "info",
    logPayload: true,
  });

  const tracingMiddleware = createTracingMiddleware({
    tracerName: "saga-bus-worker",
    recordPayload: true,
    maxPayloadSize: 2048,
  });

  const metricsMiddleware = createMetricsMiddleware();

  // Create bus
  const bus: Bus = createBus({
    transport,
    store,
    sagas: [{ definition: OrderSaga }],
    middleware: [tracingMiddleware, metricsMiddleware, loggingMiddleware],
    logger: {
      debug: (msg, meta) => console.debug(`[DEBUG] ${msg}`, meta ?? ""),
      info: (msg, meta) => console.log(`[INFO] ${msg}`, meta ?? ""),
      warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta ?? ""),
      error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta ?? ""),
    },
  });

  // Graceful shutdown handling
  let isShuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`\nReceived ${signal}, shutting down gracefully...`);

    try {
      await bus.stop();
      console.log("Bus stopped");

      await healthServer.stop();
      console.log("Health server stopped");

      await pool.end();
      console.log("Database pool closed");

      await shutdownTelemetry(telemetrySdk);
      console.log("Telemetry shutdown");

      console.log("Shutdown complete");
      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error);
      process.exit(1);
    }
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  // Start services
  try {
    await healthServer.start();
    await bus.start();
    console.log("Worker is ready and processing messages");
  } catch (error) {
    console.error("Failed to start worker:", error);
    process.exit(1);
  }
}

async function checkPostgres(pool: Pool): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

// Start the worker
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
