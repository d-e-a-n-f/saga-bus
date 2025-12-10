# @saga-bus/transport-sqs

AWS SQS FIFO transport for saga-bus.

## Installation

```bash
pnpm add @saga-bus/transport-sqs @aws-sdk/client-sqs
```

## Usage

```typescript
import { SQSClient } from "@aws-sdk/client-sqs";
import { SqsTransport } from "@saga-bus/transport-sqs";
import { createBus } from "@saga-bus/core";

const sqsClient = new SQSClient({ region: "us-east-1" });

const transport = new SqsTransport({
  client: sqsClient,
  queueUrl: "https://sqs.us-east-1.amazonaws.com/123456789/my-queue.fifo",
});

const bus = createBus({
  transport,
  sagas: [...],
});

await bus.start();
```

## Features

- FIFO queue support for ordered message processing
- Message deduplication via MessageDeduplicationId
- Message grouping via MessageGroupId (uses correlation ID)
- Long polling for efficient message retrieval
- Configurable visibility timeout
- Concurrent poll loops

## FIFO Queue Requirements

This transport requires a FIFO queue (queue URL must end with `.fifo`):

```bash
aws sqs create-queue \
  --queue-name my-queue.fifo \
  --attributes FifoQueue=true,ContentBasedDeduplication=false
```

## Message Attributes

Messages are published with:

| Attribute | Value |
|-----------|-------|
| `MessageGroupId` | Correlation ID or message ID |
| `MessageDeduplicationId` | Message ID |
| `MessageAttributes.type` | Message type |
| `MessageAttributes.correlationId` | Correlation ID |

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `client` | `SQSClient` | required | AWS SQS client |
| `queueUrl` | `string` | required | FIFO queue URL |
| `maxMessages` | `number` | `10` | Messages per poll |
| `waitTimeSeconds` | `number` | `20` | Long poll wait time |
| `visibilityTimeout` | `number` | `30` | Visibility timeout (seconds) |
| `concurrency` | `number` | `1` | Concurrent poll loops |

## Error Handling

Failed messages remain in the queue after visibility timeout expires. Configure a dead-letter queue (DLQ) for messages that repeatedly fail:

```bash
aws sqs set-queue-attributes \
  --queue-url https://sqs.../my-queue.fifo \
  --attributes RedrivePolicy='{"deadLetterTargetArn":"arn:aws:sqs:...:dlq.fifo","maxReceiveCount":"3"}'
```

## License

MIT
