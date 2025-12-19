---
sidebar_position: 8
title: Redis
---

# Redis Store

Coming soon. See package README for details.

## Installation

```bash
npm install @saga-bus/store-redis ioredis
```

## Usage

```typescript
import { RedisSagaStore } from '@saga-bus/store-redis';

const store = new RedisSagaStore({
  url: 'redis://localhost:6379',
});
```
