import type { NatsConnection, ConnectionOptions, JetStreamOptions } from "nats";

/**
 * Configuration options for the NATS JetStream transport.
 */
export interface NatsTransportOptions {
  /** Existing NATS connection */
  connection?: NatsConnection;

  /** Connection options for creating new connection */
  connectionOptions?: ConnectionOptions;

  /** JetStream options */
  jetStreamOptions?: JetStreamOptions;

  /** Subject prefix for all messages (default: "saga-bus") */
  subjectPrefix?: string;

  /** Stream name for JetStream (default: "SAGA_BUS") */
  streamName?: string;

  /** Consumer name prefix (default: "saga-bus-consumer") */
  consumerPrefix?: string;

  /** Whether to auto-create streams (default: true) */
  autoCreateStream?: boolean;

  /** Stream retention policy (default: "workqueue") */
  retentionPolicy?: "limits" | "interest" | "workqueue";

  /** Max messages in stream (-1 for unlimited, default: -1) */
  maxMessages?: number;

  /** Max bytes in stream (-1 for unlimited, default: -1) */
  maxBytes?: number;

  /** Max age of messages in nanoseconds */
  maxAge?: number;

  /** Number of replicas (default: 1) */
  replicas?: number;

  /** Ack wait timeout in nanoseconds (default: 30_000_000_000 = 30s) */
  ackWait?: number;

  /** Max redelivery attempts (default: 5) */
  maxDeliver?: number;
}
