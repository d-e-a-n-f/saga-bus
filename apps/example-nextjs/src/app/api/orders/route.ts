import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { publishMessage } from "@/lib/saga-bus";
import type { OrderSubmitted } from "@saga-bus/examples-shared";

interface OrderItem {
  sku: string;
  quantity: number;
  price: number;
}

interface CreateOrderRequest {
  customerId: string;
  items: OrderItem[];
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateOrderRequest;

    // Validate request
    if (!body.customerId || !body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: "customerId and items are required" },
        { status: 400 }
      );
    }

    // Calculate total
    const total = body.items.reduce(
      (sum, item) => sum + item.quantity * item.price,
      0
    );

    // Generate order ID
    const orderId = `order-${randomUUID()}`;

    // Create OrderSubmitted message
    const message: OrderSubmitted = {
      type: "OrderSubmitted",
      orderId,
      customerId: body.customerId,
      items: body.items.map((item) => ({
        sku: item.sku,
        quantity: item.quantity,
        price: item.price,
      })),
      total,
    };

    // Publish to RabbitMQ
    await publishMessage(message);

    console.log(`Order submitted: ${orderId}`);

    return NextResponse.json({
      orderId,
      message: "Order submitted successfully",
    });
  } catch (error) {
    console.error("Failed to submit order:", error);
    return NextResponse.json(
      { error: "Failed to submit order" },
      { status: 500 }
    );
  }
}
