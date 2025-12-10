"use client";

import { useState, useCallback, useEffect } from "react";
import { useSagaBusConfig } from "./SagaBusProvider.js";
import type { SagaState } from "@saga-bus/core";

/**
 * Hook result for saga state.
 */
export interface UseSagaStateResult<T extends SagaState> {
  /**
   * Current saga state.
   */
  state: T | null;

  /**
   * Whether the state is loading.
   */
  isLoading: boolean;

  /**
   * Error if fetch failed.
   */
  error: Error | null;

  /**
   * Refresh the saga state.
   */
  refresh: () => Promise<void>;

  /**
   * Publish a message to the saga.
   */
  publish: (type: string, payload: unknown) => Promise<void>;
}

/**
 * Hook for interacting with saga state from client components.
 *
 * @example
 * ```tsx
 * function OrderStatus({ orderId }: { orderId: string }) {
 *   const { state, isLoading, publish } = useSagaState<OrderState>("OrderSaga", orderId);
 *
 *   if (isLoading) return <div>Loading...</div>;
 *
 *   return (
 *     <div>
 *       <p>Status: {state?.status}</p>
 *       <button onClick={() => publish("OrderCancelled", { orderId })}>
 *         Cancel
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useSagaState<T extends SagaState>(
  sagaName: string,
  sagaId: string
): UseSagaStateResult<T> {
  const { apiEndpoint } = useSagaBusConfig();
  const [state, setState] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "getState",
          sagaName,
          id: sagaId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch saga state: ${response.statusText}`);
      }

      const data = (await response.json()) as { state: T | null };
      setState(data.state);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, [apiEndpoint, sagaName, sagaId]);

  const publish = useCallback(
    async (type: string, payload: unknown) => {
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "publish",
          message: {
            type,
            payload,
            correlationId: sagaId,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to publish message: ${response.statusText}`);
      }

      // Refresh state after publish
      await refresh();
    },
    [apiEndpoint, sagaId, refresh]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { state, isLoading, error, refresh, publish };
}

/**
 * Hook for publishing messages without fetching state.
 */
export function usePublish(): (
  type: string,
  payload: unknown,
  correlationId?: string
) => Promise<string> {
  const { apiEndpoint } = useSagaBusConfig();

  return useCallback(
    async (type: string, payload: unknown, correlationId?: string) => {
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "publish",
          message: { type, payload, correlationId },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to publish message: ${response.statusText}`);
      }

      const data = (await response.json()) as { messageId: string };
      return data.messageId;
    },
    [apiEndpoint]
  );
}
