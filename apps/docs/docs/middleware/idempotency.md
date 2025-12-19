---
sidebar_position: 6
title: Idempotency
---

# Idempotency Middleware

Coming soon. See package README for details.

## Installation

```bash
npm install @saga-bus/middleware-idempotency
```

## Basic Usage

```typescript
import { createIdempotencyMiddleware, InMemoryIdempotencyStore } from '@saga-bus/middleware-idempotency';

const bus = createBus({
  middleware: [
    createIdempotencyMiddleware({
      store: new InMemoryIdempotencyStore(),
    }),
  ],
});
```
