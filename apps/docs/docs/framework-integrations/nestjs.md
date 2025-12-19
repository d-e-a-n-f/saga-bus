---
sidebar_position: 2
title: NestJS
---

# NestJS Integration

Coming soon. See package README for details.

## Installation

```bash
npm install @saga-bus/nestjs
```

## Usage

```typescript
import { Module } from '@nestjs/common';
import { SagaBusModule } from '@saga-bus/nestjs';

@Module({
  imports: [
    SagaBusModule.forRoot({
      transport: { /* config */ },
      store: { /* config */ },
      sagas: [OrderSaga],
    }),
  ],
})
export class AppModule {}
```
