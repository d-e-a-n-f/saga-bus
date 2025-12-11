# saga-bus

A MassTransit-style saga orchestration library for TypeScript/Node.js.

## Features

- **Type-Safe Sagas**: Full TypeScript support with fluent DSL
- **Message-Driven**: Publish/subscribe with correlation
- **Saga Timeouts**: Built-in timeout tracking and expiration
- **Pluggable Storage**: In-memory, PostgreSQL, MySQL, SQL Server, MongoDB, DynamoDB, Redis, or Prisma
- **Pluggable Transport**: In-memory, RabbitMQ, Kafka, SQS, Azure Service Bus, GCP Pub/Sub, Redis Streams, or NATS
- **Middleware Pipeline**: Logging, tracing, metrics, validation, idempotency, multi-tenancy
- **Framework Integrations**: NestJS, Next.js, Express, Fastify, and Hono
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
| [@saga-bus/transport-rabbitmq](./packages/transport-rabbitmq) | RabbitMQ with topic exchanges |
| [@saga-bus/transport-kafka](./packages/transport-kafka) | Apache Kafka with consumer groups |
| [@saga-bus/transport-sqs](./packages/transport-sqs) | AWS SQS FIFO queues |
| [@saga-bus/transport-azure-servicebus](./packages/transport-azure-servicebus) | Azure Service Bus with sessions |
| [@saga-bus/transport-gcp-pubsub](./packages/transport-gcp-pubsub) | Google Cloud Pub/Sub |
| [@saga-bus/transport-redis](./packages/transport-redis) | Redis Streams with consumer groups |
| [@saga-bus/transport-nats](./packages/transport-nats) | NATS JetStream |

### Stores

| Package | Description |
|---------|-------------|
| [@saga-bus/store-inmemory](./packages/store-inmemory) | In-memory store for testing |
| [@saga-bus/store-postgres](./packages/store-postgres) | PostgreSQL with pg driver |
| [@saga-bus/store-mysql](./packages/store-mysql) | MySQL/MariaDB with mysql2 |
| [@saga-bus/store-sqlserver](./packages/store-sqlserver) | SQL Server/Azure SQL with mssql |
| [@saga-bus/store-mongo](./packages/store-mongo) | MongoDB |
| [@saga-bus/store-dynamodb](./packages/store-dynamodb) | AWS DynamoDB |
| [@saga-bus/store-redis](./packages/store-redis) | Redis with TTL support |
| [@saga-bus/store-prisma](./packages/store-prisma) | Prisma ORM adapter |

### Middleware

| Package | Description |
|---------|-------------|
| [@saga-bus/middleware-logging](./packages/middleware-logging) | Structured logging |
| [@saga-bus/middleware-tracing](./packages/middleware-tracing) | OpenTelemetry distributed tracing |
| [@saga-bus/middleware-metrics](./packages/middleware-metrics) | Prometheus metrics |
| [@saga-bus/middleware-validation](./packages/middleware-validation) | Zod schema validation |
| [@saga-bus/middleware-idempotency](./packages/middleware-idempotency) | Message deduplication |
| [@saga-bus/middleware-tenant](./packages/middleware-tenant) | Multi-tenant isolation |

### Framework Integrations

| Package | Description |
|---------|-------------|
| [@saga-bus/nestjs](./packages/nestjs) | NestJS module with DI |
| [@saga-bus/nextjs](./packages/nextjs) | Next.js App Router helpers |
| [@saga-bus/express](./packages/express) | Express middleware and routers |
| [@saga-bus/fastify](./packages/fastify) | Fastify plugin |
| [@saga-bus/hono](./packages/hono) | Hono middleware (edge runtimes) |

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

See the [apps](./apps) directory for complete working applications:

| Example | Description |
|---------|-------------|
| [example-worker](./apps/example-worker) | Standalone saga processor with health/metrics endpoints |
| [example-nextjs](./apps/example-nextjs) | Next.js UI for order submission (RabbitMQ + PostgreSQL) |
| [example-nestjs](./apps/example-nestjs) | Full NestJS API with Swagger docs |
| [example-loan-nextjs](./apps/example-loan-nextjs) | Complex 30+ state loan application saga with Next.js UI |
| [example-redis](./apps/example-redis) | Redis Streams transport + Redis store demo |
| [example-stores](./apps/example-stores) | Database store demos (PostgreSQL, MySQL, SQL Server, MongoDB, Redis) |
| [example-middleware](./apps/example-middleware) | Full middleware stack (tracing, metrics, validation, idempotency) |

### Quick Start

```bash
# Start infrastructure
docker-compose up -d

# Run the loan application example
cd apps/example-loan-nextjs
pnpm dev

# UIs available at:
# - http://localhost:3001   Next.js order form
# - http://localhost:3002   Loan application UI
# - http://localhost:15672  RabbitMQ Management
# - http://localhost:16686  Jaeger Tracing
```

## Operational Defaults

The bus uses sensible defaults that can be overridden via configuration:

### Retry Policy

| Setting | Default | Description |
|---------|---------|-------------|
| `maxAttempts` | 3 | Total attempts before sending to DLQ |
| `baseDelayMs` | 1000 | Initial retry delay (1 second) |
| `maxDelayMs` | 30000 | Maximum retry delay (30 seconds) |
| `backoff` | `"exponential"` | Backoff strategy (`"exponential"` or `"linear"`) |

With exponential backoff, delays are: 1s → 2s → 4s → 8s → ... (capped at `maxDelayMs`).

### Dead Letter Queue (DLQ)

Failed messages (after max retries) are sent to a DLQ named `{endpoint}.dlq` by default.

```typescript
const bus = createBus({
  // ...
  worker: {
    dlqNaming: (endpoint) => `${endpoint}.dead-letter`, // custom naming
  },
});
```

### Worker Concurrency

| Setting | Default | Description |
|---------|---------|-------------|
| `defaultConcurrency` | 1 | Messages processed concurrently per endpoint |

```typescript
const bus = createBus({
  // ...
  worker: {
    defaultConcurrency: 5, // process 5 messages concurrently
    sagas: {
      OrderSaga: { concurrency: 10 }, // per-saga override
    },
  },
});
```

### Error Classification

Errors are automatically classified:

- **Transient** (retry): Connection errors, timeouts, concurrency conflicts
- **Permanent** (DLQ): All other errors

```typescript
import { createErrorHandler } from "@saga-bus/core";

const bus = createBus({
  // ...
  errorHandler: createErrorHandler({
    additionalTransientPatterns: [/rate limit/i],
    customClassifier: (error, ctx) => {
      if (error instanceof MyCustomError) return "drop";
      return null; // fall through to default
    },
  }),
});
```

### Saga Timeouts

Timeouts have configurable bounds to prevent accidental extreme values:

| Setting | Default | Description |
|---------|---------|-------------|
| `minTimeoutMs` | 1000 | Minimum timeout (1 second) |
| `maxTimeoutMs` | 604800000 | Maximum timeout (7 days) |

```typescript
const bus = createBus({
  // ...
  worker: {
    timeoutBounds: {
      minMs: 5000,      // 5 seconds minimum
      maxMs: 86400000,  // 1 day maximum
    },
  },
});
```

### Correlation Failures

Messages that can't be correlated to a saga are dropped by default. You can configure a handler to send them to a DLQ instead:

```typescript
const bus = createBus({
  // ...
  worker: {
    onCorrelationFailure: async (ctx) => {
      console.warn(`Could not correlate ${ctx.messageType} to ${ctx.sagaName}`);
      return "dlq"; // or "drop" (default)
    },
  },
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
