import type { Kafka } from "kafkajs";

/**
 * Kafka transport configuration options.
 */
export interface KafkaTransportOptions {
  /**
   * KafkaJS Kafka instance.
   */
  kafka: Kafka;

  /**
   * Default topic for publish/subscribe.
   * Can be overridden per-operation via endpoint.
   */
  defaultTopic?: string;

  /**
   * Consumer group ID.
   * Required for subscribing.
   */
  groupId?: string;

  /**
   * Whether to create topics if they don't exist.
   * @default false
   */
  createTopics?: boolean;

  /**
   * Number of partitions when creating topics.
   * @default 3
   */
  numPartitions?: number;

  /**
   * Replication factor when creating topics.
   * @default 1
   */
  replicationFactor?: number;

  /**
   * Whether to start consuming from the beginning.
   * @default false (latest)
   */
  fromBeginning?: boolean;

  /**
   * Session timeout in milliseconds.
   * @default 30000
   */
  sessionTimeout?: number;

  /**
   * Heartbeat interval in milliseconds.
   * @default 3000
   */
  heartbeatInterval?: number;
}

/**
 * Internal subscription tracking.
 */
export interface KafkaSubscription {
  topic: string;
  concurrency: number;
}
