import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { publishMessage } from "@/lib/saga-bus";

type SimulateAction = "payment" | "inventory" | "shipment" | "payment-fail" | "inventory-fail";

interface SimulateRequest {
  orderId: string;
  action: SimulateAction;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SimulateRequest;

    if (!body.orderId || !body.action) {
      return NextResponse.json(
        { error: "orderId and action are required" },
        { status: 400 }
      );
    }

    const { orderId, action } = body;

    switch (action) {
      case "payment":
        await publishMessage({
          type: "PaymentCaptured",
          orderId,
          transactionId: `txn-${randomUUID().slice(0, 8)}`,
        });
        return NextResponse.json({ message: "Payment captured", orderId });

      case "payment-fail":
        await publishMessage({
          type: "PaymentFailed",
          orderId,
          reason: "Insufficient funds",
        });
        return NextResponse.json({ message: "Payment failed", orderId });

      case "inventory":
        await publishMessage({
          type: "InventoryReserved",
          orderId,
          reservationId: `res-${randomUUID().slice(0, 8)}`,
        });
        return NextResponse.json({ message: "Inventory reserved", orderId });

      case "inventory-fail":
        await publishMessage({
          type: "InventoryReservationFailed",
          orderId,
          reason: "Out of stock",
        });
        return NextResponse.json({ message: "Inventory reservation failed", orderId });

      case "shipment":
        await publishMessage({
          type: "ShipmentCreated",
          orderId,
          trackingNumber: `TRACK-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        });
        return NextResponse.json({ message: "Shipment created", orderId });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Failed to simulate:", error);
    return NextResponse.json(
      { error: "Failed to simulate response" },
      { status: 500 }
    );
  }
}
