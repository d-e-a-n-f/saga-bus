# @saga-bus/test

Testing utilities for saga-bus applications.

## Installation

```bash
pnpm add -D @saga-bus/test
```

## Usage

```typescript
import { TestHarness } from "@saga-bus/test";
import { orderSaga } from "./sagas/OrderSaga";

describe("OrderSaga", () => {
  let harness: TestHarness;

  beforeEach(async () => {
    harness = await TestHarness.create({
      sagas: [orderSaga],
    });
  });

  afterEach(async () => {
    await harness.stop();
  });

  it("should process order", async () => {
    // Publish a message
    await harness.publish({
      type: "OrderSubmitted",
      orderId: "123",
    });

    // Wait for processing
    await harness.waitForIdle();

    // Check saga state
    const state = await harness.getSagaState("OrderSaga", "123");
    expect(state.status).toBe("pending");

    // Check published messages
    const messages = harness.getPublishedMessages();
    expect(messages).toContainEqual(
      expect.objectContaining({ type: "PaymentRequested" })
    );
  });
});
```

## API

### `TestHarness.create(options)`

Create a test harness with given sagas.

### `harness.publish(message)`

Publish a message to the bus.

### `harness.waitForIdle()`

Wait for all messages to be processed.

### `harness.getSagaState(sagaName, correlationId)`

Get the current state of a saga instance.

### `harness.getPublishedMessages()`

Get all messages published by handlers.

### `harness.stop()`

Clean up resources.

## License

MIT
