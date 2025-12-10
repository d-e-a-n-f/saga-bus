import type {
  SagaContext,
  MessageEnvelope,
  BaseMessage,
  Transport,
  TransportPublishOptions,
} from "../types/index.js";

export interface SagaContextImplOptions {
  sagaName: string;
  sagaId: string;
  correlationId: string;
  envelope: MessageEnvelope;
  transport: Transport;
  defaultEndpoint?: string;
}

/**
 * Concrete implementation of SagaContext.
 */
export class SagaContextImpl implements SagaContext {
  readonly sagaName: string;
  readonly sagaId: string;
  readonly correlationId: string;
  readonly envelope: MessageEnvelope;
  readonly metadata: Record<string, unknown> = {};

  private readonly transport: Transport;
  private readonly defaultEndpoint?: string;
  private _isCompleted = false;

  constructor(options: SagaContextImplOptions) {
    this.sagaName = options.sagaName;
    this.sagaId = options.sagaId;
    this.correlationId = options.correlationId;
    this.envelope = options.envelope;
    this.transport = options.transport;
    this.defaultEndpoint = options.defaultEndpoint;
  }

  async publish<TMessage extends BaseMessage>(
    message: TMessage,
    options?: Partial<TransportPublishOptions>
  ): Promise<void> {
    const endpoint = options?.endpoint ?? this.defaultEndpoint ?? message.type;

    await this.transport.publish(message, {
      endpoint,
      ...options,
    });
  }

  async schedule<TMessage extends BaseMessage>(
    message: TMessage,
    delayMs: number,
    options?: Partial<TransportPublishOptions>
  ): Promise<void> {
    const endpoint = options?.endpoint ?? this.defaultEndpoint ?? message.type;

    await this.transport.publish(message, {
      endpoint,
      delayMs,
      ...options,
    });
  }

  complete(): void {
    this._isCompleted = true;
  }

  setMetadata(key: string, value: unknown): void {
    this.metadata[key] = value;
  }

  getMetadata<T = unknown>(key: string): T | undefined {
    return this.metadata[key] as T | undefined;
  }

  /**
   * Check if complete() was called.
   */
  get isCompleted(): boolean {
    return this._isCompleted;
  }
}
