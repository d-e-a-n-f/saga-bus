# @saga-bus/transport-inmemory

In-memory transport implementation for testing and development.

## Installation

```bash
pnpm add @saga-bus/transport-inmemory
```

## Usage

```typescript
import { InMemoryTransport } from "@saga-bus/transport-inmemory";
import { createBus } from "@saga-bus/core";

const transport = new InMemoryTransport({
  defaultConcurrency: 10,
});

const bus = createBus({
  transport,
  sagas: [...],
});
```

## Features

- Zero external dependencies
- Configurable concurrency via semaphore
- Delayed message support
- Perfect for unit tests

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultConcurrency` | `number` | `10` | Max concurrent handlers |

## License

MIT
