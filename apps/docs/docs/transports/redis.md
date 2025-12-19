---
sidebar_position: 8
title: Redis Streams
---

# Redis Streams Transport

Coming soon. See package README for details.

## Installation

```bash
npm install @saga-bus/transport-redis ioredis
```

## Basic Usage

```typescript
import { RedisTransport } from '@saga-bus/transport-redis';

const transport = new RedisTransport({
  url: 'redis://localhost:6379',
});
```
