import type { SQSClient } from "@aws-sdk/client-sqs";

/**
 * SQS transport configuration options.
 */
export interface SqsTransportOptions {
  /**
   * AWS SQS client instance.
   */
  client: SQSClient;

  /**
   * SQS FIFO queue URL.
   * Must end with `.fifo`.
   */
  queueUrl: string;

  /**
   * Maximum number of messages to receive per poll.
   * @default 10
   */
  maxMessages?: number;

  /**
   * Long polling wait time in seconds.
   * @default 20
   */
  waitTimeSeconds?: number;

  /**
   * Visibility timeout in seconds.
   * @default 30
   */
  visibilityTimeout?: number;

  /**
   * Number of concurrent poll loops.
   * @default 1
   */
  concurrency?: number;
}

/**
 * Internal subscription tracking.
 */
export interface SqsSubscription {
  endpoint: string;
  concurrency: number;
}
