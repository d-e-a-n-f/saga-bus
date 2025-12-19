---
sidebar_position: 2
title: In-Memory
---

# In-Memory Store

For testing and development only.

## Installation

```bash
npm install @saga-bus/store-inmemory
```

## Usage

```typescript
import { InMemorySagaStore } from '@saga-bus/store-inmemory';

const store = new InMemorySagaStore();
```

## Limitations

- No persistence
- Single process only
- Data lost on restart
