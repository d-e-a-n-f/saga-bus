---
sidebar_position: 7
title: Multi-Tenant
---

# Multi-Tenant Middleware

Coming soon. See package README for details.

## Installation

```bash
npm install @saga-bus/middleware-tenant
```

## Basic Usage

```typescript
import { createTenantMiddleware, getTenantId } from '@saga-bus/middleware-tenant';

const bus = createBus({
  middleware: [
    createTenantMiddleware({
      extractTenantId: (envelope) => envelope.headers['x-tenant-id'],
    }),
  ],
});
```
