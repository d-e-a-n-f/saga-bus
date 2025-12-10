# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### Core
- Core types and interfaces (`@saga-bus/core`)
- Fluent saga DSL with `createSagaMachine`
- Bus runtime with `createBus`
- Retry policy with exponential backoff and DLQ handling
- Saga timeout support (`setTimeout`, `clearTimeout`, `getTimeoutRemaining`)
- `SagaTimeoutExpired` message type for automatic timeout handling
- Shared store support with per-saga override capability
- Test harness utilities (`@saga-bus/test`)

#### Transports
- In-memory transport for testing (`@saga-bus/transport-inmemory`)
- RabbitMQ transport with topic exchanges (`@saga-bus/transport-rabbitmq`)
- Apache Kafka transport with consumer groups (`@saga-bus/transport-kafka`)
- AWS SQS FIFO queue transport (`@saga-bus/transport-sqs`)
- Azure Service Bus transport with sessions (`@saga-bus/transport-azure-servicebus`)
- Google Cloud Pub/Sub transport (`@saga-bus/transport-gcp-pubsub`)
- Redis Streams transport with consumer groups (`@saga-bus/transport-redis`)
- NATS JetStream transport (`@saga-bus/transport-nats`)

#### Stores
- In-memory saga store for testing (`@saga-bus/store-inmemory`)
- PostgreSQL saga store (`@saga-bus/store-postgres`)
- MySQL/MariaDB saga store (`@saga-bus/store-mysql`)
- SQL Server/Azure SQL saga store (`@saga-bus/store-sqlserver`)
- MongoDB saga store (`@saga-bus/store-mongo`)
- AWS DynamoDB saga store (`@saga-bus/store-dynamodb`)
- Redis saga store with TTL support (`@saga-bus/store-redis`)
- Prisma ORM adapter (`@saga-bus/store-prisma`)

#### Middleware
- Structured logging middleware (`@saga-bus/middleware-logging`)
- OpenTelemetry distributed tracing (`@saga-bus/middleware-tracing`)
- Prometheus metrics middleware (`@saga-bus/middleware-metrics`)
- Zod schema validation middleware (`@saga-bus/middleware-validation`)
- Message deduplication middleware (`@saga-bus/middleware-idempotency`)
- Multi-tenant isolation middleware (`@saga-bus/middleware-tenant`)

#### Framework Integrations
- NestJS module with dependency injection (`@saga-bus/nestjs`)
- Next.js App Router helpers (`@saga-bus/nextjs`)
- Express middleware and routers (`@saga-bus/express`)
- Fastify plugin (`@saga-bus/fastify`)
- Hono middleware for edge runtimes (`@saga-bus/hono`)

#### Examples
- Background worker with health/metrics (`example-worker`)
- Next.js order form UI (`example-nextjs`)
- NestJS API with Swagger (`example-nestjs`)
- Complex loan application saga with Next.js UI (`example-loan-nextjs`)
- Redis transport and store demo (`example-redis`)
- Database store demos (`example-stores`)
- Full middleware stack demo (`example-middleware`)
