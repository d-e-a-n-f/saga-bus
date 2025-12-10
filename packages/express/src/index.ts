export { sagaBusMiddleware, sagaErrorHandler } from "./middleware.js";
export { createHealthRouter, createReadinessRouter } from "./health.js";
export type {
  SagaBusExpressOptions,
  HealthCheckOptions,
  GracefulShutdownOptions,
} from "./types.js";
export type { HealthStatus } from "./health.js";

// Re-export graceful shutdown helper
import type { Server } from "http";
import type { GracefulShutdownOptions } from "./types.js";

/**
 * Sets up graceful shutdown for Express server with bus drain.
 */
export function setupGracefulShutdown(
  server: Server,
  options: GracefulShutdownOptions
): void {
  const {
    bus,
    timeoutMs = 30000,
    onShutdownStart,
    onShutdownComplete,
  } = options;

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, starting graceful shutdown...`);

    if (onShutdownStart) {
      await onShutdownStart();
    }

    // Set shutdown timeout
    const timeout = setTimeout(() => {
      console.error("Graceful shutdown timeout, forcing exit");
      process.exit(1);
    }, timeoutMs);

    try {
      // Stop accepting new connections
      server.close();

      // Stop the bus (drains workers)
      await bus.stop();

      clearTimeout(timeout);

      if (onShutdownComplete) {
        await onShutdownComplete();
      }

      console.log("Graceful shutdown complete");
      process.exit(0);
    } catch (error) {
      console.error("Error during graceful shutdown:", error);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
