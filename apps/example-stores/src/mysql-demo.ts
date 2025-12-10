/**
 * MySQL Store Demo
 *
 * Demonstrates using MySQL as the saga state store.
 * Features: Wide compatibility, works with PlanetScale, Vitess, MariaDB
 *
 * Requires MySQL 5.7+ or MariaDB 10.2+ with JSON support:
 *   CREATE DATABASE saga_bus;
 *   -- The store will auto-create the saga_instances table
 *
 * Run with: pnpm demo:mysql
 */

import mysql from "mysql2/promise";
import { createBus, type Bus } from "@saga-bus/core";
import { InMemoryTransport } from "@saga-bus/transport-inmemory";
import { MySqlSagaStore } from "@saga-bus/store-mysql";
import { createLoggingMiddleware } from "@saga-bus/middleware-logging";
import {
  OrderSaga,
  type OrderSagaState,
  type OrderSubmitted,
  type PaymentCaptured,
  type InventoryReserved,
  type ShipmentCreated,
} from "@saga-bus/examples-shared";

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST ?? "localhost",
  port: parseInt(process.env.MYSQL_PORT ?? "3306"),
  user: process.env.MYSQL_USER ?? "saga",
  password: process.env.MYSQL_PASSWORD ?? "saga",
  database: process.env.MYSQL_DATABASE ?? "saga_bus",
};

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("  MySQL Store Demo");
  console.log("=".repeat(60));
  console.log(`Connecting to: ${MYSQL_CONFIG.host}:${MYSQL_CONFIG.port}/${MYSQL_CONFIG.database}`);

  // Create MySQL pool
  const pool = mysql.createPool({
    ...MYSQL_CONFIG,
    waitForConnections: true,
    connectionLimit: 10,
  });

  // Verify connection
  try {
    const conn = await pool.getConnection();
    await conn.query("SELECT 1");
    conn.release();
    console.log("Connected to MySQL");
  } catch (error) {
    console.error("Failed to connect to MySQL:", error);
    console.log("\nMake sure MySQL is running and accessible.");
    console.log("You can start MySQL with Docker:");
    console.log("  docker run -d -p 3306:3306 -e MYSQL_ROOT_PASSWORD=saga -e MYSQL_DATABASE=saga_bus mysql:8");
    process.exit(1);
  }

  // Create store
  const store = new MySqlSagaStore<OrderSagaState>({
    pool,
    tableName: "saga_instances",
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
  console.log("\nBus started with MySQL store\n");

  // Run order flow
  const orderId = `mysql-order-${Date.now()}`;
  await runOrderFlow(bus, store, orderId);

  // Show store features
  console.log("\n--- MySQL Store Features ---");

  const count = await store.countByName("OrderSaga");
  console.log(`Total sagas: ${count}`);

  const recentSagas = await store.findByName("OrderSaga", { limit: 5 });
  console.log(`Recent sagas: ${recentSagas.length}`);

  // Cleanup
  await bus.stop();
  await pool.end();
  console.log("\nDemo complete");
}

async function runOrderFlow(
  bus: Bus,
  store: MySqlSagaStore<OrderSagaState>,
  orderId: string
): Promise<void> {
  console.log(`Processing order: ${orderId}`);

  const messages = [
    {
      type: "OrderSubmitted",
      orderId,
      customerId: "customer-mysql-123",
      items: [{ sku: "MYSQL-001", quantity: 2, price: 49.99 }],
      total: 99.98,
    } as OrderSubmitted,
    {
      type: "PaymentCaptured",
      orderId,
      transactionId: `mysql-txn-${Date.now()}`,
    } as PaymentCaptured,
    {
      type: "InventoryReserved",
      orderId,
      reservationId: `mysql-res-${Date.now()}`,
    } as InventoryReserved,
    {
      type: "ShipmentCreated",
      orderId,
      trackingNumber: `MYSQL-TRACK-${Date.now()}`,
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
