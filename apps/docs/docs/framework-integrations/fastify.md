---
sidebar_position: 5
title: Fastify
---

# Fastify Integration

Coming soon. See package README for details.

## Installation

```bash
npm install @saga-bus/fastify
```

## Usage

```typescript
import Fastify from 'fastify';
import { sagaBusFastifyPlugin } from '@saga-bus/fastify';

const fastify = Fastify();
fastify.register(sagaBusFastifyPlugin, { bus });
```
