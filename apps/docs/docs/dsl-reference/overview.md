---
sidebar_position: 1
---

# DSL Overview

The fluent builder API for defining sagas.

## Creating a Saga

```typescript
import { createSagaMachine } from '@saga-bus/core';

const saga = createSagaMachine<MyState, MyMessages>()
  .name('MySaga')
  .correlate('StartEvent', msg => msg.id, { canStart: true })
  .initial<StartEvent>(msg => ({ /* initial state */ }))
  .on('SomeEvent').handle(async (msg, state, ctx) => state)
  .build();
```

## Builder Chain

```
createSagaMachine<State, Messages>()
    │
    ▼
.name('SagaName')              ──► Required
    │
    ▼
.correlate(...)                ──► At least one with canStart
    │
    ▼
.initial<Message>(...)         ──► Required
    │
    ▼
.on('Message')                 ──► Message handlers
  .when(predicate)             ──► Optional state guard
  .handle(handler)             ──► Handler function
    │
    ▼
.build()                       ──► Returns SagaDefinition
```

## Type Parameters

```typescript
createSagaMachine<TState, TMessages>()
```

- `TState` - Your saga state interface (must extend `SagaState`)
- `TMessages` - Union of all message types

## Sections

- [Builder Methods](/docs/dsl-reference/builder-methods) - `.name()`, `.correlate()`, `.initial()`
- [Handlers](/docs/dsl-reference/handlers) - `.on()`, `.when()`, `.handle()`
- [Context API](/docs/dsl-reference/context-api) - `SagaContext` methods
- [TypeScript Tips](/docs/dsl-reference/typescript-tips) - Type inference patterns
