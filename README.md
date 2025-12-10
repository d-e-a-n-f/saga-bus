# saga-bus

A MassTransit-style saga orchestration library for TypeScript/Node.js.

## Features

- **Type-Safe Sagas**: Full TypeScript support with fluent DSL
- **Message-Driven**: Publish/subscribe with correlation
- **Pluggable Storage**: In-memory, PostgreSQL, or Prisma
- **Pluggable Transport**: In-memory or RabbitMQ
- **Middleware Pipeline**: Extensible processing
- **Testing First**: Built-in test harness

## Packages

| Package | Description |
|---------|-------------|
| `@saga-bus/core` | Core types, DSL, and runtime |
| `@saga-bus/transport-inmemory` | In-memory transport for testing |
| `@saga-bus/transport-rabbitmq` | RabbitMQ production transport |
| `@saga-bus/store-inmemory` | In-memory store for testing |
| `@saga-bus/store-postgres` | PostgreSQL store with pg driver |
| `@saga-bus/store-prisma` | Prisma ORM adapter |
| `@saga-bus/middleware-logging` | Structured logging middleware |
| `@saga-bus/test` | Testing utilities |

## Quick Start

```bash
pnpm add @saga-bus/core @saga-bus/transport-inmemory @saga-bus/store-inmemory
```

```typescript
import { createSagaMachine, createBus } from "@saga-bus/core";
import { InMemoryTransport } from "@saga-bus/transport-inmemory";
import { InMemorySagaStore } from "@saga-bus/store-inmemory";

// Define messages
interface OrderSubmitted {
  type: "OrderSubmitted";
  orderId: string;
}

interface OrderState {
  orderId: string;
  status: string;
}

// Create saga
const orderSaga = createSagaMachine<OrderState, OrderSubmitted>()
  .name("OrderSaga")
  .correlate("OrderSubmitted", (m) => m.orderId, { canStart: true })
  .initial<OrderSubmitted>((m) => ({
    orderId: m.orderId,
    status: "submitted",
  }))
  .on("OrderSubmitted")
    .handle(async (msg, ctx) => {
      console.log("Order received:", msg.orderId);
      ctx.complete();
    })
  .build();

// Create and run bus
const bus = createBus({
  transport: new InMemoryTransport(),
  sagas: [{ definition: orderSaga, store: new InMemorySagaStore() }],
});

await bus.start();
await bus.publish({ type: "OrderSubmitted", orderId: "123" });
```

## Production Setup

For production, use RabbitMQ and PostgreSQL:

```typescript
import { RabbitMqTransport } from "@saga-bus/transport-rabbitmq";
import { PostgresSagaStore } from "@saga-bus/store-postgres";
import { createLoggingMiddleware } from "@saga-bus/middleware-logging";

const bus = createBus({
  transport: new RabbitMqTransport({
    uri: process.env.RABBITMQ_URL!,
    exchange: "saga-bus",
  }),
  sagas: [{
    definition: orderSaga,
    store: new PostgresSagaStore({
      pool: pgPool,
    }),
  }],
  middleware: [createLoggingMiddleware({ logger })],
});
```

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Type check
pnpm check-types

# Lint
pnpm lint
```

## License

MIT
