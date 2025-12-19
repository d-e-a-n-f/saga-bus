---
sidebar_position: 5
title: AWS SQS
---

# AWS SQS Transport

Coming soon. See package README for details.

## Installation

```bash
npm install @saga-bus/transport-sqs @aws-sdk/client-sqs
```

## Basic Usage

```typescript
import { SqsTransport } from '@saga-bus/transport-sqs';

const transport = new SqsTransport({
  region: 'us-east-1',
  queueUrlPrefix: 'https://sqs.us-east-1.amazonaws.com/123456789/saga-bus',
});
```
