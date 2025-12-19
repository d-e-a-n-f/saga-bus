---
sidebar_position: 1
---

# Installation

Get Saga Bus installed in your project with your preferred package manager.

## Prerequisites

- **Node.js** 20 or higher
- **TypeScript** 5.0 or higher (recommended)
- A message broker (RabbitMQ, Kafka, etc.) for production
- A database (PostgreSQL, MongoDB, etc.) for saga state persistence

## Install Core Package

The core package provides the saga DSL, bus runtime, and TypeScript types:

```bash npm2yarn
npm install @saga-bus/core
```

## Install Transport

Choose a transport based on your message broker:

### RabbitMQ (Recommended for getting started)

```bash npm2yarn
npm install @saga-bus/transport-rabbitmq
```

### Other Transports

```bash npm2yarn
# Apache Kafka
npm install @saga-bus/transport-kafka

# AWS SQS
npm install @saga-bus/transport-sqs

# Azure Service Bus
npm install @saga-bus/transport-azure-servicebus

# Google Cloud Pub/Sub
npm install @saga-bus/transport-gcp-pubsub

# Redis Streams
npm install @saga-bus/transport-redis

# NATS JetStream
npm install @saga-bus/transport-nats

# In-Memory (testing only)
npm install @saga-bus/transport-inmemory
```

## Install Store

Choose a store based on your database:

### PostgreSQL (Recommended for production)

```bash npm2yarn
npm install @saga-bus/store-postgres pg
```

### Other Stores

```bash npm2yarn
# MySQL / MariaDB
npm install @saga-bus/store-mysql mysql2

# SQL Server
npm install @saga-bus/store-sqlserver mssql

# MongoDB
npm install @saga-bus/store-mongodb mongodb

# AWS DynamoDB
npm install @saga-bus/store-dynamodb @aws-sdk/client-dynamodb

# Redis
npm install @saga-bus/store-redis ioredis

# SQLite (local development)
npm install @saga-bus/store-sqlite better-sqlite3

# Prisma ORM
npm install @saga-bus/store-prisma

# In-Memory (testing only)
npm install @saga-bus/store-inmemory
```

## Optional: Middleware

Add cross-cutting concerns as needed:

```bash npm2yarn
# Structured logging
npm install @saga-bus/middleware-logging

# OpenTelemetry tracing
npm install @saga-bus/middleware-tracing

# Prometheus metrics
npm install @saga-bus/middleware-metrics

# Zod schema validation
npm install @saga-bus/middleware-validation zod

# Message deduplication
npm install @saga-bus/middleware-idempotency

# Multi-tenant support
npm install @saga-bus/middleware-tenant
```

## Optional: Framework Integration

For framework-specific features:

```bash npm2yarn
# NestJS
npm install @saga-bus/nestjs

# Next.js
npm install @saga-bus/nextjs

# Express
npm install @saga-bus/express

# Fastify
npm install @saga-bus/fastify

# Hono
npm install @saga-bus/hono
```

## Minimal Installation

For the quickest start with local development and testing:

```bash npm2yarn
npm install @saga-bus/core @saga-bus/transport-inmemory @saga-bus/store-inmemory
```

## Production Installation

A typical production setup with RabbitMQ and PostgreSQL:

```bash npm2yarn
npm install @saga-bus/core \
  @saga-bus/transport-rabbitmq \
  @saga-bus/store-postgres pg \
  @saga-bus/middleware-logging \
  @saga-bus/middleware-tracing \
  @saga-bus/middleware-metrics
```

## TypeScript Configuration

Saga Bus is written in TypeScript and ships with full type definitions. Ensure your `tsconfig.json` has:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true
  }
}
```

## Next Steps

Now that you have Saga Bus installed, continue to the [Quick Start](/docs/getting-started/quick-start) guide to create your first saga.
