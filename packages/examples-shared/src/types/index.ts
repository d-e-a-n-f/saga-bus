import type { SagaState } from "@saga-bus/core";

export type OrderStatus =
  | "pending"
  | "payment_requested"
  | "paid"
  | "inventory_requested"
  | "reserved"
  | "shipment_requested"
  | "shipped"
  | "cancelled";

export interface OrderItem {
  readonly sku: string;
  readonly quantity: number;
  readonly price: number;
}

export interface OrderSagaState extends SagaState {
  readonly orderId: string;
  readonly customerId: string;
  readonly items: ReadonlyArray<OrderItem>;
  readonly total: number;
  readonly status: OrderStatus;
  readonly transactionId?: string;
  readonly reservationId?: string;
  readonly trackingNumber?: string;
  readonly cancelReason?: string;
}
