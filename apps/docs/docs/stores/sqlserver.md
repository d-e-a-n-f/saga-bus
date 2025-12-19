---
sidebar_position: 5
title: SQL Server
---

# SQL Server Store

Coming soon. See package README for details.

## Installation

```bash
npm install @saga-bus/store-sqlserver mssql
```

## Usage

```typescript
import { SqlServerSagaStore, createSchema } from '@saga-bus/store-sqlserver';

const store = new SqlServerSagaStore({
  connectionString: process.env.MSSQL_URL,
});
```
