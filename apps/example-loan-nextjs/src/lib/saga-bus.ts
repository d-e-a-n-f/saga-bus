import { Pool } from "pg";
import { createBus, type Bus } from "@saga-bus/core";
import { RabbitMqTransport } from "@saga-bus/transport-rabbitmq";
import { PostgresSagaStore } from "@saga-bus/store-postgres";
import { createLoggingMiddleware } from "@saga-bus/middleware-logging";
import {
  LoanApplicationSaga,
  type LoanApplicationSagaState,
} from "@saga-bus/examples-shared";

// Configuration from environment
const POSTGRES_URL =
  process.env.DATABASE_URL ?? "postgresql://saga:saga@localhost:5432/saga_bus";
const RABBITMQ_URL = process.env.RABBITMQ_URL ?? "amqp://saga:saga@localhost:5672";
const RABBITMQ_EXCHANGE = process.env.RABBITMQ_EXCHANGE ?? "saga-bus";

// Create PostgreSQL pool
const pool = new Pool({
  connectionString: POSTGRES_URL,
});

// Create RabbitMQ transport
const transport = new RabbitMqTransport({
  uri: RABBITMQ_URL,
  exchange: RABBITMQ_EXCHANGE,
  exchangeType: "topic",
  durable: true,
});

// Create PostgreSQL store
const store = new PostgresSagaStore<LoanApplicationSagaState>({
  pool,
  tableName: "loan_saga_instances",
});

// Create logging middleware
const loggingMiddleware = createLoggingMiddleware({
  level: "info",
  logPayload: true,
  logState: true,
});

// Create bus
let bus: Bus | null = null;
let startPromise: Promise<void> | null = null;

export async function getSagaBus(): Promise<Bus> {
  if (!bus) {
    bus = createBus({
      transport,
      store,
      sagas: [{ definition: LoanApplicationSaga }],
      middleware: [loggingMiddleware],
      logger: {
        debug: (msg, meta) => console.debug(`[DEBUG] ${msg}`, meta ?? ""),
        info: (msg, meta) => console.log(`[INFO] ${msg}`, meta ?? ""),
        warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta ?? ""),
        error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta ?? ""),
      },
    });
  }

  if (!startPromise) {
    startPromise = bus.start();
  }

  await startPromise;
  return bus;
}

export function getStore() {
  return store;
}

export function getTransport() {
  return transport;
}

export function getPool() {
  return pool;
}
