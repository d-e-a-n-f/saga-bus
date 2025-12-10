import type { SagaBus } from "../server/createSagaBus.js";

/**
 * Request body for saga API endpoints.
 */
export interface SagaApiRequest {
  /**
   * Action to perform.
   */
  action: "publish" | "getState" | "getStateByCorrelation";

  /**
   * Saga name (required for getState actions).
   */
  sagaName?: string;

  /**
   * Saga or correlation ID.
   */
  id?: string;

  /**
   * Message to publish.
   */
  message?: {
    type: string;
    payload?: Record<string, unknown>;
    correlationId?: string;
  };
}

/**
 * Create an API route handler for saga operations.
 *
 * @example
 * ```typescript
 * // app/api/saga/route.ts
 * import { createSagaHandler } from "@saga-bus/nextjs/api";
 * import { sagaBus } from "@/lib/saga-bus";
 *
 * export const POST = createSagaHandler(sagaBus);
 * ```
 */
export function createSagaHandler(
  bus: SagaBus
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    try {
      const body: SagaApiRequest = await request.json();

      switch (body.action) {
        case "publish": {
          if (!body.message) {
            return Response.json(
              { error: "Message is required for publish action" },
              { status: 400 }
            );
          }

          const messageId = crypto.randomUUID();
          const message = {
            type: body.message.type,
            ...body.message.payload,
          };

          await bus.publish(message, {
            endpoint: "saga-bus",
            headers: body.message.correlationId
              ? { "x-correlation-id": body.message.correlationId }
              : undefined,
          });

          return Response.json({ success: true, messageId });
        }

        case "getState": {
          if (!body.sagaName || !body.id) {
            return Response.json(
              { error: "sagaName and id are required for getState action" },
              { status: 400 }
            );
          }

          const state = await bus.getState(body.sagaName, body.id);
          return Response.json({ state });
        }

        case "getStateByCorrelation": {
          if (!body.sagaName || !body.id) {
            return Response.json(
              {
                error:
                  "sagaName and id are required for getStateByCorrelation action",
              },
              { status: 400 }
            );
          }

          const state = await bus.getStateByCorrelation(body.sagaName, body.id);
          return Response.json({ state });
        }

        default:
          return Response.json(
            { error: `Unknown action: ${(body as SagaApiRequest).action}` },
            { status: 400 }
          );
      }
    } catch (error) {
      console.error("Saga API error:", error);
      return Response.json(
        { error: error instanceof Error ? error.message : "Unknown error" },
        { status: 500 }
      );
    }
  };
}
