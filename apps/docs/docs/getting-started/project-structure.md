---
sidebar_position: 4
---

# Project Structure

Recommended patterns for organizing Saga Bus projects.

## Monorepo Structure

For larger applications, we recommend a monorepo structure:

```
my-app/
├── packages/
│   ├── messages/           # Shared message definitions
│   │   ├── src/
│   │   │   ├── orders.ts
│   │   │   ├── payments.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── sagas/              # Saga definitions
│   │   ├── src/
│   │   │   ├── order-saga.ts
│   │   │   ├── payment-saga.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── shared/             # Shared utilities
│       ├── src/
│       │   ├── bus-config.ts
│       │   └── index.ts
│       └── package.json
│
├── apps/
│   ├── worker/             # Saga processor service
│   │   ├── src/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── api/                # REST API (publishes messages)
│   │   ├── src/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── web/                # Frontend (if applicable)
│       └── ...
│
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## Single App Structure

For smaller projects:

```
my-saga-app/
├── src/
│   ├── messages/
│   │   ├── orders.ts
│   │   ├── payments.ts
│   │   └── index.ts
│   │
│   ├── sagas/
│   │   ├── order-saga/
│   │   │   ├── state.ts
│   │   │   ├── handlers.ts
│   │   │   └── index.ts
│   │   └── index.ts
│   │
│   ├── config/
│   │   ├── transport.ts
│   │   ├── store.ts
│   │   └── bus.ts
│   │
│   └── index.ts
│
├── package.json
└── tsconfig.json
```

## Message Organization

### By Domain

```typescript
// messages/orders.ts
export interface OrderSubmitted {
  type: 'OrderSubmitted';
  orderId: string;
  // ...
}

// messages/payments.ts
export interface PaymentCaptured {
  type: 'PaymentCaptured';
  orderId: string;
  // ...
}

// messages/index.ts
export * from './orders';
export * from './payments';

export type AllMessages =
  | OrderMessages
  | PaymentMessages;
```

### Message Naming Conventions

- **Commands**: Imperative verbs (`SubmitOrder`, `CapturePayment`)
- **Events**: Past tense (`OrderSubmitted`, `PaymentCaptured`)
- **Queries**: Questions (`GetOrderStatus`)

## Saga Organization

### One File Per Saga

For simple sagas:

```typescript
// sagas/order-saga.ts
import { createSagaMachine } from '@saga-bus/core';
import type { OrderState, OrderMessages } from '../messages';

export const orderSaga = createSagaMachine<OrderState, OrderMessages>()
  .name('OrderSaga')
  // ... full definition
  .build();
```

### Folder Per Saga

For complex sagas:

```
sagas/
└── order-saga/
    ├── state.ts         # State interface
    ├── messages.ts      # Message types (if saga-specific)
    ├── handlers/
    │   ├── payment.ts   # Payment-related handlers
    │   ├── inventory.ts # Inventory-related handlers
    │   └── shipping.ts  # Shipping-related handlers
    ├── saga.ts          # Main saga definition
    └── index.ts         # Public exports
```

## Bus Configuration

### Centralized Config

```typescript
// config/bus.ts
import { createBus, BusConfig } from '@saga-bus/core';
import { createTransport } from './transport';
import { createStore } from './store';
import { orderSaga, paymentSaga } from '../sagas';
import { createMiddleware } from './middleware';

export function createAppBus() {
  const config: BusConfig = {
    transport: createTransport(),
    store: createStore(),
    sagas: [
      { definition: orderSaga },
      { definition: paymentSaga },
    ],
    middleware: createMiddleware(),
  };

  return createBus(config);
}
```

### Environment-Based Config

```typescript
// config/transport.ts
import { RabbitMqTransport } from '@saga-bus/transport-rabbitmq';
import { InMemoryTransport } from '@saga-bus/transport-inmemory';

export function createTransport() {
  if (process.env.NODE_ENV === 'test') {
    return new InMemoryTransport();
  }

  return new RabbitMqTransport({
    url: process.env.RABBITMQ_URL!,
    exchange: 'saga-bus',
  });
}
```

## Testing Structure

```
tests/
├── unit/
│   └── sagas/
│       └── order-saga.test.ts
├── integration/
│   └── order-flow.test.ts
└── fixtures/
    └── messages.ts
```

## Docker Setup

```yaml
# docker-compose.yml
services:
  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "5672:5672"
      - "15672:15672"

  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: sagas
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"

  worker:
    build: ./apps/worker
    depends_on:
      - rabbitmq
      - postgres
    environment:
      RABBITMQ_URL: amqp://rabbitmq
      DATABASE_URL: postgres://postgres:postgres@postgres/sagas
```

## Next Steps

- [Core Concepts](/docs/core-concepts/overview) - Understand saga mechanics
- [Transports](/docs/transports/overview) - Choose a message broker
- [Stores](/docs/stores/overview) - Choose a database
