/**
 * MongoDB Store Demo
 *
 * Demonstrates using MongoDB as the saga state store.
 * Features: Document-oriented, flexible schema, horizontal scaling
 *
 * Requires MongoDB 4.0+:
 *   -- The store will auto-create the collection and indexes
 *
 * Run with: pnpm demo:mongo
 */

import { MongoClient } from "mongodb";
import { createBus, type Bus } from "@saga-bus/core";
import { InMemoryTransport } from "@saga-bus/transport-inmemory";
import { MongoSagaStore } from "@saga-bus/store-mongo";
import { createLoggingMiddleware } from "@saga-bus/middleware-logging";
import {
  OrderSaga,
  type OrderSagaState,
  type OrderSubmitted,
  type PaymentCaptured,
  type InventoryReserved,
  type ShipmentCreated,
} from "@saga-bus/examples-shared";

const MONGO_URL =
  process.env.MONGODB_URL ?? "mongodb://localhost:27017/saga_bus";

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("  MongoDB Store Demo");
  console.log("=".repeat(60));
  console.log(`Connecting to: ${MONGO_URL.replace(/:[^:@]+@/, ":****@")}`);

  // Create MongoDB client
  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    console.log("\nMake sure MongoDB is running and accessible.");
    console.log("You can start MongoDB with Docker:");
    console.log("  docker run -d -p 27017:27017 mongo:7");
    process.exit(1);
  }

  const db = client.db();

  // Create store
  const store = new MongoSagaStore<OrderSagaState>({
    db,
    collectionName: "saga_instances",
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
  console.log("\nBus started with MongoDB store\n");

  // Run order flow
  const orderId = `mongo-order-${Date.now()}`;
  await runOrderFlow(bus, store, orderId);

  // Show store features
  console.log("\n--- MongoDB Store Features ---");

  // Count documents
  const count = await db.collection("saga_instances").countDocuments({
    _sagaName: "OrderSaga",
  });
  console.log(`Total sagas: ${count}`);

  // Query with MongoDB's powerful query language
  const completedSagas = await db
    .collection("saga_instances")
    .find({
      _sagaName: "OrderSaga",
      "metadata.isCompleted": true,
    })
    .limit(5)
    .toArray();
  console.log(`Completed sagas: ${completedSagas.length}`);

  // Cleanup
  await bus.stop();
  await client.close();
  console.log("\nDemo complete");
}

async function runOrderFlow(
  bus: Bus,
  store: MongoSagaStore<OrderSagaState>,
  orderId: string
): Promise<void> {
  console.log(`Processing order: ${orderId}`);

  const messages = [
    {
      type: "OrderSubmitted",
      orderId,
      customerId: "customer-mongo-123",
      items: [{ sku: "MONGO-001", quantity: 3, price: 33.33 }],
      total: 99.99,
    } as OrderSubmitted,
    {
      type: "PaymentCaptured",
      orderId,
      transactionId: `mongo-txn-${Date.now()}`,
    } as PaymentCaptured,
    {
      type: "InventoryReserved",
      orderId,
      reservationId: `mongo-res-${Date.now()}`,
    } as InventoryReserved,
    {
      type: "ShipmentCreated",
      orderId,
      trackingNumber: `MONGO-TRACK-${Date.now()}`,
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
