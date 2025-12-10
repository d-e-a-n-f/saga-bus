import { createSagaMachine, type SagaDefinition } from "@saga-bus/core";
import type { OrderSagaState } from "../types/index.js";
import type { OrderMessage, OrderSubmitted } from "../messages/order.js";

/**
 * Order Saga - Orchestrates the order fulfillment process.
 *
 * Flow:
 * 1. OrderSubmitted -> pending (request payment)
 * 2. PaymentCaptured -> paid (request inventory) | PaymentFailed -> cancelled
 * 3. InventoryReserved -> reserved (request shipment) | InventoryFailed -> cancelled
 * 4. ShipmentCreated -> shipped (complete)
 */
export const OrderSaga: SagaDefinition<OrderSagaState, OrderMessage> =
  createSagaMachine<OrderSagaState, OrderMessage>()
    .name("OrderSaga")

    // Correlation: all messages correlate by orderId
    .correlate("OrderSubmitted", (msg) => msg.orderId, { canStart: true })
    .correlate("*", (msg) => msg.orderId)

    // Initial state from OrderSubmitted
    .initial<OrderSubmitted>((msg, ctx) => ({
      metadata: {
        sagaId: ctx.sagaId,
        version: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        isCompleted: false,
      },
      orderId: msg.orderId,
      customerId: msg.customerId,
      items: msg.items,
      total: msg.total,
      status: "pending",
    }))

    // Handle OrderSubmitted - request payment
    .on("OrderSubmitted")
    .when((s) => s.status === "pending")
    .handle(async (msg, state, ctx) => {
      await ctx.publish({
        type: "PaymentRequested",
        orderId: msg.orderId,
        amount: msg.total,
        customerId: msg.customerId,
      });

      return {
        newState: { ...state, status: "payment_requested" as const },
      };
    })

    // Handle PaymentCaptured - request inventory
    .on("PaymentCaptured")
    .when((s) => s.status === "payment_requested")
    .handle(async (msg, state, ctx) => {
      await ctx.publish({
        type: "InventoryReserveRequested",
        orderId: msg.orderId,
        items: state.items.map((item) => ({
          sku: item.sku,
          quantity: item.quantity,
        })),
      });

      return {
        newState: {
          ...state,
          status: "inventory_requested" as const,
          transactionId: msg.transactionId,
        },
      };
    })

    // Handle PaymentFailed - cancel order
    .on("PaymentFailed")
    .when((s) => s.status === "payment_requested")
    .handle(async (msg, state, ctx) => {
      await ctx.publish({
        type: "OrderCancelled",
        orderId: msg.orderId,
        reason: `Payment failed: ${msg.reason}`,
      });

      ctx.complete();

      return {
        newState: {
          ...state,
          status: "cancelled" as const,
          cancelReason: msg.reason,
        },
        isCompleted: true,
      };
    })

    // Handle InventoryReserved - request shipment
    .on("InventoryReserved")
    .when((s) => s.status === "inventory_requested")
    .handle(async (msg, state, ctx) => {
      await ctx.publish({
        type: "ShipmentRequested",
        orderId: msg.orderId,
        customerId: state.customerId,
        items: state.items.map((item) => ({
          sku: item.sku,
          quantity: item.quantity,
        })),
      });

      return {
        newState: {
          ...state,
          status: "shipment_requested" as const,
          reservationId: msg.reservationId,
        },
      };
    })

    // Handle InventoryReservationFailed - cancel order
    .on("InventoryReservationFailed")
    .when((s) => s.status === "inventory_requested")
    .handle(async (msg, state, ctx) => {
      // In a real system, we'd also refund the payment here
      await ctx.publish({
        type: "OrderCancelled",
        orderId: msg.orderId,
        reason: `Inventory reservation failed: ${msg.reason}`,
      });

      ctx.complete();

      return {
        newState: {
          ...state,
          status: "cancelled" as const,
          cancelReason: msg.reason,
        },
        isCompleted: true,
      };
    })

    // Handle ShipmentCreated - complete saga
    .on("ShipmentCreated")
    .when((s) => s.status === "shipment_requested")
    .handle(async (msg, state, ctx) => {
      await ctx.publish({
        type: "OrderCompleted",
        orderId: msg.orderId,
        trackingNumber: msg.trackingNumber,
      });

      ctx.complete();

      return {
        newState: {
          ...state,
          status: "shipped" as const,
          trackingNumber: msg.trackingNumber,
        },
        isCompleted: true,
      };
    })

    // Handle manual cancellation
    .on("OrderCancelled")
    .when((s) => s.status !== "cancelled" && s.status !== "shipped")
    .handle(async (msg, state, ctx) => {
      ctx.complete();

      return {
        newState: {
          ...state,
          status: "cancelled" as const,
          cancelReason: msg.reason,
        },
        isCompleted: true,
      };
    })

    .build();
