---
sidebar_position: 6
title: Hono
---

# Hono Integration

Coming soon. See package README for details.

## Installation

```bash
npm install @saga-bus/hono
```

## Usage

```typescript
import { Hono } from 'hono';
import { sagaBusMiddleware } from '@saga-bus/hono';

const app = new Hono();
app.use('*', sagaBusMiddleware({ bus }));
```
