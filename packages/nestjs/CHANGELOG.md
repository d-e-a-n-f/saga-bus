# @saga-bus/nestjs

## 0.1.2

### Patch Changes

- [`c3e3bea`](https://github.com/d-e-a-n-f/saga-bus/commit/c3e3beabe23d22f00c373d1fb5dcb7b654d1ffb0) - Fix npm publish rate limiting by using sequential publish script. Republish packages that failed due to E429 rate limit error.

- Updated dependencies [[`c3e3bea`](https://github.com/d-e-a-n-f/saga-bus/commit/c3e3beabe23d22f00c373d1fb5dcb7b654d1ffb0)]:
  - @saga-bus/core@0.1.2

## 0.1.1

### Patch Changes

- Fix package metadata - correct repository URLs and normalize versions.

- Updated dependencies []:
  - @saga-bus/core@0.1.1

## 0.1.0

### Minor Changes

- Initial release of saga-bus - a MassTransit-style saga orchestration library for TypeScript/Node.js.

  ### Core Features
  - Type-safe saga DSL with fluent builder pattern
  - Message correlation and routing
  - Saga timeout support with configurable bounds
  - Retry policies with exponential backoff
  - Dead-letter queue handling
  - Middleware pipeline for cross-cutting concerns
  - Shared store support with per-saga overrides

  ### Transports
  - In-memory (testing)
  - RabbitMQ
  - Apache Kafka
  - AWS SQS
  - Azure Service Bus
  - Google Cloud Pub/Sub
  - Redis Streams
  - NATS JetStream

  ### Stores
  - In-memory (testing)
  - PostgreSQL
  - MySQL/MariaDB
  - SQL Server
  - MongoDB
  - AWS DynamoDB
  - Redis
  - Prisma ORM adapter

  ### Middleware
  - Structured logging
  - OpenTelemetry distributed tracing
  - Prometheus metrics
  - Zod schema validation
  - Message deduplication (idempotency)
  - Multi-tenant isolation

  ### Framework Integrations
  - NestJS module
  - Next.js helpers
  - Express middleware
  - Fastify plugin
  - Hono middleware (edge runtimes)

### Patch Changes

- Updated dependencies []:
  - @saga-bus/core@0.1.0
