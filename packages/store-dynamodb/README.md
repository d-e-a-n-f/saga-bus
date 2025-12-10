# @saga-bus/store-dynamodb

AWS DynamoDB saga store for saga-bus.

## Installation

```bash
pnpm add @saga-bus/store-dynamodb @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

## Usage

```typescript
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoDBSagaStore, createTable } from "@saga-bus/store-dynamodb";
import { createBus } from "@saga-bus/core";

const dynamoClient = new DynamoDBClient({ region: "us-east-1" });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Create table (run once, or use CloudFormation/CDK)
await createTable(dynamoClient, { tableName: "saga-instances" });

const store = new DynamoDBSagaStore({
  client: docClient,
  tableName: "saga-instances",
});

const bus = createBus({
  sagas: [{ definition: mySaga, store }],
  transport,
});
```

## Table Schema

The store uses a single-table design:

| Key | Pattern | Description |
|-----|---------|-------------|
| `PK` | `SAGA#<sagaName>` | Partition key |
| `SK` | `ID#<sagaId>` | Sort key |
| `GSI1PK` | `SAGA#<sagaName>` | Correlation index PK |
| `GSI1SK` | `CORR#<correlationId>` | Correlation index SK |
| `GSI2PK` | `COMPLETED#<date>` | Cleanup index PK |
| `GSI2SK` | `<sagaName>#<sagaId>` | Cleanup index SK |

## Features

- Single-table design for cost efficiency
- Optimistic concurrency via conditional writes
- GSI for correlation ID lookups
- GSI for cleanup queries by completion date
- Automatic GSI index management

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `client` | `DynamoDBDocumentClient` | required | DynamoDB Document Client |
| `tableName` | `string` | required | Table name |
| `correlationIndexName` | `string` | `"GSI1"` | Correlation GSI name |
| `cleanupIndexName` | `string` | `"GSI2"` | Cleanup GSI name |

## Table Management

```typescript
import { createTable, deleteTable, getTableSchema } from "@saga-bus/store-dynamodb";

// Create with defaults
await createTable(dynamoClient, { tableName: "saga-instances" });

// Get schema for CloudFormation/CDK
const schema = getTableSchema("saga-instances");

// Delete table
await deleteTable(dynamoClient, "saga-instances");
```

## License

MIT
