---
sidebar_position: 7
title: DynamoDB
---

# DynamoDB Store

Serverless store using AWS DynamoDB with auto-scaling.

## Installation

```bash npm2yarn
npm install @saga-bus/store-dynamodb @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

## Basic Usage

```typescript
import { DynamoDBSagaStore } from '@saga-bus/store-dynamodb';

const store = new DynamoDBSagaStore({
  tableName: 'sagas',
  region: 'us-east-1',
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
| `tableName` | `string` | Required | DynamoDB table name |
| `region` | `string` | Required | AWS region |
| `endpoint` | `string` | - | Custom endpoint (LocalStack) |
| `credentials` | `object` | - | AWS credentials |
| `client` | `DynamoDBClient` | - | Existing DynamoDB client |

## Full Configuration Example

```typescript
import { DynamoDBSagaStore, createTable } from '@saga-bus/store-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { fromIni } from '@aws-sdk/credential-providers';

// Option 1: Basic configuration
const store = new DynamoDBSagaStore({
  tableName: 'sagas',
  region: 'us-east-1',
});

// Option 2: With credentials
const store = new DynamoDBSagaStore({
  tableName: 'sagas',
  region: 'us-east-1',
  credentials: fromIni({ profile: 'production' }),
});

// Option 3: Existing client
const client = new DynamoDBClient({
  region: 'us-east-1',
  maxAttempts: 3,
});

const store = new DynamoDBSagaStore({
  client,
  tableName: 'sagas',
});

// Create table if needed
await createTable(store);
```

## Table Schema

### Primary Key Design

```
Partition Key (PK): sagaName
Sort Key (SK): sagaId
```

### Global Secondary Index

```
GSI: correlationIndex
  Partition Key: sagaName
  Sort Key: correlationId
```

### CloudFormation/CDK

```yaml
# CloudFormation
Resources:
  SagasTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: sagas
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: sagaName
          AttributeType: S
        - AttributeName: sagaId
          AttributeType: S
        - AttributeName: correlationId
          AttributeType: S
      KeySchema:
        - AttributeName: sagaName
          KeyType: HASH
        - AttributeName: sagaId
          KeyType: RANGE
      GlobalSecondaryIndexes:
        - IndexName: correlationIndex
          KeySchema:
            - AttributeName: sagaName
              KeyType: HASH
            - AttributeName: correlationId
              KeyType: RANGE
          Projection:
            ProjectionType: ALL
      TimeToLiveSpecification:
        AttributeName: ttl
        Enabled: true
```

### Terraform

```hcl
resource "aws_dynamodb_table" "sagas" {
  name         = "sagas"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "sagaName"
  range_key    = "sagaId"

  attribute {
    name = "sagaName"
    type = "S"
  }

  attribute {
    name = "sagaId"
    type = "S"
  }

  attribute {
    name = "correlationId"
    type = "S"
  }

  global_secondary_index {
    name            = "correlationIndex"
    hash_key        = "sagaName"
    range_key       = "correlationId"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }
}
```

## LocalStack Development

For local development:

```typescript
const store = new DynamoDBSagaStore({
  tableName: 'sagas',
  region: 'us-east-1',
  endpoint: 'http://localhost:4566',
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
      - SERVICES=dynamodb
      - DEFAULT_REGION=us-east-1
```

## Optimistic Concurrency

Conditional updates with version:

```typescript
// Built-in optimistic locking
// Uses ConditionExpression to check version
// Throws ConditionalCheckFailedException on conflict
```

## TTL for Completed Sagas

Enable automatic cleanup:

```typescript
const store = new DynamoDBSagaStore({
  tableName: 'sagas',
  region: 'us-east-1',
  ttlDays: 30, // Auto-delete after 30 days
});
```

## IAM Permissions

Required IAM policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query"
      ],
      "Resource": [
        "arn:aws:dynamodb:us-east-1:123456789012:table/sagas",
        "arn:aws:dynamodb:us-east-1:123456789012:table/sagas/index/*"
      ]
    }
  ]
}
```

## Best Practices

### Use On-Demand Billing

```typescript
// PAY_PER_REQUEST for variable workloads
// No capacity planning needed
```

### Enable Point-in-Time Recovery

```yaml
PointInTimeRecoverySpecification:
  PointInTimeRecoveryEnabled: true
```

### Use DynamoDB Streams for Events

```typescript
// Stream changes for audit/analytics
StreamSpecification:
  StreamViewType: NEW_AND_OLD_IMAGES
```

## Global Tables

For multi-region deployments:

```typescript
// Configure global tables in AWS Console or IaC
// Store automatically works with global tables
```

## Cost Optimization

- Use on-demand for unpredictable workloads
- Use provisioned for steady workloads
- Enable TTL to auto-delete old data
- Use sparse indexes

## See Also

- [Stores Overview](/docs/stores/overview)
- [AWS SQS Transport](/docs/transports/sqs)
- [Deployment](/docs/production/deployment)
