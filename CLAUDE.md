# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

saga-bus is a MassTransit-style saga orchestration library for TypeScript/Node.js. It provides type-safe sagas with a fluent DSL, pluggable transports (RabbitMQ, Kafka, SQS, etc.), pluggable stores (PostgreSQL, MongoDB, DynamoDB, etc.), and framework integrations (NestJS, Next.js, Express, Fastify, Hono).

## Commands

```bash
pnpm install          # Install dependencies
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm check-types      # Type check all packages
pnpm lint             # Lint all packages
pnpm format           # Format with Prettier

# Single package operations
pnpm --filter @saga-bus/core build
pnpm --filter @saga-bus/core test
pnpm --filter @saga-bus/core test:watch
pnpm --filter @saga-bus/core dev        # Watch mode

# Run tests with coverage
pnpm --filter @saga-bus/core test -- --coverage

# Run a specific test file
pnpm --filter @saga-bus/core test src/__tests__/SagaBuilder.test.ts
```

## Architecture

### Package Structure

- **packages/core** - Core types, fluent DSL (`createSagaMachine`), and runtime (`createBus`). Contains three main modules:
  - `dsl/` - Saga builder DSL for defining sagas
  - `runtime/` - Bus implementation, orchestrator, error handling
  - `types/` - Shared interfaces (Transport, SagaStore, Middleware, etc.)

- **packages/transport-*** - Transport implementations (rabbitmq, kafka, sqs, redis, nats, azure-servicebus, gcp-pubsub, inmemory). Each implements the `Transport` interface.

- **packages/store-*** - Saga state persistence (postgres, mysql, sqlserver, mongo, dynamodb, redis, prisma, inmemory). Each implements the `SagaStore` interface.

- **packages/middleware-*** - Pipeline middleware (logging, tracing, metrics, validation, idempotency, tenant). Each returns `SagaMiddleware`.

- **packages/{nestjs,nextjs,express,fastify,hono}** - Framework integrations

- **packages/test** - Test harness (`TestHarness`) for saga testing

- **apps/** - Example applications (not published)

### Key Interfaces

All transports implement `Transport` from `@saga-bus/core`:
- `publish(message, options)` - Publish to topic
- `subscribe(topic, handler)` - Subscribe to messages
- `start()/stop()` - Lifecycle

All stores implement `SagaStore` from `@saga-bus/core`:
- `get(sagaName, correlationId)` - Load saga state
- `save(sagaName, correlationId, state, metadata)` - Persist with optimistic concurrency
- `delete(sagaName, correlationId)` - Remove completed saga

### Build System

- **pnpm workspaces** with **Turborepo** for task orchestration
- **tsup** for building packages (ESM + CJS dual output)
- **Vitest** for testing (workspace config in `vitest.workspace.ts`)
- **Changesets** for versioning (`pnpm changeset`)

### Conventions

- Tests go in `__tests__/` or `*.test.ts` files
- Public exports from `src/index.ts`
- Conventional commits: `feat(core):`, `fix(store-postgres):`, etc.
- Peer dependencies for external libs (e.g., `kafkajs`, `@aws-sdk/*`)
