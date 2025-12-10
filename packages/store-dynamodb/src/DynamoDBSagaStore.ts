import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { SagaStore, SagaState } from "@saga-bus/core";
import { ConcurrencyError } from "@saga-bus/core";
import type { DynamoDBSagaStoreOptions, SagaInstanceItem } from "./types.js";

/**
 * DynamoDB-backed saga store.
 *
 * @example
 * ```typescript
 * import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
 * import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
 *
 * const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
 * const store = new DynamoDBSagaStore<OrderState>({
 *   client,
 *   tableName: "saga_instances",
 * });
 * ```
 */
export class DynamoDBSagaStore<TState extends SagaState>
  implements SagaStore<TState>
{
  private readonly client: DynamoDBDocumentClient;
  private readonly tableName: string;
  private readonly correlationIndexName: string;
  private readonly cleanupIndexName: string;

  constructor(options: DynamoDBSagaStoreOptions) {
    this.client = options.client;
    this.tableName = options.tableName;
    this.correlationIndexName = options.correlationIndexName ?? "GSI1";
    this.cleanupIndexName = options.cleanupIndexName ?? "GSI2";
  }

  async getById(sagaName: string, sagaId: string): Promise<TState | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: sagaName,
          SK: sagaId,
        },
      })
    );

    if (!result.Item) {
      return null;
    }

    return this.itemToState(result.Item as SagaInstanceItem);
  }

  async getByCorrelationId(
    sagaName: string,
    correlationId: string
  ): Promise<TState | null> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: this.correlationIndexName,
        KeyConditionExpression: "GSI1PK = :pk AND GSI1SK = :sk",
        ExpressionAttributeValues: {
          ":pk": sagaName,
          ":sk": correlationId,
        },
        Limit: 1,
      })
    );

    if (!result.Items || result.Items.length === 0) {
      return null;
    }

    return this.itemToState(result.Items[0] as SagaInstanceItem);
  }

  async insert(sagaName: string, correlationId: string, state: TState): Promise<void> {
    const { sagaId, version, isCompleted, createdAt, updatedAt } =
      state.metadata;

    // Serialize state with dates converted to ISO strings for DynamoDB compatibility
    const serializedState = this.serializeState(state);

    const item: SagaInstanceItem = {
      PK: sagaName,
      SK: sagaId,
      sagaName,
      sagaId,
      correlationId,
      version,
      isCompleted,
      state: serializedState,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
      GSI1PK: sagaName,
      GSI1SK: correlationId,
    };

    // Only add GSI2 keys for completed sagas (for cleanup queries)
    if (isCompleted) {
      item.GSI2PK = sagaName;
      item.GSI2SK = updatedAt.toISOString();
    }

    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
        ConditionExpression: "attribute_not_exists(PK)",
      })
    );
  }

  async update(
    sagaName: string,
    state: TState,
    expectedVersion: number
  ): Promise<void> {
    const { sagaId, version, isCompleted, updatedAt } = state.metadata;

    try {
      const updateExpression = isCompleted
        ? "SET version = :version, isCompleted = :isCompleted, #state = :state, updatedAt = :updatedAt, GSI2PK = :gsi2pk, GSI2SK = :gsi2sk"
        : "SET version = :version, isCompleted = :isCompleted, #state = :state, updatedAt = :updatedAt REMOVE GSI2PK, GSI2SK";

      // Serialize state with dates converted to ISO strings for DynamoDB compatibility
      const serializedState = this.serializeState(state);

      const expressionValues: Record<string, unknown> = {
        ":version": version,
        ":isCompleted": isCompleted,
        ":state": serializedState,
        ":updatedAt": updatedAt.toISOString(),
        ":expectedVersion": expectedVersion,
      };

      if (isCompleted) {
        expressionValues[":gsi2pk"] = sagaName;
        expressionValues[":gsi2sk"] = updatedAt.toISOString();
      }

      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: {
            PK: sagaName,
            SK: sagaId,
          },
          UpdateExpression: updateExpression,
          ConditionExpression: "version = :expectedVersion",
          ExpressionAttributeNames: {
            "#state": "state",
          },
          ExpressionAttributeValues: expressionValues,
        })
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === "ConditionalCheckFailedException"
      ) {
        const existing = await this.getById(sagaName, sagaId);
        if (existing) {
          throw new ConcurrencyError(
            sagaId,
            expectedVersion,
            existing.metadata.version
          );
        } else {
          throw new Error(`Saga ${sagaId} not found`);
        }
      }
      throw error;
    }
  }

  async delete(sagaName: string, sagaId: string): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PK: sagaName,
          SK: sagaId,
        },
      })
    );
  }

  private itemToState(item: SagaInstanceItem): TState {
    const state = item.state as TState;

    return {
      ...state,
      metadata: {
        ...state.metadata,
        sagaId: item.sagaId,
        version: item.version,
        isCompleted: item.isCompleted,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
      },
    };
  }

  /**
   * Serialize state for DynamoDB storage by converting Date objects to ISO strings.
   */
  private serializeState(state: TState): Record<string, unknown> {
    return JSON.parse(JSON.stringify(state, (_, value) => {
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    }));
  }

  // ============ Query Helpers ============

  /**
   * Find sagas by name with pagination.
   */
  async findByName(
    sagaName: string,
    options?: {
      limit?: number;
      startKey?: Record<string, unknown>;
      completed?: boolean;
    }
  ): Promise<{ items: TState[]; lastKey?: Record<string, unknown> }> {
    let filterExpression: string | undefined;
    const expressionValues: Record<string, unknown> = { ":pk": sagaName };

    if (options?.completed !== undefined) {
      filterExpression = "isCompleted = :isCompleted";
      expressionValues[":isCompleted"] = options.completed;
    }

    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk",
        FilterExpression: filterExpression,
        ExpressionAttributeValues: expressionValues,
        Limit: options?.limit ?? 100,
        ExclusiveStartKey: options?.startKey,
        ScanIndexForward: false,
      })
    );

    const items = (result.Items ?? []).map((item) =>
      this.itemToState(item as SagaInstanceItem)
    );

    return {
      items,
      lastKey: result.LastEvaluatedKey,
    };
  }

  /**
   * Delete completed sagas older than a given date.
   * Note: This performs a query + batch delete which may require pagination.
   */
  async deleteCompletedBefore(
    sagaName: string,
    before: Date
  ): Promise<number> {
    let deletedCount = 0;
    let lastKey: Record<string, unknown> | undefined;

    do {
      const result = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: this.cleanupIndexName,
          KeyConditionExpression: "GSI2PK = :pk AND GSI2SK < :before",
          ExpressionAttributeValues: {
            ":pk": sagaName,
            ":before": before.toISOString(),
          },
          Limit: 25,
          ExclusiveStartKey: lastKey,
        })
      );

      if (result.Items && result.Items.length > 0) {
        for (const item of result.Items) {
          await this.delete(sagaName, item.SK as string);
          deletedCount++;
        }
      }

      lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    return deletedCount;
  }
}
