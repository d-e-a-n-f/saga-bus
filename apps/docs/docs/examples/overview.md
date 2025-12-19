---
sidebar_position: 1
---

# Examples Overview

Working examples to learn saga patterns and best practices.

## Example Applications

| Example | Description | Stack |
|---------|-------------|-------|
| [Order Saga](/docs/examples/order-saga) | E-commerce order processing | RabbitMQ, PostgreSQL |
| [Loan Application](/docs/examples/loan-application) | Complex 30+ state workflow | RabbitMQ, PostgreSQL |
| [Common Patterns](/docs/examples/patterns) | Reusable saga patterns | Various |

## Running Examples

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker and Docker Compose

### Quick Start

```bash
# Clone the repo
git clone https://github.com/d-e-a-n-f/saga-bus.git
cd saga-bus

# Install dependencies
pnpm install

# Start infrastructure (RabbitMQ, PostgreSQL)
docker compose up -d

# Run database migrations
pnpm --filter @saga-bus/store-postgres db:migrate

# Run the worker
pnpm --filter example-worker dev

# In another terminal, run the API
pnpm --filter example-nextjs dev
```

### Access Points

| Service | URL |
|---------|-----|
| Next.js App | http://localhost:3000 |
| Worker Health | http://localhost:3001/health |
| RabbitMQ Management | http://localhost:15672 (guest/guest) |
| PostgreSQL | localhost:5432 |

## Example Architecture

export const archNodes = [
  { id: 'nextjs', type: 'serviceNode', position: { x: 50, y: 50 }, data: { label: 'Next.js App', type: 'service' } },
  { id: 'worker', type: 'serviceNode', position: { x: 300, y: 50 }, data: { label: 'Saga Worker', type: 'service' } },
  { id: 'rabbit', type: 'serviceNode', position: { x: 175, y: 150 }, data: { label: 'RabbitMQ', type: 'queue' } },
  { id: 'postgres', type: 'serviceNode', position: { x: 175, y: 250 }, data: { label: 'PostgreSQL', type: 'database' } },
];

export const archEdges = [
  { id: 'a1', source: 'nextjs', target: 'rabbit', animated: true },
  { id: 'a2', source: 'worker', target: 'rabbit', animated: true },
  { id: 'a3', source: 'rabbit', target: 'postgres' },
];

<FlowDiagram nodes={archNodes} edges={archEdges} height={350} />

## Order Saga Flow

A simple e-commerce workflow demonstrating basic saga concepts:

export const orderFlowNodes = [
  { id: 'submit', type: 'stateNode', position: { x: 0, y: 50 }, data: { label: 'OrderSubmitted', status: 'initial' } },
  { id: 'payment', type: 'stateNode', position: { x: 150, y: 50 }, data: { label: 'PaymentCaptured', status: 'active' } },
  { id: 'inventory', type: 'stateNode', position: { x: 300, y: 50 }, data: { label: 'InventoryReserved', status: 'active' } },
  { id: 'ship', type: 'stateNode', position: { x: 450, y: 50 }, data: { label: 'ShipmentCreated', status: 'active' } },
  { id: 'complete', type: 'stateNode', position: { x: 600, y: 50 }, data: { label: 'Completed', status: 'success' } },
  { id: 'fail1', type: 'stateNode', position: { x: 0, y: 130 }, data: { label: 'Cancelled', status: 'error' } },
  { id: 'fail2', type: 'stateNode', position: { x: 150, y: 130 }, data: { label: 'Cancelled', status: 'error' } },
  { id: 'fail3', type: 'stateNode', position: { x: 300, y: 130 }, data: { label: 'Refund + Cancel', status: 'error' } },
];

export const orderFlowEdges = [
  { id: 'of1', source: 'submit', target: 'payment', data: { type: 'success' } },
  { id: 'of2', source: 'payment', target: 'inventory', data: { type: 'success' } },
  { id: 'of3', source: 'inventory', target: 'ship', data: { type: 'success' } },
  { id: 'of4', source: 'ship', target: 'complete', data: { type: 'success' } },
  { id: 'of5', source: 'submit', target: 'fail1', label: 'PaymentFailed', data: { type: 'error' } },
  { id: 'of6', source: 'payment', target: 'fail2', label: 'PaymentFailed', data: { type: 'error' } },
  { id: 'of7', source: 'inventory', target: 'fail3', label: 'ReservationFailed', data: { type: 'error' } },
];

<FlowDiagram nodes={orderFlowNodes} edges={orderFlowEdges} height={220} />

**Key Concepts:**
- Sequential state transitions
- Compensation on failure
- Message correlation

See [Order Saga](/docs/examples/order-saga) for the full implementation.

## Loan Application Flow

A complex financial workflow with advanced patterns:

export const loanFlowNodes = [
  { id: 'lapp', type: 'stateNode', position: { x: 0, y: 50 }, data: { label: 'Application', status: 'initial' } },
  { id: 'lid', type: 'stateNode', position: { x: 130, y: 50 }, data: { label: 'Identity', status: 'active' } },
  { id: 'lcredit', type: 'stateNode', position: { x: 240, y: 50 }, data: { label: 'Credit', status: 'active' } },
  { id: 'lincome', type: 'stateNode', position: { x: 340, y: 50 }, data: { label: 'Income', status: 'active' } },
  { id: 'ldecision', type: 'decisionNode', position: { x: 450, y: 50 }, data: { label: 'Decision', condition: 'DTI check' } },
  { id: 'lfund', type: 'stateNode', position: { x: 580, y: 50 }, data: { label: 'Funding', status: 'active' } },
  { id: 'lcomplete', type: 'stateNode', position: { x: 700, y: 50 }, data: { label: 'Complete', status: 'success' } },
  { id: 'lreject', type: 'stateNode', position: { x: 450, y: 150 }, data: { label: 'Rejected', status: 'error' } },
];

export const loanFlowEdges = [
  { id: 'lf1', source: 'lapp', target: 'lid', animated: true },
  { id: 'lf2', source: 'lid', target: 'lcredit' },
  { id: 'lf3', source: 'lcredit', target: 'lincome' },
  { id: 'lf4', source: 'lincome', target: 'ldecision' },
  { id: 'lf5', source: 'ldecision', target: 'lfund', data: { type: 'success' } },
  { id: 'lf6', source: 'lfund', target: 'lcomplete', data: { type: 'success' } },
  { id: 'lf7', source: 'lapp', target: 'lreject', data: { type: 'error' } },
  { id: 'lf8', source: 'ldecision', target: 'lreject', label: 'Fail', data: { type: 'error' } },
];

<FlowDiagram nodes={loanFlowNodes} edges={loanFlowEdges} height={250} />

**Key Concepts:**
- 30+ state transitions
- Parallel verification steps
- Conditional branching
- Timeout handling
- Document collection

See [Loan Application](/docs/examples/loan-application) for the full implementation.

## Common Patterns

Reusable patterns applicable across many domains:

- **Compensation** - Rolling back distributed transactions
- **Parallel Steps** - Executing multiple operations concurrently
- **Timeout Handling** - Dealing with missing or delayed events
- **State Machines** - Modeling complex state transitions
- **Idempotency** - Safe message reprocessing

See [Common Patterns](/docs/examples/patterns) for implementations.

## Project Structure

```
saga-bus/
├── packages/
│   ├── core/              # Saga engine
│   ├── transport-rabbitmq/ # RabbitMQ transport
│   └── store-postgres/     # PostgreSQL store
├── apps/
│   ├── example-worker/     # Saga processor
│   ├── example-nextjs/     # API and UI
│   └── example-nestjs/     # NestJS API
└── docker-compose.yml      # Infrastructure
```

## Environment Variables

```bash
# .env.local
DATABASE_URL=postgres://postgres:password@localhost:5432/sagabus
RABBITMQ_URL=amqp://guest:guest@localhost:5672
LOG_LEVEL=debug
```

## Troubleshooting

### RabbitMQ Connection Failed

```bash
# Check if RabbitMQ is running
docker compose ps

# View logs
docker compose logs rabbitmq

# Restart
docker compose restart rabbitmq
```

### Database Connection Error

```bash
# Check if PostgreSQL is running
docker compose ps

# Run migrations
pnpm --filter @saga-bus/store-postgres db:migrate

# Reset database
pnpm --filter @saga-bus/store-postgres db:reset
```

### Worker Not Processing Messages

1. Check worker logs for errors
2. Verify RabbitMQ connection
3. Check queue bindings in RabbitMQ Management UI
4. Ensure sagas are registered correctly

## Next Steps

1. **[Order Saga](/docs/examples/order-saga)** - Start with the simple example
2. **[Loan Application](/docs/examples/loan-application)** - Explore advanced patterns
3. **[Common Patterns](/docs/examples/patterns)** - Learn reusable techniques
