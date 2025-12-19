---
sidebar_position: 4
title: Integration Testing
---

# Integration Testing

Coming soon.

## Full Flow Testing

```typescript
import { TestHarness } from '@saga-bus/test';

describe('Order flow', () => {
  let harness: TestHarness;

  beforeEach(async () => {
    harness = new TestHarness();
    await harness.start({ sagas: [{ definition: orderSaga }] });
  });

  afterEach(async () => {
    await harness.stop();
  });

  it('completes order flow', async () => {
    // Publish messages and verify state transitions
  });
});
```
