---
sidebar_position: 3
title: Next.js
---

# Next.js Integration

Coming soon. See package README for details.

## Installation

```bash
npm install @saga-bus/nextjs
```

## Usage

```typescript
// app/api/orders/route.ts
import { publishMessage } from '@saga-bus/nextjs';

export async function POST(request: Request) {
  const body = await request.json();
  await publishMessage({ type: 'OrderSubmitted', ...body });
  return Response.json({ success: true });
}
```
