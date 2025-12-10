import { createBus, type Bus } from "@saga-bus/core";
import { InMemoryTransport } from "@saga-bus/transport-inmemory";
import { InMemorySagaStore } from "@saga-bus/store-inmemory";
import { createLoggingMiddleware } from "@saga-bus/middleware-logging";
import {
  LoanApplicationSaga,
  type LoanApplicationSagaState,
} from "@saga-bus/examples-shared";

// Create singleton instances for the example
const transport = new InMemoryTransport();
const store = new InMemorySagaStore<LoanApplicationSagaState>();

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
