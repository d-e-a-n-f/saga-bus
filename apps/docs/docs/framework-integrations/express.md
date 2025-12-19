---
sidebar_position: 4
title: Express
---

# Express Integration

Coming soon. See package README for details.

## Installation

```bash
npm install @saga-bus/express
```

## Usage

```typescript
import express from 'express';
import { sagaBusMiddleware, createHealthRouter } from '@saga-bus/express';

const app = express();
app.use(sagaBusMiddleware({ bus }));
app.use('/health', createHealthRouter(bus));
```
