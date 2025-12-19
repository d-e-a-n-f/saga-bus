---
sidebar_position: 1
slug: /
---

# Welcome to Saga Bus

**Saga Bus** is a MassTransit-style saga orchestration library for TypeScript and Node.js. Build resilient, distributed workflows with ease.

## Why Saga Bus?

Modern applications often need to coordinate complex, multi-step processes across multiple services. Saga Bus provides:

- **Type-Safe DSL** - Fluent builder API with full TypeScript inference
- **Multiple Transports** - RabbitMQ, Kafka, SQS, Azure Service Bus, GCP Pub/Sub, Redis, NATS
- **Multiple Stores** - PostgreSQL, MySQL, SQL Server, MongoDB, DynamoDB, Redis, SQLite, Prisma
- **Production-Ready Middleware** - Logging, tracing, metrics, validation, idempotency, multi-tenancy
- **Framework Integrations** - NestJS, Next.js, Express, Fastify, Hono

## Quick Example

```typescript
import { createSagaMachine, createBus } from '@saga-bus/core';
import { RabbitMqTransport } from '@saga-bus/transport-rabbitmq';
import { PostgresSagaStore } from '@saga-bus/store-postgres';

// Define your saga with a fluent DSL
const orderSaga = createSagaMachine<OrderState, OrderMessages>()
  .name('OrderSaga')
  .correlate('OrderSubmitted', msg => msg.orderId, { canStart: true })
  .correlate('*', msg => msg.orderId)
  .initial<OrderSubmitted>(msg => ({
    orderId: msg.orderId,
    status: 'pending',
    items: msg.items,
  }))
  .on('PaymentCaptured')
    .handle(async (msg, state, ctx) => {
      await ctx.publish({ type: 'ReserveInventory', orderId: state.orderId });
      return { ...state, status: 'payment_captured' };
    })
  .on('InventoryReserved')
    .handle(async (msg, state, ctx) => {
      await ctx.publish({ type: 'CreateShipment', orderId: state.orderId });
      return { ...state, status: 'inventory_reserved' };
    })
  .on('ShipmentCreated')
    .handle(async (msg, state, ctx) => {
      ctx.complete();
      return { ...state, status: 'shipped' };
    })
  .build();

// Create and start the bus
const bus = createBus({
  transport: new RabbitMqTransport({ url: 'amqp://localhost' }),
  store: new PostgresSagaStore({ connectionString: process.env.DATABASE_URL }),
  sagas: [{ definition: orderSaga }],
});

await bus.start();
```

## Features at a Glance

| Feature | Description |
|---------|-------------|
| **Correlation** | Link messages to saga instances via correlation IDs |
| **State Guards** | Conditional message handling with `.when()` |
| **Timeouts** | Built-in timeout tracking with automatic expiry messages |
| **Optimistic Concurrency** | Version-based conflict detection prevents lost updates |
| **Distributed Tracing** | W3C trace context propagation out of the box |
| **Compensation** | Handle failures gracefully with compensating actions |

## Getting Started

Ready to build your first saga? Follow our step-by-step guide:

1. [Installation](/docs/getting-started/installation) - Add Saga Bus to your project
2. [Quick Start](/docs/getting-started/quick-start) - Get running in 5 minutes
3. [Your First Saga](/docs/getting-started/your-first-saga) - Build a complete workflow

## Packages

Saga Bus is organized as a monorepo with focused packages:

### Core
- [`@saga-bus/core`](https://npmjs.com/package/@saga-bus/core) - Core types, DSL, and bus runtime

### Transports
Choose the message broker that fits your infrastructure:

| Package | Broker |
|---------|--------|
| `@saga-bus/transport-rabbitmq` | RabbitMQ |
| `@saga-bus/transport-kafka` | Apache Kafka |
| `@saga-bus/transport-sqs` | AWS SQS |
| `@saga-bus/transport-azure-servicebus` | Azure Service Bus |
| `@saga-bus/transport-gcp-pubsub` | Google Cloud Pub/Sub |
| `@saga-bus/transport-redis` | Redis Streams |
| `@saga-bus/transport-nats` | NATS JetStream |
| `@saga-bus/transport-inmemory` | In-Memory (testing) |

### Stores
Persist saga state in your preferred database:

| Package | Database |
|---------|----------|
| `@saga-bus/store-postgres` | PostgreSQL |
| `@saga-bus/store-mysql` | MySQL / MariaDB |
| `@saga-bus/store-sqlserver` | SQL Server |
| `@saga-bus/store-mongodb` | MongoDB |
| `@saga-bus/store-dynamodb` | AWS DynamoDB |
| `@saga-bus/store-redis` | Redis |
| `@saga-bus/store-sqlite` | SQLite |
| `@saga-bus/store-prisma` | Prisma ORM |
| `@saga-bus/store-inmemory` | In-Memory (testing) |

### Middleware
Add cross-cutting concerns:

| Package | Purpose |
|---------|---------|
| `@saga-bus/middleware-logging` | Structured logging |
| `@saga-bus/middleware-tracing` | OpenTelemetry tracing |
| `@saga-bus/middleware-metrics` | Prometheus metrics |
| `@saga-bus/middleware-validation` | Zod schema validation |
| `@saga-bus/middleware-idempotency` | Message deduplication |
| `@saga-bus/middleware-tenant` | Multi-tenant isolation |

### Framework Integrations
First-class support for popular frameworks:

| Package | Framework |
|---------|-----------|
| `@saga-bus/nestjs` | NestJS |
| `@saga-bus/nextjs` | Next.js |
| `@saga-bus/express` | Express |
| `@saga-bus/fastify` | Fastify |
| `@saga-bus/hono` | Hono |

## Need Help?

- **[GitHub Issues](https://github.com/d-e-a-n-f/saga-bus/issues)** - Report bugs or request features
- **[Examples](https://github.com/d-e-a-n-f/saga-bus/tree/main/apps)** - Working example applications
