# saga-bus

A MassTransit-style saga orchestration library for TypeScript/Node.js.

## Features

- **Type-Safe Sagas**: Full TypeScript support with fluent DSL
- **Message-Driven**: Publish/subscribe with correlation
- **Pluggable Storage**: In-memory, PostgreSQL, MongoDB, DynamoDB, or Prisma
- **Pluggable Transport**: In-memory, RabbitMQ, SQS, or Kafka
- **Middleware Pipeline**: Logging, tracing, multi-tenancy
- **Framework Integrations**: NestJS and Next.js support
- **Testing First**: Built-in test harness

## Packages

### Core

| Package | Description |
|---------|-------------|
| [@saga-bus/core](./packages/core) | Core types, DSL, and runtime |
| [@saga-bus/test](./packages/test) | Testing utilities and harness |

### Transports

| Package | Description |
|---------|-------------|
| [@saga-bus/transport-inmemory](./packages/transport-inmemory) | In-memory transport for testing |
| [@saga-bus/transport-rabbitmq](./packages/transport-rabbitmq) | RabbitMQ for production |
| [@saga-bus/transport-sqs](./packages/transport-sqs) | AWS SQS FIFO queues |
| [@saga-bus/transport-kafka](./packages/transport-kafka) | Apache Kafka |

### Stores

| Package | Description |
|---------|-------------|
| [@saga-bus/store-inmemory](./packages/store-inmemory) | In-memory store for testing |
| [@saga-bus/store-postgres](./packages/store-postgres) | PostgreSQL with pg driver |
| [@saga-bus/store-prisma](./packages/store-prisma) | Prisma ORM adapter |
| [@saga-bus/store-mongo](./packages/store-mongo) | MongoDB |
| [@saga-bus/store-dynamodb](./packages/store-dynamodb) | AWS DynamoDB |

### Middleware

| Package | Description |
|---------|-------------|
| [@saga-bus/middleware-logging](./packages/middleware-logging) | Structured logging |
| [@saga-bus/middleware-tracing](./packages/middleware-tracing) | OpenTelemetry distributed tracing |
| [@saga-bus/middleware-tenant](./packages/middleware-tenant) | Multi-tenant isolation |

### Framework Integrations

| Package | Description |
|---------|-------------|
| [@saga-bus/nestjs](./packages/nestjs) | NestJS module |
| [@saga-bus/nextjs](./packages/nextjs) | Next.js helpers |

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

For production, use a durable transport and persistent store:

### RabbitMQ + PostgreSQL

```typescript
import { RabbitMqTransport } from "@saga-bus/transport-rabbitmq";
import { PostgresSagaStore } from "@saga-bus/store-postgres";
import { createLoggingMiddleware } from "@saga-bus/middleware-logging";

// Single store shared across all sagas
const store = new PostgresSagaStore({ pool: pgPool });

const bus = createBus({
  transport: new RabbitMqTransport({
    uri: process.env.RABBITMQ_URL!,
    exchange: "saga-bus",
  }),
  store, // shared across all sagas
  sagas: [
    { definition: orderSaga },
    { definition: paymentSaga },
    { definition: shippingSaga },
  ],
  middleware: [createLoggingMiddleware({ logger })],
});
```

### AWS SQS + DynamoDB

```typescript
import { SqsTransport } from "@saga-bus/transport-sqs";
import { DynamoDBSagaStore } from "@saga-bus/store-dynamodb";

const store = new DynamoDBSagaStore({
  client: dynamoClient,
  tableName: "saga-instances",
});

const bus = createBus({
  transport: new SqsTransport({
    client: sqsClient,
    queueUrl: "https://sqs.../my-queue.fifo",
  }),
  store,
  sagas: [{ definition: orderSaga }, { definition: paymentSaga }],
});
```

### Kafka + MongoDB

```typescript
import { KafkaTransport } from "@saga-bus/transport-kafka";
import { MongoSagaStore } from "@saga-bus/store-mongo";

const store = new MongoSagaStore({ db: mongoDb });

const bus = createBus({
  transport: new KafkaTransport({
    kafka: new Kafka({ brokers: ["localhost:9092"] }),
    groupId: "my-app",
  }),
  store,
  sagas: [{ definition: orderSaga }, { definition: paymentSaga }],
});
```

### Per-Saga Store Override

If specific sagas need a different store, you can override at the saga level:

```typescript
const bus = createBus({
  transport,
  store: new PostgresSagaStore({ pool }), // default for all sagas
  sagas: [
    { definition: orderSaga },                        // uses default store
    { definition: paymentSaga },                      // uses default store
    { definition: auditSaga, store: auditOnlyStore }, // override with dedicated store
  ],
});
```

## Testing

Use the test harness for saga testing:

```typescript
import { TestHarness } from "@saga-bus/test";

const harness = await TestHarness.create({
  sagas: [{ definition: orderSaga, store: new InMemorySagaStore() }],
});

await harness.publish({ type: "OrderSubmitted", orderId: "123" });
await harness.waitForIdle();

const state = await harness.getSagaState("OrderSaga", "123");
expect(state?.status).toBe("submitted");
```

## Examples

See the [examples](./examples) directory for complete working applications:

| Example | Pattern | Description |
|---------|---------|-------------|
| [example-worker](./apps/example-worker) | Background Worker | Standalone saga processor with health/metrics |
| [example-nextjs](./apps/example-nextjs) | Message Producer | Next.js UI that publishes to RabbitMQ |
| [example-nestjs](./apps/example-nestjs) | Monolith | Full NestJS API with Swagger docs |

### Quick Start

```bash
cd examples
docker-compose up -d

# UIs available at:
# - http://localhost:3001   Next.js order form
# - http://localhost:3002/api   NestJS Swagger
# - http://localhost:15672   RabbitMQ Management
# - http://localhost:16686   Jaeger Tracing
# - http://localhost:3003   Grafana Dashboards
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
