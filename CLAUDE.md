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

# Release (bumps versions, tags, pushes - triggers CI publish)
pnpm release patch    # 0.1.3 → 0.1.4
pnpm release minor    # 0.1.3 → 0.2.0
pnpm release major    # 0.1.3 → 1.0.0
```

## Architecture

### Package Structure

- **packages/core** - Core types, fluent DSL (`createSagaMachine`), and runtime (`createBus`). Contains:
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

### Release Process

1. Run `pnpm release [patch|minor|major]` locally
2. Script bumps all package versions, commits, creates git tag, pushes
3. GitHub Actions triggers on `v*` tag
4. CI builds, tests, publishes to npm sequentially, creates GitHub Release

### Conventions

- Tests go in `__tests__/` or `*.test.ts` files
- Public exports from `src/index.ts`
- Conventional commits: `feat(core):`, `fix(store-postgres):`, etc.
- Peer dependencies for external libs (e.g., `kafkajs`, `@aws-sdk/*`)
