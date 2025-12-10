import * as amqp from "amqplib";
import type { Channel } from "amqplib";
import type { RabbitMqTransportOptions } from "./types.js";

// The amqplib types export ChannelModel which has the connection methods we need
type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>;

/**
 * Manages AMQP connection and channel lifecycle with auto-reconnection.
 */
export class ConnectionManager {
  private readonly options: RabbitMqTransportOptions;
  private connection: AmqpConnection | null = null;
  private channel: Channel | null = null;
  private reconnectAttempt = 0;
  private isConnecting = false;
  private isClosed = false;

  private readonly onConnectedCallbacks: Array<() => void> = [];
  private readonly onDisconnectedCallbacks: Array<(error?: Error) => void> = [];

  constructor(options: RabbitMqTransportOptions) {
    this.options = options;
  }

  /**
   * Connect to RabbitMQ and set up the channel.
   */
  async connect(): Promise<void> {
    if (this.connection && this.channel) {
      return;
    }

    if (this.isConnecting) {
      // Wait for existing connection attempt
      return new Promise((resolve) => {
        this.onConnectedCallbacks.push(resolve);
      });
    }

    this.isConnecting = true;
    this.isClosed = false;

    try {
      this.connection = await amqp.connect(this.options.uri);

      // Set up connection error handling
      this.connection.on("error", (error: Error) => {
        console.error("[RabbitMQ] Connection error:", error.message);
        this.handleDisconnect(error);
      });

      this.connection.on("close", () => {
        if (!this.isClosed) {
          console.warn("[RabbitMQ] Connection closed unexpectedly");
          this.handleDisconnect();
        }
      });

      // Create channel
      this.channel = await this.connection.createChannel();

      // Set up channel error handling
      this.channel.on("error", (error: Error) => {
        console.error("[RabbitMQ] Channel error:", error.message);
      });

      this.channel.on("close", () => {
        if (!this.isClosed) {
          console.warn("[RabbitMQ] Channel closed");
        }
      });

      // Assert exchange
      const exchangeType = this.options.exchangeType ?? "topic";
      const durable = this.options.durable ?? true;

      await this.channel.assertExchange(this.options.exchange, exchangeType, {
        durable,
      });

      this.reconnectAttempt = 0;
      this.isConnecting = false;

      // Notify listeners
      for (const callback of this.onConnectedCallbacks) {
        callback();
      }
      this.onConnectedCallbacks.length = 0;

      console.info("[RabbitMQ] Connected successfully");
    } catch (error) {
      this.isConnecting = false;
      throw error;
    }
  }

  /**
   * Handle disconnection and attempt reconnection.
   */
  private handleDisconnect(error?: Error): void {
    this.connection = null;
    this.channel = null;

    // Notify listeners
    for (const callback of this.onDisconnectedCallbacks) {
      callback(error);
    }

    if (!this.isClosed) {
      void this.reconnect();
    }
  }

  /**
   * Attempt to reconnect with exponential backoff.
   */
  private async reconnect(): Promise<void> {
    const maxAttempts = this.options.reconnect?.maxAttempts ?? 10;
    const initialDelay = this.options.reconnect?.initialDelayMs ?? 1000;
    const maxDelay = this.options.reconnect?.maxDelayMs ?? 30000;

    if (this.reconnectAttempt >= maxAttempts) {
      console.error("[RabbitMQ] Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempt++;

    const delay = Math.min(
      initialDelay * Math.pow(2, this.reconnectAttempt - 1),
      maxDelay
    );

    console.info(
      `[RabbitMQ] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt}/${maxAttempts})`
    );

    await new Promise((resolve) => setTimeout(resolve, delay));

    if (this.isClosed) {
      return;
    }

    try {
      await this.connect();
    } catch (error) {
      console.error("[RabbitMQ] Reconnection failed:", error);
      void this.reconnect();
    }
  }

  /**
   * Close the connection.
   */
  async close(): Promise<void> {
    this.isClosed = true;

    if (this.channel) {
      try {
        await this.channel.close();
      } catch {
        // Ignore close errors
      }
      this.channel = null;
    }

    if (this.connection) {
      try {
        await this.connection.close();
      } catch {
        // Ignore close errors
      }
      this.connection = null;
    }
  }

  /**
   * Get the current channel.
   * @throws if not connected
   */
  getChannel(): Channel {
    if (!this.channel) {
      throw new Error("Not connected to RabbitMQ");
    }
    return this.channel;
  }

  /**
   * Check if connected.
   */
  isConnected(): boolean {
    return this.connection !== null && this.channel !== null;
  }

  /**
   * Register a callback for when connection is established.
   */
  onConnected(callback: () => void): void {
    this.onConnectedCallbacks.push(callback);
  }

  /**
   * Register a callback for when connection is lost.
   */
  onDisconnected(callback: (error?: Error) => void): void {
    this.onDisconnectedCallbacks.push(callback);
  }
}
