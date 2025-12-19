---
sidebar_position: 3
title: Unit Testing
---

# Unit Testing

Coming soon.

## Testing Individual Handlers

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('PaymentCaptured handler', () => {
  it('updates status to paid', async () => {
    const state = { orderId: '123', status: 'pending' };
    const msg = { type: 'PaymentCaptured', transactionId: 'txn-1' };
    const ctx = { publish: vi.fn(), complete: vi.fn() };

    // Test handler logic directly
  });
});
```
