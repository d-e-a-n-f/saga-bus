# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Core types and interfaces (`@saga-bus/core`)
- Fluent saga DSL with `createSagaMachine`
- Bus runtime with `createBus`
- Retry policy with exponential backoff and DLQ handling
- In-memory transport for testing (`@saga-bus/transport-inmemory`)
- RabbitMQ transport for production (`@saga-bus/transport-rabbitmq`)
- In-memory saga store for testing (`@saga-bus/store-inmemory`)
- PostgreSQL saga store with native driver (`@saga-bus/store-postgres`)
- Prisma saga store adapter (`@saga-bus/store-prisma`)
- Logging middleware (`@saga-bus/middleware-logging`)
- Test harness utilities (`@saga-bus/test`)
