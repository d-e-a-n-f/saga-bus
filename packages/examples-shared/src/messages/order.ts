import type { BaseMessage } from "@saga-bus/core";

// Order lifecycle messages

export interface OrderSubmitted extends BaseMessage {
  readonly type: "OrderSubmitted";
  readonly orderId: string;
  readonly customerId: string;
  readonly items: ReadonlyArray<{
    readonly sku: string;
    readonly quantity: number;
    readonly price: number;
  }>;
  readonly total: number;
}

export interface PaymentRequested extends BaseMessage {
  readonly type: "PaymentRequested";
  readonly orderId: string;
  readonly amount: number;
  readonly customerId: string;
}

export interface PaymentCaptured extends BaseMessage {
  readonly type: "PaymentCaptured";
  readonly orderId: string;
  readonly transactionId: string;
}

export interface PaymentFailed extends BaseMessage {
  readonly type: "PaymentFailed";
  readonly orderId: string;
  readonly reason: string;
}

export interface InventoryReserveRequested extends BaseMessage {
  readonly type: "InventoryReserveRequested";
  readonly orderId: string;
  readonly items: ReadonlyArray<{
    readonly sku: string;
    readonly quantity: number;
  }>;
}

export interface InventoryReserved extends BaseMessage {
  readonly type: "InventoryReserved";
  readonly orderId: string;
  readonly reservationId: string;
}

export interface InventoryReservationFailed extends BaseMessage {
  readonly type: "InventoryReservationFailed";
  readonly orderId: string;
  readonly reason: string;
}

export interface ShipmentRequested extends BaseMessage {
  readonly type: "ShipmentRequested";
  readonly orderId: string;
  readonly customerId: string;
  readonly items: ReadonlyArray<{
    readonly sku: string;
    readonly quantity: number;
  }>;
}

export interface ShipmentCreated extends BaseMessage {
  readonly type: "ShipmentCreated";
  readonly orderId: string;
  readonly trackingNumber: string;
}

export interface OrderCancelled extends BaseMessage {
  readonly type: "OrderCancelled";
  readonly orderId: string;
  readonly reason: string;
}

export interface OrderCompleted extends BaseMessage {
  readonly type: "OrderCompleted";
  readonly orderId: string;
  readonly trackingNumber: string;
}

// Union of all order messages
export type OrderMessage =
  | OrderSubmitted
  | PaymentRequested
  | PaymentCaptured
  | PaymentFailed
  | InventoryReserveRequested
  | InventoryReserved
  | InventoryReservationFailed
  | ShipmentRequested
  | ShipmentCreated
  | OrderCancelled
  | OrderCompleted;
