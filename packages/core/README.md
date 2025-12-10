# @saga-bus/core

Core types, interfaces, and runtime for the saga-bus message orchestration library.

## Installation

```bash
pnpm add @saga-bus/core
```

## Quick Start

```typescript
import { createSagaMachine, createBus } from "@saga-bus/core";
import { InMemoryTransport } from "@saga-bus/transport-inmemory";
import { InMemorySagaStore } from "@saga-bus/store-inmemory";

// Define your saga
const orderSaga = createSagaMachine<OrderState, OrderMessages>()
  .name("OrderSaga")
  .correlate("OrderSubmitted", (msg) => msg.orderId, { canStart: true })
  .correlate("PaymentCaptured", (msg) => msg.orderId)
  .initial<OrderSubmitted>((msg) => ({
    orderId: msg.orderId,
    status: "pending",
  }))
  .on("PaymentCaptured")
    .handle(async (msg, ctx) => {
      ctx.updateState({ ...ctx.state, status: "paid" });
      ctx.complete();
    })
  .build();

// Create and start the bus
const bus = createBus({
  transport: new InMemoryTransport(),
  sagas: [{ definition: orderSaga, store: new InMemorySagaStore() }],
});

await bus.start();
await bus.publish({ type: "OrderSubmitted", orderId: "123" });
```

## Exports

### Types

- `BaseMessage` - Base interface for all messages
- `MessageEnvelope` - Wrapper with metadata
- `Transport` - Transport abstraction
- `SagaStore` - State persistence abstraction
- `SagaDefinition` - Saga definition interface
- `Bus` - Main bus interface

### Functions

- `createSagaMachine<TState, TMessages>()` - Fluent saga builder
- `createBus(config)` - Create bus instance

### Errors

- `ConcurrencyError` - Optimistic locking conflict
- `TransientError` - Retriable error

## License

MIT
