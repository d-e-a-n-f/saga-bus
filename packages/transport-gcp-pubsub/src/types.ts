import type { PubSub, ClientConfig } from "@google-cloud/pubsub";

/**
 * Configuration options for the GCP Pub/Sub transport.
 */
export interface GcpPubSubTransportOptions {
  /** Existing PubSub client instance */
  pubsub?: PubSub;

  /** Client config for creating new PubSub instance */
  clientConfig?: ClientConfig;

  /** Project ID (required if not in clientConfig) */
  projectId?: string;

  /** Default topic for publishing */
  defaultTopic?: string;

  /** Subscription name prefix */
  subscriptionPrefix?: string;

  /** Whether to use ordering keys for message ordering */
  enableOrdering?: boolean;

  /** Max messages to pull at once */
  maxMessages?: number;

  /** Ack deadline in seconds */
  ackDeadlineSeconds?: number;

  /** Whether to auto-create topics/subscriptions */
  autoCreate?: boolean;

  /** Dead-letter topic for failed messages */
  deadLetterTopic?: string;

  /** Max delivery attempts before dead-letter */
  maxDeliveryAttempts?: number;
}
