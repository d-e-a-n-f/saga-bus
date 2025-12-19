---
sidebar_position: 9
title: NATS JetStream
---

# NATS JetStream Transport

Coming soon. See package README for details.

## Installation

```bash
npm install @saga-bus/transport-nats nats
```

## Basic Usage

```typescript
import { NatsTransport } from '@saga-bus/transport-nats';

const transport = new NatsTransport({
  servers: ['localhost:4222'],
});
```
