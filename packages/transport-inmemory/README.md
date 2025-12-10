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
- Synchronous message delivery (great for tests)
- No network overhead

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultConcurrency` | `number` | `10` | Max concurrent handlers |

## When to Use

**Use for:**
- Unit and integration tests
- Local development
- Prototyping and demos

**Do not use for:**
- Production deployments
- Distributed systems
- Multi-process applications

## Testing Tips

The in-memory transport processes messages synchronously within the same process, making it ideal for testing:

```typescript
import { TestHarness } from "@saga-bus/test";
import { InMemoryTransport } from "@saga-bus/transport-inmemory";

// TestHarness uses InMemoryTransport internally
const harness = await TestHarness.create({
  sagas: [{ definition: mySaga, store }],
});

// Messages are processed immediately
await harness.publish({ type: "OrderSubmitted", orderId: "123" });
await harness.waitForIdle();

// State is immediately available
const state = await harness.getSagaState("OrderSaga", "123");
```

## Limitations

- **Single process only**: Messages are not shared between processes
- **No persistence**: Messages are lost if not consumed
- **No ordering guarantees**: Unlike production transports with FIFO support

For production, use [@saga-bus/transport-rabbitmq](../transport-rabbitmq), [@saga-bus/transport-sqs](../transport-sqs), or [@saga-bus/transport-kafka](../transport-kafka).

## License

MIT
