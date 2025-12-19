---
sidebar_position: 5
title: Mocking
---

# Mocking

Coming soon.

## Mocking External Services

```typescript
import { vi } from 'vitest';

const mockPaymentService = {
  capture: vi.fn().mockResolvedValue({ transactionId: 'txn-123' }),
  refund: vi.fn().mockResolvedValue(true),
};
```
