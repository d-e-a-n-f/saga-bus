---
sidebar_position: 10
title: Prisma
---

# Prisma Store

Coming soon. See package README for details.

## Installation

```bash
npm install @saga-bus/store-prisma
```

## Usage

```typescript
import { PrismaSagaStore } from '@saga-bus/store-prisma';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const store = new PrismaSagaStore({ prisma });
```
