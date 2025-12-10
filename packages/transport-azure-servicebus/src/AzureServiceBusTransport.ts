import {
  ServiceBusClient,
  ServiceBusSender,
  ServiceBusReceiver,
  ServiceBusReceivedMessage,
  ServiceBusSessionReceiver,
} from "@azure/service-bus";
import type {
  Transport,
  TransportSubscribeOptions,
  TransportPublishOptions,
  MessageEnvelope,
  BaseMessage,
} from "@saga-bus/core";
import type { AzureServiceBusTransportOptions, SubscriptionRegistration } from "./types.js";
import { randomUUID } from "crypto";

/**
 * Azure Service Bus transport implementation for saga-bus.
 *
 * Supports both queue and topic/subscription patterns with optional
 * session-based message ordering.
 */
export class AzureServiceBusTransport implements Transport {
  private client: ServiceBusClient | null = null;
  private readonly options: AzureServiceBusTransportOptions;
  private readonly senders = new Map<string, ServiceBusSender>();
  private readonly receivers: Array<ServiceBusReceiver | ServiceBusSessionReceiver> = [];
  private readonly subscriptions: SubscriptionRegistration[] = [];
  private started = false;
  private stopping = false;

  constructor(options: AzureServiceBusTransportOptions) {
    if (!options.connectionString && !options.fullyQualifiedNamespace) {
      throw new Error(
        "Either connectionString or fullyQualifiedNamespace must be provided"
      );
    }

    if (options.fullyQualifiedNamespace && !options.credential) {
      throw new Error(
        "credential is required when using fullyQualifiedNamespace"
      );
    }

    this.options = {
      maxConcurrentCalls: 1,
      maxAutoLockRenewalDurationInMs: 300000,
      autoCompleteMessages: false,
      receiveMode: "peekLock",
      entityPrefix: "",
      sessionEnabled: false,
      ...options,
    };
  }

  async start(): Promise<void> {
    if (this.started) return;

    // Create the ServiceBusClient
    if (this.options.connectionString) {
      this.client = new ServiceBusClient(this.options.connectionString);
    } else if (this.options.fullyQualifiedNamespace && this.options.credential) {
      this.client = new ServiceBusClient(
        this.options.fullyQualifiedNamespace,
        this.options.credential
      );
    } else {
      throw new Error("Invalid configuration");
    }

    // Start all registered subscriptions
    for (const sub of this.subscriptions) {
      await this.startReceiver(sub);
    }

    this.started = true;
  }

  async stop(): Promise<void> {
    if (!this.started || this.stopping) return;
    this.stopping = true;

    // Close all receivers
    for (const receiver of this.receivers) {
      try {
        await receiver.close();
      } catch (error) {
        console.error("[AzureServiceBus] Error closing receiver:", error);
      }
    }
    this.receivers.length = 0;

    // Close all senders
    for (const sender of this.senders.values()) {
      try {
        await sender.close();
      } catch (error) {
        console.error("[AzureServiceBus] Error closing sender:", error);
      }
    }
    this.senders.clear();

    // Close the client
    if (this.client) {
      await this.client.close();
      this.client = null;
    }

    this.started = false;
    this.stopping = false;
  }

  async subscribe<TMessage extends BaseMessage>(
    options: TransportSubscribeOptions,
    handler: (envelope: MessageEnvelope<TMessage>) => Promise<void>
  ): Promise<void> {
    const { endpoint, concurrency = 1, group } = options;

    // Build topic and subscription names
    const topicName = `${this.options.entityPrefix}${endpoint}`;
    const subscriptionName =
      group ?? this.options.subscriptionName ?? "default";

    const registration: SubscriptionRegistration = {
      endpoint,
      topicName,
      subscriptionName,
      handler: handler as (envelope: unknown) => Promise<void>,
      concurrency,
    };

    this.subscriptions.push(registration);

    // If already started, immediately start the receiver
    if (this.started && this.client) {
      await this.startReceiver(registration);
    }
  }

  async publish<TMessage extends BaseMessage>(
    message: TMessage,
    options: TransportPublishOptions
  ): Promise<void> {
    if (!this.client) {
      throw new Error("Transport not started");
    }

    const { endpoint, key, headers = {}, delayMs } = options;
    const topicName = `${this.options.entityPrefix}${
      endpoint ?? this.options.defaultTopic ?? message.type
    }`;

    // Get or create sender
    let sender = this.senders.get(topicName);
    if (!sender) {
      sender = this.client.createSender(topicName);
      this.senders.set(topicName, sender);
    }

    // Create message envelope
    const envelope: MessageEnvelope<TMessage> = {
      id: randomUUID(),
      type: message.type,
      payload: message,
      headers: headers as Record<string, string>,
      timestamp: new Date(),
      partitionKey: key,
    };

    // Build Service Bus message
    const sbMessage: {
      body: MessageEnvelope<TMessage>;
      messageId: string;
      contentType: string;
      sessionId?: string;
      partitionKey?: string;
      applicationProperties: Record<string, string>;
      scheduledEnqueueTimeUtc?: Date;
    } = {
      body: envelope,
      messageId: envelope.id,
      contentType: "application/json",
      applicationProperties: {
        messageType: message.type,
        ...headers,
      },
    };

    // Set session ID for ordered delivery if enabled
    if (this.options.sessionEnabled && key) {
      sbMessage.sessionId = key;
    } else if (key) {
      sbMessage.partitionKey = key;
    }

    // Handle delayed delivery using native scheduled messages
    if (delayMs && delayMs > 0) {
      sbMessage.scheduledEnqueueTimeUtc = new Date(Date.now() + delayMs);
    }

    await sender.sendMessages(sbMessage);
  }

  private async startReceiver(registration: SubscriptionRegistration): Promise<void> {
    if (!this.client) return;

    const { topicName, subscriptionName, handler, concurrency } = registration;

    let receiver: ServiceBusReceiver | ServiceBusSessionReceiver;

    if (this.options.sessionEnabled) {
      // Session-enabled receiver for ordered processing
      receiver = await this.client.acceptNextSession(topicName, subscriptionName, {
        maxAutoLockRenewalDurationInMs: this.options.maxAutoLockRenewalDurationInMs,
        receiveMode: this.options.receiveMode,
      });
    } else {
      // Regular subscription receiver
      receiver = this.client.createReceiver(topicName, subscriptionName, {
        maxAutoLockRenewalDurationInMs: this.options.maxAutoLockRenewalDurationInMs,
        receiveMode: this.options.receiveMode,
      });
    }

    this.receivers.push(receiver);

    // Start message processing
    receiver.subscribe(
      {
        processMessage: async (message: ServiceBusReceivedMessage) => {
          try {
            const envelope = message.body as MessageEnvelope;

            // Ensure envelope has required fields
            if (!envelope || !envelope.type || !envelope.payload) {
              console.error("[AzureServiceBus] Invalid message format:", message);
              if (this.options.receiveMode === "peekLock") {
                await receiver.deadLetterMessage(message, {
                  deadLetterReason: "InvalidMessageFormat",
                  deadLetterErrorDescription: "Message body is not a valid envelope",
                });
              }
              return;
            }

            await handler(envelope);

            // Complete message if not auto-completed
            if (
              this.options.receiveMode === "peekLock" &&
              !this.options.autoCompleteMessages
            ) {
              await receiver.completeMessage(message);
            }
          } catch (error) {
            console.error("[AzureServiceBus] Message handler error:", error);

            if (this.options.receiveMode === "peekLock") {
              // Abandon for retry
              await receiver.abandonMessage(message);
            }

            throw error;
          }
        },
        processError: async (args) => {
          console.error(
            "[AzureServiceBus] Error from receiver:",
            args.error,
            "Source:",
            args.errorSource
          );
        },
      },
      {
        maxConcurrentCalls: concurrency,
        autoCompleteMessages: this.options.autoCompleteMessages,
      }
    );
  }
}
