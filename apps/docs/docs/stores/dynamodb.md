---
sidebar_position: 7
title: DynamoDB
---

# DynamoDB Store

Coming soon. See package README for details.

## Installation

```bash
npm install @saga-bus/store-dynamodb @aws-sdk/client-dynamodb
```

## Usage

```typescript
import { DynamoDBSagaStore } from '@saga-bus/store-dynamodb';

const store = new DynamoDBSagaStore({
  tableName: 'sagas',
  region: 'us-east-1',
});
```
