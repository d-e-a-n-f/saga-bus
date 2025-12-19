---
sidebar_position: 5
title: AWS SQS
---

# AWS SQS Transport

Serverless transport using AWS SQS FIFO queues for exactly-once delivery.

## Installation

```bash npm2yarn
npm install @saga-bus/transport-sqs @aws-sdk/client-sqs
```

## Basic Usage

```typescript
import { SqsTransport } from '@saga-bus/transport-sqs';

const transport = new SqsTransport({
  region: 'us-east-1',
  queueUrlPrefix: 'https://sqs.us-east-1.amazonaws.com/123456789012/saga-bus',
});

const bus = createBus({
  transport,
  store,
  sagas: [{ definition: orderSaga }],
});

await bus.start();
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `region` | `string` | Required | AWS region |
| `queueUrlPrefix` | `string` | Required | Base URL for queues |
| `credentials` | `object` | - | AWS credentials |
| `endpoint` | `string` | - | Custom endpoint (LocalStack) |
| `visibilityTimeout` | `number` | `30` | Visibility timeout (seconds) |
| `waitTimeSeconds` | `number` | `20` | Long polling wait time |
| `maxNumberOfMessages` | `number` | `10` | Messages per receive |

## Full Configuration Example

```typescript
import { SqsTransport } from '@saga-bus/transport-sqs';
import { fromIni } from '@aws-sdk/credential-providers';

const transport = new SqsTransport({
  region: 'us-east-1',
  queueUrlPrefix: 'https://sqs.us-east-1.amazonaws.com/123456789012/myapp',

  // Use named profile
  credentials: fromIni({ profile: 'production' }),

  // Queue settings
  visibilityTimeout: 60,
  waitTimeSeconds: 20,
  maxNumberOfMessages: 10,
});
```

## Queue Naming

FIFO queues are created automatically:

```
{queueUrlPrefix}-{SagaName}-{MessageType}.fifo
```

For example:
- `myapp-OrderSaga-OrderSubmitted.fifo`
- `myapp-OrderSaga-PaymentCaptured.fifo`

## IAM Permissions

Required IAM policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sqs:SendMessage",
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes",
        "sqs:CreateQueue",
        "sqs:SetQueueAttributes"
      ],
      "Resource": "arn:aws:sqs:us-east-1:123456789012:myapp-*"
    }
  ]
}
```

## LocalStack Development

For local development with LocalStack:

```typescript
const transport = new SqsTransport({
  region: 'us-east-1',
  endpoint: 'http://localhost:4566',
  queueUrlPrefix: 'http://localhost:4566/000000000000/saga-bus',
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
});
```

Docker Compose:

```yaml
services:
  localstack:
    image: localstack/localstack:latest
    ports:
      - "4566:4566"
    environment:
      - SERVICES=sqs
      - DEFAULT_REGION=us-east-1
```

## Message Deduplication

SQS FIFO queues provide exactly-once delivery:

```typescript
// Messages are deduplicated by:
// 1. Content-based deduplication (message body hash)
// 2. Explicit deduplication ID
```

## Message Grouping

Messages are grouped by correlation ID:

```typescript
// All messages for same orderId go to same group
// Ensures FIFO ordering per saga instance
```

## Dead Letter Queue

Configure a DLQ for failed messages:

```typescript
const transport = new SqsTransport({
  region: 'us-east-1',
  queueUrlPrefix: '...',
  deadLetterQueueArn: 'arn:aws:sqs:us-east-1:123456789012:myapp-dlq.fifo',
  maxReceiveCount: 3, // Move to DLQ after 3 failures
});
```

## Lambda Integration

For serverless processing:

```typescript
// Lambda handler
export const handler = async (event: SQSEvent) => {
  for (const record of event.Records) {
    const message = JSON.parse(record.body);
    await processMessage(message);
  }
};
```

## Best Practices

### Use FIFO Queues

Always use FIFO queues for saga processing:
- Ensures message ordering
- Provides exactly-once delivery
- Required for correlation ID grouping

### Set Appropriate Visibility Timeout

```typescript
// Timeout should exceed max handler execution time
visibilityTimeout: Math.ceil(maxHandlerTime / 1000) * 2
```

### Enable Long Polling

```typescript
// Reduces API calls and costs
waitTimeSeconds: 20  // Maximum allowed
```

## Cost Optimization

- Use long polling (`waitTimeSeconds: 20`)
- Batch message operations
- Use reserved concurrency for predictable costs

## See Also

- [Transports Overview](/docs/transports/overview)
- [Deployment](/docs/production/deployment)
- [Error Recovery](/docs/production/error-recovery)
