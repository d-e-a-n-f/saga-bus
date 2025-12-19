---
sidebar_position: 1
---

# Examples Overview

Working examples to learn from.

## Example Applications

| Example | Description | Stack |
|---------|-------------|-------|
| [Order Saga](/docs/examples/order-saga) | E-commerce order processing | RabbitMQ, PostgreSQL |
| [Loan Application](/docs/examples/loan-application) | Complex 30+ state workflow | RabbitMQ, PostgreSQL |
| Worker | Background saga processor | Fastify, OpenTelemetry |
| Next.js | Message producer UI | Next.js App Router |
| NestJS | Full REST API | NestJS, Swagger |

## Running Examples

```bash
# Clone the repo
git clone https://github.com/d-e-a-n-f/saga-bus.git
cd saga-bus

# Install dependencies
pnpm install

# Start infrastructure
docker compose up -d

# Run the worker
pnpm --filter example-worker dev

# In another terminal, run the API
pnpm --filter example-nextjs dev
```

## Order Saga Example

A simple e-commerce flow:

```
OrderSubmitted → PaymentCaptured → InventoryReserved → ShipmentCreated → Completed
       ↓               ↓                  ↓
  PaymentFailed  PaymentFailed    ReservationFailed
       ↓               ↓                  ↓
   Cancelled       Cancelled         Refund + Cancel
```

See [Order Saga](/docs/examples/order-saga) for details.

## Loan Application Example

A complex workflow with:
- 30+ states
- Parallel verification steps
- Conditional flows (mortgage vs personal loan)
- Timeout handling
- Document collection

See [Loan Application](/docs/examples/loan-application) for details.

## Common Patterns

See [Patterns](/docs/examples/patterns) for:
- Compensation patterns
- Parallel steps
- Timeout handling
- State machines
