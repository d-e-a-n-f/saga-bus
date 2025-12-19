---
sidebar_position: 4
title: MySQL
---

# MySQL Store

Coming soon. See package README for details.

## Installation

```bash
npm install @saga-bus/store-mysql mysql2
```

## Usage

```typescript
import { MySqlSagaStore, createSchema } from '@saga-bus/store-mysql';

const store = new MySqlSagaStore({
  connectionString: process.env.MYSQL_URL,
});
```
