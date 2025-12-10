# @saga-bus/store-inmemory

In-memory saga store for testing and development.

## Installation

```bash
pnpm add @saga-bus/store-inmemory
```

## Usage

```typescript
import { InMemorySagaStore } from "@saga-bus/store-inmemory";
import { createBus } from "@saga-bus/core";

const store = new InMemorySagaStore();

const bus = createBus({
  sagas: [{ definition: mySaga, store }],
  transport,
});
```

## Features

- Optimistic concurrency control
- Correlation ID indexing
- State versioning
- Zero configuration
- Instant operations

## When to Use

**Use for:**
- Unit and integration tests
- Local development
- Prototyping

**Do not use for:**
- Production deployments
- Multi-instance applications
- Data that needs to survive restarts

## Limitations

- **No persistence**: All data is lost when the process exits
- **Single process only**: State is not shared between Node.js processes
- **Memory bound**: Large numbers of sagas may consume significant memory

For production, use a persistent store like [@saga-bus/store-postgres](../store-postgres), [@saga-bus/store-mongo](../store-mongo), or [@saga-bus/store-dynamodb](../store-dynamodb).

## Sharing Across Sagas

A single store instance can be shared across multiple sagas within the same process:

```typescript
const store = new InMemorySagaStore();

const bus = createBus({
  transport,
  store, // shared by all sagas
  sagas: [
    { definition: orderSaga },
    { definition: paymentSaga },
  ],
});
```

Data is isolated by `sagaName`, so different saga types won't conflict.

## License

MIT
