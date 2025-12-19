---
sidebar_position: 3
title: Tracing
---

# Tracing Middleware

Coming soon. See package README for details.

## Installation

```bash
npm install @saga-bus/middleware-tracing
```

## Basic Usage

```typescript
import { createTracingMiddleware } from '@saga-bus/middleware-tracing';

const bus = createBus({
  middleware: [
    createTracingMiddleware({
      serviceName: 'my-service',
    }),
  ],
});
```
