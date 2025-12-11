import type {
  SagaContext,
  MessageEnvelope,
  BaseMessage,
  Transport,
  TransportPublishOptions,
  SagaStateMetadata,
  TimeoutBounds,
} from "../types/index.js";

/** Default timeout bounds */
export const DEFAULT_TIMEOUT_BOUNDS: Required<TimeoutBounds> = {
  minMs: 1000,           // 1 second minimum
  maxMs: 604800000,      // 7 days maximum
};

export interface SagaContextImplOptions {
  sagaName: string;
  sagaId: string;
  correlationId: string;
  envelope: MessageEnvelope;
  transport: Transport;
  defaultEndpoint?: string;
  /** Current saga metadata (for reading existing timeout) */
  currentMetadata?: SagaStateMetadata;
  /** Timeout bounds to validate against */
  timeoutBounds?: TimeoutBounds;
}

/**
 * Pending timeout changes to be applied to saga state.
 */
export interface PendingTimeoutChange {
  type: "set" | "clear";
  timeoutMs?: number;
  timeoutExpiresAt?: Date;
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
  private readonly timeoutBounds: Required<TimeoutBounds>;
  private _isCompleted = false;
  private _currentMetadata?: SagaStateMetadata;
  private _pendingTimeoutChange?: PendingTimeoutChange;

  constructor(options: SagaContextImplOptions) {
    this.sagaName = options.sagaName;
    this.sagaId = options.sagaId;
    this.correlationId = options.correlationId;
    this.envelope = options.envelope;
    this.transport = options.transport;
    this.defaultEndpoint = options.defaultEndpoint;
    this._currentMetadata = options.currentMetadata;
    this.timeoutBounds = {
      minMs: options.timeoutBounds?.minMs ?? DEFAULT_TIMEOUT_BOUNDS.minMs,
      maxMs: options.timeoutBounds?.maxMs ?? DEFAULT_TIMEOUT_BOUNDS.maxMs,
    };
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

  setTimeout(delayMs: number): void {
    if (delayMs <= 0) {
      throw new Error("Timeout delay must be positive");
    }
    if (delayMs < this.timeoutBounds.minMs) {
      throw new Error(
        `Timeout delay ${delayMs}ms is below minimum allowed (${this.timeoutBounds.minMs}ms)`
      );
    }
    if (delayMs > this.timeoutBounds.maxMs) {
      throw new Error(
        `Timeout delay ${delayMs}ms exceeds maximum allowed (${this.timeoutBounds.maxMs}ms)`
      );
    }
    const now = new Date();
    this._pendingTimeoutChange = {
      type: "set",
      timeoutMs: delayMs,
      timeoutExpiresAt: new Date(now.getTime() + delayMs),
    };
  }

  clearTimeout(): void {
    this._pendingTimeoutChange = {
      type: "clear",
    };
  }

  getTimeoutRemaining(): number | null {
    // If there's a pending change, use that
    if (this._pendingTimeoutChange) {
      if (this._pendingTimeoutChange.type === "clear") {
        return null;
      }
      if (this._pendingTimeoutChange.timeoutExpiresAt) {
        const remaining =
          this._pendingTimeoutChange.timeoutExpiresAt.getTime() - Date.now();
        return Math.max(0, remaining);
      }
    }

    // Otherwise use current metadata
    if (this._currentMetadata?.timeoutExpiresAt) {
      const remaining =
        this._currentMetadata.timeoutExpiresAt.getTime() - Date.now();
      return Math.max(0, remaining);
    }

    return null;
  }

  /**
   * Get any pending timeout change to be applied to saga state.
   * Used by SagaOrchestrator when updating state.
   */
  get pendingTimeoutChange(): PendingTimeoutChange | undefined {
    return this._pendingTimeoutChange;
  }

  /**
   * Update the current metadata reference (called after state is loaded/created).
   */
  updateCurrentMetadata(metadata: SagaStateMetadata): void {
    this._currentMetadata = metadata;
  }
}
