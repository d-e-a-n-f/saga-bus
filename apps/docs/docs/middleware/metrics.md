---
sidebar_position: 4
title: Metrics
---

# Metrics Middleware

Coming soon. See package README for details.

## Installation

```bash
npm install @saga-bus/middleware-metrics
```

## Basic Usage

```typescript
import { createMetricsMiddleware } from '@saga-bus/middleware-metrics';

const bus = createBus({
  middleware: [
    createMetricsMiddleware({
      prefix: 'saga_bus',
    }),
  ],
});
```
