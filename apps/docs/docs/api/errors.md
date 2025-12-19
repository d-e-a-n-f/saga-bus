---
sidebar_position: 3
---

# Errors Reference

Error types exported by Saga Bus.

## ConcurrencyError

Thrown when optimistic concurrency fails:

```typescript
import { ConcurrencyError } from '@saga-bus/core';

// Thrown by stores when version mismatch
// Automatically retried by Saga Bus
```

## TransientError

Mark errors as retriable:

```typescript
import { TransientError } from '@saga-bus/core';

throw new TransientError('Service temporarily unavailable');
```

## ValidationError

Mark errors as permanent (no retry):

```typescript
import { ValidationError } from '@saga-bus/core';

throw new ValidationError('Invalid order total');
```

## SagaProcessingError

Wrapper for handler errors:

```typescript
import { SagaProcessingError } from '@saga-bus/core';
```
