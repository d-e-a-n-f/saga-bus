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

export const builderNodes = [
  { id: 'create', type: 'stateNode', position: { x: 150, y: 0 }, data: { label: 'createSagaMachine<State, Messages>()', status: 'initial' } },
  { id: 'name', type: 'stateNode', position: { x: 150, y: 70 }, data: { label: '.name()', description: 'Required', status: 'active' } },
  { id: 'correlate', type: 'stateNode', position: { x: 150, y: 140 }, data: { label: '.correlate()', description: 'At least one with canStart', status: 'active' } },
  { id: 'initial', type: 'stateNode', position: { x: 150, y: 210 }, data: { label: '.initial<Message>()', description: 'Required', status: 'active' } },
  { id: 'on', type: 'stateNode', position: { x: 150, y: 280 }, data: { label: '.on()', description: 'Message handlers', status: 'active' } },
  { id: 'when', type: 'stateNode', position: { x: 50, y: 350 }, data: { label: '.when()', description: 'Optional guard', status: 'pending' } },
  { id: 'handle', type: 'stateNode', position: { x: 250, y: 350 }, data: { label: '.handle()', description: 'Handler function', status: 'active' } },
  { id: 'build', type: 'stateNode', position: { x: 150, y: 430 }, data: { label: '.build()', description: 'Returns SagaDefinition', status: 'success' } },
];

export const builderEdges = [
  { id: 'b1', source: 'create', target: 'name', animated: true },
  { id: 'b2', source: 'name', target: 'correlate' },
  { id: 'b3', source: 'correlate', target: 'initial' },
  { id: 'b4', source: 'initial', target: 'on' },
  { id: 'b5', source: 'on', target: 'when' },
  { id: 'b6', source: 'on', target: 'handle' },
  { id: 'b7', source: 'when', target: 'handle' },
  { id: 'b8', source: 'handle', target: 'build', data: { type: 'success' } },
];

<FlowDiagram nodes={builderNodes} edges={builderEdges} height={530} />

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
