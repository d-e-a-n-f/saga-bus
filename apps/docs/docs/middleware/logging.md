---
sidebar_position: 2
title: Logging
---

# Logging Middleware

Coming soon. See package README for details.

## Installation

```bash
npm install @saga-bus/middleware-logging
```

## Basic Usage

```typescript
import { createLoggingMiddleware } from '@saga-bus/middleware-logging';

const bus = createBus({
  middleware: [
    createLoggingMiddleware({
      level: 'info',
    }),
  ],
});
```
