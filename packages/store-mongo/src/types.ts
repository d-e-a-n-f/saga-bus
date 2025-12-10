import type { Db } from "mongodb";

/**
 * MongoDB saga store configuration options.
 */
export interface MongoSagaStoreOptions {
  /**
   * MongoDB database instance.
   */
  db: Db;

  /**
   * Collection name for saga instances.
   * @default "saga_instances"
   */
  collectionName?: string;
}

/**
 * Shape of a saga instance document in MongoDB.
 */
export interface SagaInstanceDocument {
  _id: string; // Composite: `${sagaName}:${sagaId}`
  sagaName: string;
  sagaId: string;
  correlationId: string;
  version: number;
  isCompleted: boolean;
  state: unknown;
  createdAt: Date;
  updatedAt: Date;
}
