---
sidebar_position: 6
title: MongoDB
---

# MongoDB Store

Coming soon. See package README for details.

## Installation

```bash
npm install @saga-bus/store-mongodb mongodb
```

## Usage

```typescript
import { MongoSagaStore } from '@saga-bus/store-mongodb';

const store = new MongoSagaStore({
  connectionString: process.env.MONGODB_URL,
  database: 'sagas',
});
```
