---
sidebar_position: 9
title: SQLite
---

# SQLite Store

Perfect for local development and testing.

## Installation

```bash
npm install @saga-bus/store-sqlite better-sqlite3
```

## Usage

```typescript
import Database from 'better-sqlite3';
import { SqliteSagaStore, createSchema } from '@saga-bus/store-sqlite';

const db = new Database(':memory:'); // or 'path/to/db.sqlite'
createSchema(db);

const store = new SqliteSagaStore({ db });
```
