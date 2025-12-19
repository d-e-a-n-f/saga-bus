---
sidebar_position: 8
title: Custom Middleware
---

# Custom Middleware

Coming soon. Learn how to create your own middleware.

## Middleware Interface

```typescript
interface SagaMiddleware {
  name: string;
  execute(
    context: SagaPipelineContext,
    next: () => Promise<void>
  ): Promise<void>;
}
```

## Example

```typescript
const myMiddleware: SagaMiddleware = {
  name: 'my-middleware',
  async execute(context, next) {
    console.log('Before handler');
    await next();
    console.log('After handler');
  },
};
```
