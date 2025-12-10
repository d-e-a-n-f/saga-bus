/**
 * PostgreSQL Store Demo
 *
 * Demonstrates using PostgreSQL as the saga state store.
 * Features: ACID transactions, JSON storage, mature ecosystem
 *
 * Requires PostgreSQL 12+ with the following setup:
 *   CREATE DATABASE saga_bus;
 *   -- The store will auto-create the saga_instances table
 *
 * Run with: pnpm demo:postgres
 */

import { Pool } from "pg";
import { createBus, type Bus } from "@saga-bus/core";
import { InMemoryTransport } from "@saga-bus/transport-inmemory";
import { PostgresSagaStore } from "@saga-bus/store-postgres";
import { createLoggingMiddleware } from "@saga-bus/middleware-logging";
import {
  OrderSaga,
  type OrderSagaState,
  type OrderSubmitted,
  type PaymentCaptured,
  type InventoryReserved,
  type ShipmentCreated,
} from "@saga-bus/examples-shared";

const POSTGRES_URL =
  process.env.DATABASE_URL ?? "postgresql://saga:saga@localhost:5432/saga_bus";

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("  PostgreSQL Store Demo");
  console.log("=".repeat(60));
  console.log(`Connecting to: ${POSTGRES_URL.replace(/:[^:@]+@/, ":****@")}`);

  // Create PostgreSQL pool
  const pool = new Pool({ connectionString: POSTGRES_URL });

  // Verify connection
  try {
    await pool.query("SELECT 1");
    console.log("Connected to PostgreSQL");
  } catch (error) {
    console.error("Failed to connect to PostgreSQL:", error);
    console.log("\nMake sure PostgreSQL is running and accessible.");
    process.exit(1);
  }

  // Create store with auto table creation
  const store = new PostgresSagaStore<OrderSagaState>({
    pool,
    tableName: "saga_instances",
    // schemaName: "public", // Optional: specify schema
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
  console.log("\nBus started with PostgreSQL store\n");

  // Run order flow
  const orderId = `pg-order-${Date.now()}`;
  await runOrderFlow(bus, store, orderId);

  // Show store features
  console.log("\n--- PostgreSQL Store Features ---");

  // Query helpers
  const count = await store.countByName("OrderSaga");
  console.log(`Total sagas: ${count}`);

  const recentSagas = await store.findByName("OrderSaga", { limit: 5 });
  console.log(`Recent sagas: ${recentSagas.length}`);

  // Cleanup old completed sagas
  // const deletedCount = await store.deleteCompletedBefore(
  //   "OrderSaga",
  //   new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
  // );
  // console.log(`Cleaned up ${deletedCount} old sagas`);

  // Cleanup
  await bus.stop();
  await pool.end();
  console.log("\nDemo complete");
}

async function runOrderFlow(
  bus: Bus,
  store: PostgresSagaStore<OrderSagaState>,
  orderId: string
): Promise<void> {
  console.log(`Processing order: ${orderId}`);

  const messages = [
    {
      type: "OrderSubmitted",
      orderId,
      customerId: "customer-pg-123",
      items: [{ sku: "PG-001", quantity: 1, price: 99.99 }],
      total: 99.99,
    } as OrderSubmitted,
    {
      type: "PaymentCaptured",
      orderId,
      transactionId: `pg-txn-${Date.now()}`,
    } as PaymentCaptured,
    {
      type: "InventoryReserved",
      orderId,
      reservationId: `pg-res-${Date.now()}`,
    } as InventoryReserved,
    {
      type: "ShipmentCreated",
      orderId,
      trackingNumber: `PG-TRACK-${Date.now()}`,
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
