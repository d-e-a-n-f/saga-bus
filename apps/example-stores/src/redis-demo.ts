/**
 * Redis Store Demo
 *
 * Demonstrates using Redis as the saga state store.
 * Features: High performance, TTL support for auto-cleanup, atomic operations
 *
 * Requires Redis 6.0+:
 *   -- The store uses Hash data structures for saga state
 *
 * Run with: pnpm demo:redis
 */

import { Redis } from "ioredis";
import { createBus, type Bus } from "@saga-bus/core";
import { InMemoryTransport } from "@saga-bus/transport-inmemory";
import { RedisSagaStore } from "@saga-bus/store-redis";
import { createLoggingMiddleware } from "@saga-bus/middleware-logging";
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
  console.log("=".repeat(60));
  console.log("  Redis Store Demo");
  console.log("=".repeat(60));
  console.log(`Connecting to: ${REDIS_URL}`);

  // Create Redis client
  const redis = new Redis(REDIS_URL);

  try {
    await redis.ping();
    console.log("Connected to Redis");
  } catch (error) {
    console.error("Failed to connect to Redis:", error);
    console.log("\nMake sure Redis is running and accessible.");
    console.log("You can start Redis with Docker:");
    console.log("  docker run -d -p 6379:6379 redis:7");
    process.exit(1);
  }

  // Create store with TTL for completed sagas
  const store = new RedisSagaStore<OrderSagaState>({
    redis,
    keyPrefix: "saga:state:",
    completedTtlSeconds: 7 * 24 * 60 * 60, // 7 days TTL for completed sagas
  });

  // Create transport
  const transport = new InMemoryTransport();

  // Create bus
  const bus: Bus = createBus({
    transport,
    store,
    sagas: [{ definition: OrderSaga }],
    middleware: [
      createLoggingMiddleware({ level: "info", logPayload: true }),
    ],
    logger: {
      debug: () => {},
      info: (msg) => console.log(`[INFO] ${msg}`),
      warn: (msg) => console.warn(`[WARN] ${msg}`),
      error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta ?? ""),
    },
  });

  await bus.start();
  console.log("\nBus started with Redis store\n");

  // Run order flow
  const orderId = `redis-order-${Date.now()}`;
  await runOrderFlow(bus, store, orderId);

  // Show store features
  console.log("\n--- Redis Store Features ---");

  // Count keys (using SCAN for production safety)
  const keys = await redis.keys("saga:state:OrderSaga:*");
  console.log(`Total saga keys: ${keys.length}`);

  // Show TTL support
  const sagaId = await redis.get(`saga:idx:OrderSaga:${orderId}`);
  if (sagaId) {
    const ttl = await redis.ttl(`saga:state:OrderSaga:${sagaId}`);
    console.log(`TTL for completed saga: ${ttl > 0 ? `${Math.floor(ttl / 86400)} days` : "No TTL"}`);
  }

  // Show memory efficiency
  const info = await redis.info("memory");
  const usedMemory = info.match(/used_memory_human:(\S+)/)?.[1];
  console.log(`Redis memory usage: ${usedMemory}`);

  // Cleanup
  await bus.stop();
  redis.disconnect();
  console.log("\nDemo complete");
}

async function runOrderFlow(
  bus: Bus,
  store: RedisSagaStore<OrderSagaState>,
  orderId: string
): Promise<void> {
  console.log(`Processing order: ${orderId}`);

  const messages = [
    {
      type: "OrderSubmitted",
      orderId,
      customerId: "customer-redis-123",
      items: [{ sku: "REDIS-001", quantity: 1, price: 149.99 }],
      total: 149.99,
    } as OrderSubmitted,
    {
      type: "PaymentCaptured",
      orderId,
      transactionId: `redis-txn-${Date.now()}`,
    } as PaymentCaptured,
    {
      type: "InventoryReserved",
      orderId,
      reservationId: `redis-res-${Date.now()}`,
    } as InventoryReserved,
    {
      type: "ShipmentCreated",
      orderId,
      trackingNumber: `REDIS-TRACK-${Date.now()}`,
    } as ShipmentCreated,
  ];

  for (const msg of messages) {
    await bus.publish(msg);
    await sleep(300);
  }

  const finalState = await store.getByCorrelationId("OrderSaga", orderId);
  console.log("\nFinal state:", JSON.stringify(finalState, null, 2));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch(console.error);
