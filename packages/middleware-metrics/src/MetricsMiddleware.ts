import {
  Counter,
  Histogram,
  register as defaultRegister,
} from "prom-client";
import type { SagaMiddleware, SagaPipelineContext } from "@saga-bus/core";
import type { MetricsMiddlewareOptions, SagaBusMetrics } from "./types.js";

const DEFAULT_DURATION_BUCKETS = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

/**
 * Creates a Prometheus metrics middleware for saga-bus.
 *
 * Records:
 * - Messages processed (counter)
 * - Messages failed (counter)
 * - Processing duration (histogram)
 * - Sagas created (counter)
 * - Sagas completed (counter)
 *
 * @example
 * ```typescript
 * import { createMetricsMiddleware } from "@saga-bus/middleware-metrics";
 * import { register } from "prom-client";
 *
 * const metricsMiddleware = createMetricsMiddleware({
 *   prefix: "my_app",
 * });
 *
 * const bus = createBus({
 *   middleware: [metricsMiddleware],
 *   // ...
 * });
 *
 * // Expose metrics endpoint
 * app.get("/metrics", async (req, res) => {
 *   res.set("Content-Type", register.contentType);
 *   res.end(await register.metrics());
 * });
 * ```
 */
export function createMetricsMiddleware(
  options: MetricsMiddlewareOptions = {}
): SagaMiddleware {
  const registry = options.registry ?? defaultRegister;
  const prefix = options.prefix ?? "saga_bus";
  const durationBuckets = options.durationBuckets ?? DEFAULT_DURATION_BUCKETS;
  const recordSagaLabels = options.recordSagaLabels ?? true;

  // Build label names
  const baseLabelNames = ["message_type"];
  const sagaLabelNames = recordSagaLabels
    ? [...baseLabelNames, "saga_name"]
    : baseLabelNames;

  // Create metrics
  const messagesProcessed = new Counter({
    name: `${prefix}_messages_processed_total`,
    help: "Total number of messages successfully processed",
    labelNames: sagaLabelNames,
    registers: [registry],
  });

  const messagesFailed = new Counter({
    name: `${prefix}_messages_failed_total`,
    help: "Total number of messages that failed processing",
    labelNames: [...sagaLabelNames, "error_type"],
    registers: [registry],
  });

  const processingDuration = new Histogram({
    name: `${prefix}_message_processing_duration_ms`,
    help: "Message processing duration in milliseconds",
    labelNames: sagaLabelNames,
    buckets: durationBuckets,
    registers: [registry],
  });

  const sagasCreated = new Counter({
    name: `${prefix}_sagas_created_total`,
    help: "Total number of new saga instances created",
    labelNames: ["saga_name", "message_type"],
    registers: [registry],
  });

  const sagasCompleted = new Counter({
    name: `${prefix}_sagas_completed_total`,
    help: "Total number of saga instances completed",
    labelNames: ["saga_name"],
    registers: [registry],
  });

  return async (ctx: SagaPipelineContext, next: () => Promise<void>) => {
    const startTime = performance.now();
    const messageType = ctx.envelope.type;
    const sagaName = ctx.sagaName;
    const isNewSaga = !ctx.existingState;

    const labels = recordSagaLabels
      ? { message_type: messageType, saga_name: sagaName }
      : { message_type: messageType };

    try {
      await next();

      // Record successful processing
      const durationMs = performance.now() - startTime;
      messagesProcessed.inc(labels);
      processingDuration.observe(labels, durationMs);

      // Track saga lifecycle
      if (isNewSaga && ctx.postState) {
        sagasCreated.inc({ saga_name: sagaName, message_type: messageType });
      }

      if (ctx.postState?.metadata?.isCompleted) {
        sagasCompleted.inc({ saga_name: sagaName });
      }
    } catch (error) {
      // Record failed processing
      const durationMs = performance.now() - startTime;
      const errorType = getErrorType(error);

      messagesFailed.inc({ ...labels, error_type: errorType });
      processingDuration.observe(labels, durationMs);

      throw error;
    }
  };
}

function getErrorType(error: unknown): string {
  if (error instanceof Error) {
    return error.name || "Error";
  }
  return "Unknown";
}

/**
 * Creates metrics and returns both the middleware and the metrics objects.
 * Useful when you need direct access to the metric objects.
 *
 * @example
 * ```typescript
 * const { middleware, metrics } = createMetricsMiddlewareWithMetrics();
 *
 * // Access metrics directly
 * console.log(await metrics.messagesProcessed.get());
 * ```
 */
export function createMetricsMiddlewareWithMetrics(
  options: MetricsMiddlewareOptions = {}
): { middleware: SagaMiddleware; metrics: SagaBusMetrics } {
  const registry = options.registry ?? defaultRegister;
  const prefix = options.prefix ?? "saga_bus";
  const durationBuckets = options.durationBuckets ?? DEFAULT_DURATION_BUCKETS;
  const recordSagaLabels = options.recordSagaLabels ?? true;

  // Build label names
  const baseLabelNames = ["message_type"];
  const sagaLabelNames = recordSagaLabels
    ? [...baseLabelNames, "saga_name"]
    : baseLabelNames;

  // Create metrics
  const messagesProcessed = new Counter({
    name: `${prefix}_messages_processed_total`,
    help: "Total number of messages successfully processed",
    labelNames: sagaLabelNames,
    registers: [registry],
  });

  const messagesFailed = new Counter({
    name: `${prefix}_messages_failed_total`,
    help: "Total number of messages that failed processing",
    labelNames: [...sagaLabelNames, "error_type"],
    registers: [registry],
  });

  const processingDuration = new Histogram({
    name: `${prefix}_message_processing_duration_ms`,
    help: "Message processing duration in milliseconds",
    labelNames: sagaLabelNames,
    buckets: durationBuckets,
    registers: [registry],
  });

  const sagasCreated = new Counter({
    name: `${prefix}_sagas_created_total`,
    help: "Total number of new saga instances created",
    labelNames: ["saga_name", "message_type"],
    registers: [registry],
  });

  const sagasCompleted = new Counter({
    name: `${prefix}_sagas_completed_total`,
    help: "Total number of saga instances completed",
    labelNames: ["saga_name"],
    registers: [registry],
  });

  const metrics: SagaBusMetrics = {
    messagesProcessed,
    messagesFailed,
    processingDuration,
    sagasCreated,
    sagasCompleted,
  };

  const middleware: SagaMiddleware = async (
    ctx: SagaPipelineContext,
    next: () => Promise<void>
  ) => {
    const startTime = performance.now();
    const messageType = ctx.envelope.type;
    const sagaName = ctx.sagaName;
    const isNewSaga = !ctx.existingState;

    const labels = recordSagaLabels
      ? { message_type: messageType, saga_name: sagaName }
      : { message_type: messageType };

    try {
      await next();

      const durationMs = performance.now() - startTime;
      messagesProcessed.inc(labels);
      processingDuration.observe(labels, durationMs);

      if (isNewSaga && ctx.postState) {
        sagasCreated.inc({ saga_name: sagaName, message_type: messageType });
      }

      if (ctx.postState?.metadata?.isCompleted) {
        sagasCompleted.inc({ saga_name: sagaName });
      }
    } catch (error) {
      const durationMs = performance.now() - startTime;
      const errorType = getErrorType(error);

      messagesFailed.inc({ ...labels, error_type: errorType });
      processingDuration.observe(labels, durationMs);

      throw error;
    }
  };

  return { middleware, metrics };
}
