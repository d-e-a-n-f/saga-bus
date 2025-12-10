import type { TokenCredential } from "@azure/service-bus";

/**
 * Configuration options for Azure Service Bus transport.
 */
export interface AzureServiceBusTransportOptions {
  /**
   * Connection string for Azure Service Bus.
   * Either connectionString OR (fullyQualifiedNamespace + credential) must be provided.
   */
  connectionString?: string;

  /**
   * Fully qualified namespace (e.g., "mybus.servicebus.windows.net").
   * Use with credential for Azure AD authentication.
   */
  fullyQualifiedNamespace?: string;

  /**
   * Token credential for Azure AD authentication.
   * Use with fullyQualifiedNamespace.
   */
  credential?: TokenCredential;

  /**
   * Default topic for publishing messages.
   * If not provided, message type is used as topic name.
   */
  defaultTopic?: string;

  /**
   * Subscription name for receiving messages.
   * Required for subscribing to topics.
   */
  subscriptionName?: string;

  /**
   * Whether to use sessions for ordered message processing.
   * When enabled, correlation ID is used as session ID.
   * @default false
   */
  sessionEnabled?: boolean;

  /**
   * Maximum number of concurrent message handlers.
   * @default 1
   */
  maxConcurrentCalls?: number;

  /**
   * Maximum duration for auto-lock renewal in milliseconds.
   * @default 300000 (5 minutes)
   */
  maxAutoLockRenewalDurationInMs?: number;

  /**
   * Whether to auto-complete messages after successful processing.
   * @default false (manual acknowledgment)
   */
  autoCompleteMessages?: boolean;

  /**
   * Receive mode: "peekLock" or "receiveAndDelete".
   * @default "peekLock"
   */
  receiveMode?: "peekLock" | "receiveAndDelete";

  /**
   * Prefix for queue/topic names.
   * @default ""
   */
  entityPrefix?: string;
}

/**
 * Subscription handler registration.
 */
export interface SubscriptionRegistration {
  endpoint: string;
  topicName: string;
  subscriptionName: string;
  handler: (envelope: unknown) => Promise<void>;
  concurrency: number;
}
