/**
 * Middleware Stack Example
 *
 * Demonstrates the full middleware stack working together:
 * - Tracing: OpenTelemetry distributed tracing
 * - Metrics: Prometheus-compatible metrics collection
 * - Logging: Structured logging with context
 * - Validation: Zod schema validation
 * - Idempotency: Message deduplication
 *
 * Middleware order matters! The recommended order is:
 * 1. Tracing (outermost - captures full span)
 * 2. Metrics (captures timing and counts)
 * 3. Idempotency (early exit for duplicates)
 * 4. Validation (validate before processing)
 * 5. Logging (innermost - logs with all context)
 */

import { createBus, type Bus } from "@saga-bus/core";
import { InMemoryTransport } from "@saga-bus/transport-inmemory";
import { InMemorySagaStore } from "@saga-bus/store-inmemory";

// Middleware imports
import { createLoggingMiddleware } from "@saga-bus/middleware-logging";
import { createTracingMiddleware } from "@saga-bus/middleware-tracing";
import { createMetricsMiddlewareWithMetrics } from "@saga-bus/middleware-metrics";
import { register as globalRegistry } from "prom-client";
import {
  createIdempotencyMiddleware,
  InMemoryIdempotencyStore,
} from "@saga-bus/middleware-idempotency";
import {
  createValidationMiddleware,
  createZodValidators,
} from "@saga-bus/middleware-validation";

// Zod for validation schemas
import { z } from "zod";

// Saga and types
import {
  OrderSaga,
  type OrderSagaState,
  type OrderSubmitted,
  type PaymentCaptured,
  type InventoryReserved,
  type ShipmentCreated,
} from "@saga-bus/examples-shared";

// ============================================
// Define Validation Schemas with Zod
// ============================================

const OrderItemSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  quantity: z.number().int().positive("Quantity must be positive"),
  price: z.number().positive("Price must be positive"),
});

const OrderSubmittedSchema = z.object({
  type: z.literal("OrderSubmitted"),
  orderId: z.string().min(1, "Order ID is required"),
  customerId: z.string().min(1, "Customer ID is required"),
  items: z.array(OrderItemSchema).min(1, "At least one item is required"),
  total: z.number().positive("Total must be positive"),
});

const PaymentCapturedSchema = z.object({
  type: z.literal("PaymentCaptured"),
  orderId: z.string().min(1),
  transactionId: z.string().min(1),
});

const InventoryReservedSchema = z.object({
  type: z.literal("InventoryReserved"),
  orderId: z.string().min(1),
  reservationId: z.string().min(1),
});

const ShipmentCreatedSchema = z.object({
  type: z.literal("ShipmentCreated"),
  orderId: z.string().min(1),
  trackingNumber: z.string().min(1),
});

// ============================================
// Main Application
// ============================================

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("  Middleware Stack Example");
  console.log("  Demonstrating: Tracing, Metrics, Idempotency, Validation, Logging");
  console.log("=".repeat(60));
  console.log();

  // Create transport and store
  const transport = new InMemoryTransport();
  const store = new InMemorySagaStore<OrderSagaState>();

  // ============================================
  // 1. Tracing Middleware (OpenTelemetry)
  // ============================================
  const tracingMiddleware = createTracingMiddleware({
    tracerName: "saga-bus-example",
    recordPayload: true,
    maxPayloadSize: 1024,
  });

  // ============================================
  // 2. Metrics Middleware (Prometheus)
  // ============================================
  const { middleware: metricsMiddleware } = createMetricsMiddlewareWithMetrics({
    prefix: "saga_bus",
    customLabels: { service: "example-middleware" },
  });

  // ============================================
  // 3. Idempotency Middleware
  // ============================================
  const idempotencyStore = new InMemoryIdempotencyStore();
  const idempotencyMiddleware = createIdempotencyMiddleware({
    store: idempotencyStore,
    windowMs: 60000, // 1 minute deduplication
    getMessageId: (envelope) => envelope.id,
    onDuplicate: "log", // Log duplicates instead of silently skipping
  });

  // ============================================
  // 4. Validation Middleware (Zod)
  // ============================================
  const validators = createZodValidators({
    OrderSubmitted: OrderSubmittedSchema,
    PaymentCaptured: PaymentCapturedSchema,
    InventoryReserved: InventoryReservedSchema,
    ShipmentCreated: ShipmentCreatedSchema,
  });

  const validationMiddleware = createValidationMiddleware({
    validators,
    onInvalid: "log", // Log invalid messages (could also throw or skip)
    strictMode: false, // Allow messages without validators to pass
  });

  // ============================================
  // 5. Logging Middleware
  // ============================================
  const loggingMiddleware = createLoggingMiddleware({
    level: "debug",
    logPayload: true,
    logState: true,
  });

  // ============================================
  // Create Bus with Middleware Stack
  // ============================================
  // Order: outer to inner (tracing wraps everything)
  const bus: Bus = createBus({
    transport,
    store,
    sagas: [{ definition: OrderSaga }],
    middleware: [
      tracingMiddleware, // 1. Outermost - captures full trace
      metricsMiddleware, // 2. Captures timing and counts
      idempotencyMiddleware, // 3. Early exit for duplicates
      validationMiddleware, // 4. Validate before processing
      loggingMiddleware, // 5. Innermost - logs with context
    ],
    logger: {
      debug: (msg, meta) => console.debug(`[DEBUG] ${msg}`, meta ?? ""),
      info: (msg, meta) => console.log(`[INFO] ${msg}`, meta ?? ""),
      warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta ?? ""),
      error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta ?? ""),
    },
  });

  // Start the bus
  await bus.start();
  console.log("\nBus started with middleware stack\n");

  // ============================================
  // Demo: Process Valid Order
  // ============================================
  console.log("-".repeat(60));
  console.log("Demo 1: Processing valid order");
  console.log("-".repeat(60));

  const orderId = `order-${Date.now()}`;

  const orderSubmitted: OrderSubmitted = {
    type: "OrderSubmitted",
    orderId,
    customerId: "customer-123",
    items: [
      { sku: "WIDGET-001", quantity: 2, price: 29.99 },
      { sku: "GADGET-002", quantity: 1, price: 49.99 },
    ],
    total: 109.97,
  };

  await bus.publish(orderSubmitted);
  await sleep(500);

  // ============================================
  // Demo: Test Idempotency
  // ============================================
  console.log("\n" + "-".repeat(60));
  console.log("Demo 2: Testing idempotency (republishing same message)");
  console.log("-".repeat(60));

  await bus.publish(orderSubmitted);
  await sleep(500);

  // ============================================
  // Demo: Test Validation with Invalid Message
  // ============================================
  console.log("\n" + "-".repeat(60));
  console.log("Demo 3: Testing validation (invalid message)");
  console.log("-".repeat(60));

  const invalidOrder = {
    type: "OrderSubmitted",
    orderId: "", // Invalid: empty
    customerId: "customer-123",
    items: [], // Invalid: empty array
    total: -10, // Invalid: negative
  } as OrderSubmitted;

  await bus.publish(invalidOrder);
  await sleep(500);

  // ============================================
  // Demo: Complete Order Flow
  // ============================================
  console.log("\n" + "-".repeat(60));
  console.log("Demo 4: Completing full order flow");
  console.log("-".repeat(60));

  const paymentCaptured: PaymentCaptured = {
    type: "PaymentCaptured",
    orderId,
    transactionId: `txn-${Date.now()}`,
  };
  await bus.publish(paymentCaptured);
  await sleep(500);

  const inventoryReserved: InventoryReserved = {
    type: "InventoryReserved",
    orderId,
    reservationId: `res-${Date.now()}`,
  };
  await bus.publish(inventoryReserved);
  await sleep(500);

  const shipmentCreated: ShipmentCreated = {
    type: "ShipmentCreated",
    orderId,
    trackingNumber: `TRACK-${Date.now()}`,
  };
  await bus.publish(shipmentCreated);
  await sleep(500);

  // ============================================
  // Print Metrics
  // ============================================
  console.log("\n" + "=".repeat(60));
  console.log("  Prometheus Metrics");
  console.log("=".repeat(60));

  const metrics = await globalRegistry.metrics();
  console.log(metrics);

  // ============================================
  // Final State
  // ============================================
  console.log("\n" + "=".repeat(60));
  console.log("  Final Order State");
  console.log("=".repeat(60));

  const finalState = await store.getByCorrelationId("OrderSaga", orderId);
  console.log(JSON.stringify(finalState, null, 2));

  // Cleanup
  await bus.stop();
  console.log("\nBus stopped");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Start the example
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
