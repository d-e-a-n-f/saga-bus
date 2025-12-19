---
sidebar_position: 5
title: Validation
---

# Validation Middleware

Coming soon. See package README for details.

## Installation

```bash
npm install @saga-bus/middleware-validation zod
```

## Basic Usage

```typescript
import { createValidationMiddleware, createZodValidator } from '@saga-bus/middleware-validation';
import { z } from 'zod';

const bus = createBus({
  middleware: [
    createValidationMiddleware({
      validator: createZodValidator(),
    }),
  ],
});
```
