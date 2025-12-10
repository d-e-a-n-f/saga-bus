import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

/**
 * DynamoDB saga store configuration options.
 */
export interface DynamoDBSagaStoreOptions {
  /**
   * DynamoDB Document Client instance.
   */
  client: DynamoDBDocumentClient;

  /**
   * Table name for saga instances.
   */
  tableName: string;

  /**
   * Name of the correlation ID GSI.
   * @default "GSI1"
   */
  correlationIndexName?: string;

  /**
   * Name of the cleanup GSI (for querying completed sagas by date).
   * @default "GSI2"
   */
  cleanupIndexName?: string;
}

/**
 * Shape of a saga instance item in DynamoDB.
 */
export interface SagaInstanceItem {
  PK: string;
  SK: string;
  sagaName: string;
  sagaId: string;
  correlationId: string;
  version: number;
  isCompleted: boolean;
  state: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  GSI1PK: string;
  GSI1SK: string;
  GSI2PK?: string;
  GSI2SK?: string;
}

/**
 * Table schema definition for creating the table.
 */
export interface TableSchema {
  tableName: string;
  correlationIndexName: string;
  cleanupIndexName: string;
}
