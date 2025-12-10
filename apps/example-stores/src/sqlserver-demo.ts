/**
 * SQL Server Store Demo
 *
 * Demonstrates using SQL Server as the saga state store.
 * Features: Enterprise-ready, Azure SQL compatible, Windows/.NET integration
 *
 * Requires SQL Server 2016+ or Azure SQL:
 *   CREATE DATABASE saga_bus;
 *   -- The store will auto-create the saga_instances table
 *
 * Run with: pnpm demo:sqlserver
 */

import sql from "mssql";
import { createBus, type Bus } from "@saga-bus/core";
import { InMemoryTransport } from "@saga-bus/transport-inmemory";
import { SqlServerSagaStore } from "@saga-bus/store-sqlserver";
import { createLoggingMiddleware } from "@saga-bus/middleware-logging";
import {
  OrderSaga,
  type OrderSagaState,
  type OrderSubmitted,
  type PaymentCaptured,
  type InventoryReserved,
  type ShipmentCreated,
} from "@saga-bus/examples-shared";

const SQL_CONFIG: sql.config = {
  server: process.env.MSSQL_HOST ?? "localhost",
  port: parseInt(process.env.MSSQL_PORT ?? "1433"),
  user: process.env.MSSQL_USER ?? "sa",
  password: process.env.MSSQL_PASSWORD ?? "YourStrong@Passw0rd",
  database: process.env.MSSQL_DATABASE ?? "saga_bus",
  options: {
    encrypt: false, // Set to true for Azure
    trustServerCertificate: true, // For local development
  },
};

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("  SQL Server Store Demo");
  console.log("=".repeat(60));
  console.log(`Connecting to: ${SQL_CONFIG.server}:${SQL_CONFIG.port}/${SQL_CONFIG.database}`);

  // Create connection pool
  let pool: sql.ConnectionPool;
  try {
    pool = await sql.connect(SQL_CONFIG);
    console.log("Connected to SQL Server");
  } catch (error) {
    console.error("Failed to connect to SQL Server:", error);
    console.log("\nMake sure SQL Server is running and accessible.");
    console.log("You can start SQL Server with Docker:");
    console.log("  docker run -d -p 1433:1433 -e ACCEPT_EULA=Y -e SA_PASSWORD=YourStrong@Passw0rd mcr.microsoft.com/mssql/server:2022-latest");
    process.exit(1);
  }

  // Create store
  const store = new SqlServerSagaStore<OrderSagaState>({
    pool,
    schema: "dbo",
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
  console.log("\nBus started with SQL Server store\n");

  // Run order flow
  const orderId = `mssql-order-${Date.now()}`;
  await runOrderFlow(bus, store, orderId);

  // Show store features
  console.log("\n--- SQL Server Store Features ---");

  const count = await store.countByName("OrderSaga");
  console.log(`Total sagas: ${count}`);

  const recentSagas = await store.findByName("OrderSaga", { limit: 5 });
  console.log(`Recent sagas: ${recentSagas.length}`);

  // Cleanup
  await bus.stop();
  await pool.close();
  console.log("\nDemo complete");
}

async function runOrderFlow(
  bus: Bus,
  store: SqlServerSagaStore<OrderSagaState>,
  orderId: string
): Promise<void> {
  console.log(`Processing order: ${orderId}`);

  const messages = [
    {
      type: "OrderSubmitted",
      orderId,
      customerId: "customer-mssql-123",
      items: [{ sku: "MSSQL-001", quantity: 1, price: 199.99 }],
      total: 199.99,
    } as OrderSubmitted,
    {
      type: "PaymentCaptured",
      orderId,
      transactionId: `mssql-txn-${Date.now()}`,
    } as PaymentCaptured,
    {
      type: "InventoryReserved",
      orderId,
      reservationId: `mssql-res-${Date.now()}`,
    } as InventoryReserved,
    {
      type: "ShipmentCreated",
      orderId,
      trackingNumber: `MSSQL-TRACK-${Date.now()}`,
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
