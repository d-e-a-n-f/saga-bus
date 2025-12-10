import {
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  type DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import type { TableSchema } from "./types.js";

/**
 * Get the table schema definition.
 */
export function getTableSchema(
  tableName: string,
  options?: {
    correlationIndexName?: string;
    cleanupIndexName?: string;
  }
): TableSchema {
  return {
    tableName,
    correlationIndexName: options?.correlationIndexName ?? "GSI1",
    cleanupIndexName: options?.cleanupIndexName ?? "GSI2",
  };
}

/**
 * Create the saga instances table with required indexes.
 */
export async function createTable(
  client: DynamoDBClient,
  schema: TableSchema
): Promise<void> {
  const command = new CreateTableCommand({
    TableName: schema.tableName,
    KeySchema: [
      { AttributeName: "PK", KeyType: "HASH" },
      { AttributeName: "SK", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "PK", AttributeType: "S" },
      { AttributeName: "SK", AttributeType: "S" },
      { AttributeName: "GSI1PK", AttributeType: "S" },
      { AttributeName: "GSI1SK", AttributeType: "S" },
      { AttributeName: "GSI2PK", AttributeType: "S" },
      { AttributeName: "GSI2SK", AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: schema.correlationIndexName,
        KeySchema: [
          { AttributeName: "GSI1PK", KeyType: "HASH" },
          { AttributeName: "GSI1SK", KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      },
      {
        IndexName: schema.cleanupIndexName,
        KeySchema: [
          { AttributeName: "GSI2PK", KeyType: "HASH" },
          { AttributeName: "GSI2SK", KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "KEYS_ONLY" },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      },
    ],
    BillingMode: "PROVISIONED",
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    },
  });

  await client.send(command);

  // Wait for table to be active
  await waitForTableActive(client, schema.tableName);
}

/**
 * Delete the saga instances table.
 */
export async function deleteTable(
  client: DynamoDBClient,
  tableName: string
): Promise<void> {
  await client.send(new DeleteTableCommand({ TableName: tableName }));
}

/**
 * Wait for table to be active.
 */
async function waitForTableActive(
  client: DynamoDBClient,
  tableName: string
): Promise<void> {
  for (let i = 0; i < 30; i++) {
    const response = await client.send(
      new DescribeTableCommand({ TableName: tableName })
    );

    if (response.Table?.TableStatus === "ACTIVE") {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Table ${tableName} did not become active`);
}
