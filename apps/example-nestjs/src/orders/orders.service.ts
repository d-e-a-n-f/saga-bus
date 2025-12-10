import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { InjectSagaBus, type SagaBusService } from "@saga-bus/nestjs";
import type { OrderSubmitted } from "@saga-bus/examples-shared";
import type { CreateOrderDto } from "./dto/create-order.dto.js";

export interface OrderResponse {
  orderId: string;
  message: string;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectSagaBus()
    private readonly sagaBus: SagaBusService
  ) {}

  async createOrder(dto: CreateOrderDto): Promise<OrderResponse> {
    const orderId = `order-${randomUUID()}`;

    const total = dto.items.reduce(
      (sum, item) => sum + item.quantity * item.price,
      0
    );

    const message: OrderSubmitted = {
      type: "OrderSubmitted",
      orderId,
      customerId: dto.customerId,
      items: dto.items.map((item) => ({
        sku: item.sku,
        quantity: item.quantity,
        price: item.price,
      })),
      total,
    };

    await this.sagaBus.publish(message, { endpoint: message.type });

    return {
      orderId,
      message: "Order submitted successfully",
    };
  }
}
