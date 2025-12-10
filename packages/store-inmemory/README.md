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
- Zero persistence (memory only)

## License

MIT
