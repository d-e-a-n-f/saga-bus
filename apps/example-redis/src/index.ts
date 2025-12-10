/**
 * Redis Example - Using Redis Streams Transport and Redis Store
 *
 * This example demonstrates:
 * - Redis Streams for message transport (XADD/XREADGROUP)
 * - Redis for saga state storage with TTL support
 * - Idempotency middleware for deduplication
 * - Consumer groups for competing consumers
 *
 * Run with: pnpm dev
 * Requires: Redis server running on localhost:6379
 */

import { Redis } from "ioredis";
import { createBus, type Bus } from "@saga-bus/core";
import { RedisTransport } from "@saga-bus/transport-redis";
import { RedisSagaStore } from "@saga-bus/store-redis";
import { createLoggingMiddleware } from "@saga-bus/middleware-logging";
import {
  createIdempotencyMiddleware,
  RedisIdempotencyStore,
} from "@saga-bus/middleware-idempotency";
import {
  OrderSaga,
  type OrderSagaState,
  type OrderSubmitted,
  type PaymentCaptured,
  type InventoryReserved,
  type ShipmentCreated,
} from "@saga-bus/examples-shared";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

async function main(): Promise<void> {
  console.log("Starting Redis-based saga worker...");
  console.log(`Redis: ${REDIS_URL}`);

  // Create separate Redis clients for different purposes
  // (recommended for production to avoid blocking)
  const transportRedis = new Redis(REDIS_URL);
  const storeRedis = new Redis(REDIS_URL);
  const idempotencyRedis = new Redis(REDIS_URL);

  // Verify Redis connection
  try {
    await transportRedis.ping();
    console.log("Connected to Redis");
  } catch (error) {
    console.error("Failed to connect to Redis:", error);
    process.exit(1);
  }

  // Create Redis transport using Streams
  const transport = new RedisTransport({
    redis: transportRedis,
    keyPrefix: "saga-bus:",
    consumerGroup: "saga-workers",
    consumerName: `worker-${process.pid}`,
    blockTimeoutMs: 5000,
    minIdleTimeMs: 30000, // Reclaim stuck messages after 30s
  });

  // Create Redis store with TTL for completed sagas
  const store = new RedisSagaStore<OrderSagaState>({
    redis: storeRedis,
    keyPrefix: "saga:state:",
    completedTtlSeconds: 7 * 24 * 60 * 60, // 7 days TTL for completed sagas
  });

  // Create idempotency middleware with Redis backend
  // The RedisIdempotencyStore expects a subset of Redis methods that ioredis provides
  const idempotencyStore = new RedisIdempotencyStore({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    redis: idempotencyRedis as any,
    keyPrefix: "saga:idempotency:",
  });

  const idempotencyMiddleware = createIdempotencyMiddleware({
    store: idempotencyStore,
    windowMs: 60000, // 1 minute deduplication window
    getMessageId: (envelope) => envelope.id,
    onDuplicate: "skip",
  });

  // Create logging middleware
  const loggingMiddleware = createLoggingMiddleware({
    level: "info",
    logPayload: true,
  });

  // Create bus
  const bus: Bus = createBus({
    transport,
    store,
    sagas: [{ definition: OrderSaga }],
    middleware: [idempotencyMiddleware, loggingMiddleware],
    logger: {
      debug: (msg, meta) => console.debug(`[DEBUG] ${msg}`, meta ?? ""),
      info: (msg, meta) => console.log(`[INFO] ${msg}`, meta ?? ""),
      warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta ?? ""),
      error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta ?? ""),
    },
  });

  // Graceful shutdown
  let isShuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`\nReceived ${signal}, shutting down gracefully...`);

    try {
      await bus.stop();
      console.log("Bus stopped");

      transportRedis.disconnect();
      storeRedis.disconnect();
      idempotencyRedis.disconnect();
      console.log("Redis connections closed");

      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error);
      process.exit(1);
    }
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  // Start the bus
  await bus.start();
  console.log("Worker is ready and processing messages from Redis Streams");

  // Demo: Simulate some orders
  console.log("\n--- Simulating Order Flow ---\n");

  // Submit an order
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

  console.log(`Publishing OrderSubmitted for ${orderId}`);
  await bus.publish(orderSubmitted);

  // Wait a bit for processing
  await sleep(1000);

  // Simulate payment capture
  const paymentCaptured: PaymentCaptured = {
    type: "PaymentCaptured",
    orderId,
    transactionId: `txn-${Date.now()}`,
  };

  console.log(`Publishing PaymentCaptured for ${orderId}`);
  await bus.publish(paymentCaptured);

  await sleep(1000);

  // Simulate inventory reserved
  const inventoryReserved: InventoryReserved = {
    type: "InventoryReserved",
    orderId,
    reservationId: `res-${Date.now()}`,
  };

  console.log(`Publishing InventoryReserved for ${orderId}`);
  await bus.publish(inventoryReserved);

  await sleep(1000);

  // Simulate shipment created
  const shipmentCreated: ShipmentCreated = {
    type: "ShipmentCreated",
    orderId,
    trackingNumber: `TRACK-${Date.now()}`,
  };

  console.log(`Publishing ShipmentCreated for ${orderId}`);
  await bus.publish(shipmentCreated);

  await sleep(1000);

  // Check final state
  const finalState = await store.getByCorrelationId("OrderSaga", orderId);
  console.log("\n--- Final Order State ---");
  console.log(JSON.stringify(finalState, null, 2));

  // Test idempotency - republish same message
  console.log("\n--- Testing Idempotency (republishing same message) ---");
  await bus.publish(orderSubmitted);
  await sleep(500);
  console.log("Duplicate message should have been skipped by idempotency middleware");

  // Keep running to process more messages
  console.log("\n--- Worker running. Press Ctrl+C to stop ---");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Start the worker
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
