"use client";

import { useState } from "react";

interface OrderItem {
  sku: string;
  quantity: number;
  price: number;
}

interface OrderFormData {
  customerId: string;
  items: OrderItem[];
}

type SagaStep = "pending" | "payment_requested" | "paid" | "inventory_requested" | "reserved" | "shipment_requested" | "shipped" | "cancelled";

interface Order {
  orderId: string;
  status: SagaStep;
}

const STEP_LABELS: Record<SagaStep, string> = {
  pending: "Pending",
  payment_requested: "Awaiting Payment",
  paid: "Paid",
  inventory_requested: "Awaiting Inventory",
  reserved: "Inventory Reserved",
  shipment_requested: "Awaiting Shipment",
  shipped: "Shipped (Complete)",
  cancelled: "Cancelled",
};

const STEP_ORDER: SagaStep[] = [
  "pending",
  "payment_requested",
  "paid",
  "inventory_requested",
  "reserved",
  "shipment_requested",
  "shipped",
];

export default function HomePage() {
  const [formData, setFormData] = useState<OrderFormData>({
    customerId: "customer-123",
    items: [{ sku: "WIDGET-001", quantity: 2, price: 29.99 }],
  });
  const [submitting, setSubmitting] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [simulating, setSimulating] = useState<string | null>(null);

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { sku: "", quantity: 1, price: 0 }],
    });
  };

  const removeItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  const updateItem = (index: number, field: keyof OrderItem, value: string | number) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: formData.customerId,
          items: formData.items,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setOrders([{ orderId: data.orderId, status: "payment_requested" }, ...orders]);
      }
    } catch (error) {
      console.error("Failed to submit:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const simulate = async (orderId: string, action: string, nextStatus: SagaStep) => {
    setSimulating(`${orderId}-${action}`);
    try {
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, action }),
      });

      if (response.ok) {
        // Update local state to reflect the expected next status
        setOrders(orders.map(o =>
          o.orderId === orderId ? { ...o, status: nextStatus } : o
        ));
      }
    } catch (error) {
      console.error("Simulation failed:", error);
    } finally {
      setSimulating(null);
    }
  };

  const getNextAction = (status: SagaStep): { action: string; label: string; nextStatus: SagaStep; failAction?: string; failLabel?: string; failStatus?: SagaStep } | null => {
    switch (status) {
      case "payment_requested":
        return {
          action: "payment",
          label: "Capture Payment",
          nextStatus: "inventory_requested",
          failAction: "payment-fail",
          failLabel: "Fail Payment",
          failStatus: "cancelled"
        };
      case "inventory_requested":
        return {
          action: "inventory",
          label: "Reserve Inventory",
          nextStatus: "shipment_requested",
          failAction: "inventory-fail",
          failLabel: "Fail Inventory",
          failStatus: "cancelled"
        };
      case "shipment_requested":
        return {
          action: "shipment",
          label: "Create Shipment",
          nextStatus: "shipped"
        };
      default:
        return null;
    }
  };

  const getStatusColor = (status: SagaStep) => {
    if (status === "shipped") return "#28a745";
    if (status === "cancelled") return "#dc3545";
    return "#ffc107";
  };

  return (
    <div style={{ display: "flex", gap: "40px", maxWidth: "1200px" }}>
      {/* Left side - Order Form */}
      <div style={{ flex: 1 }}>
        <h2>Submit New Order</h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
              Customer ID
            </label>
            <input
              type="text"
              value={formData.customerId}
              onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
              style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
              required
            />
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
              Items
            </label>
            {formData.items.map((item, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  gap: "10px",
                  marginBottom: "10px",
                  padding: "10px",
                  background: "#f5f5f5",
                  borderRadius: "4px",
                }}
              >
                <input
                  type="text"
                  placeholder="SKU"
                  value={item.sku}
                  onChange={(e) => updateItem(index, "sku", e.target.value)}
                  style={{ flex: 2, padding: "8px" }}
                  required
                />
                <input
                  type="number"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 0)}
                  style={{ flex: 1, padding: "8px" }}
                  min={1}
                  required
                />
                <input
                  type="number"
                  placeholder="Price"
                  value={item.price}
                  onChange={(e) => updateItem(index, "price", parseFloat(e.target.value) || 0)}
                  style={{ flex: 1, padding: "8px" }}
                  step="0.01"
                  min={0}
                  required
                />
                {formData.items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    style={{ padding: "8px 12px", background: "#dc3545", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                  >
                    X
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addItem}
              style={{ padding: "8px 16px", background: "#6c757d", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
            >
              + Add Item
            </button>
          </div>

          <div style={{ marginBottom: "15px", fontSize: "18px", fontWeight: "bold" }}>
            Total: ${calculateTotal().toFixed(2)}
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: "12px 24px",
              background: submitting ? "#6c757d" : "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: submitting ? "not-allowed" : "pointer",
              fontSize: "16px",
            }}
          >
            {submitting ? "Submitting..." : "Submit Order"}
          </button>
        </form>

        <div style={{ marginTop: "30px", padding: "15px", background: "#e9ecef", borderRadius: "4px" }}>
          <h3 style={{ margin: "0 0 10px 0" }}>Saga Flow</h3>
          <div style={{ fontSize: "12px", fontFamily: "monospace" }}>
            OrderSubmitted → PaymentRequested → PaymentCaptured → InventoryReserved → ShipmentCreated → Complete
          </div>
        </div>
      </div>

      {/* Right side - Order Progress */}
      <div style={{ flex: 1 }}>
        <h2>Order Progress</h2>
        <p style={{ color: "#666", fontSize: "14px" }}>
          Simulate downstream service responses to progress each order through the saga.
        </p>

        {orders.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", background: "#f5f5f5", borderRadius: "4px", color: "#666" }}>
            No orders yet. Submit an order to see it here.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            {orders.map((order) => {
              const nextAction = getNextAction(order.status);
              const isSimulating = simulating?.startsWith(order.orderId);

              return (
                <div
                  key={order.orderId}
                  style={{
                    padding: "15px",
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    borderLeft: `4px solid ${getStatusColor(order.status)}`,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <code style={{ fontSize: "12px" }}>{order.orderId}</code>
                    <span
                      style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "12px",
                        fontWeight: "bold",
                        background: getStatusColor(order.status),
                        color: "white",
                      }}
                    >
                      {STEP_LABELS[order.status]}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div style={{ display: "flex", gap: "4px", marginBottom: "15px" }}>
                    {STEP_ORDER.map((step, i) => {
                      const currentIndex = STEP_ORDER.indexOf(order.status);
                      const isActive = i <= currentIndex;
                      const isCancelled = order.status === "cancelled";

                      return (
                        <div
                          key={step}
                          style={{
                            flex: 1,
                            height: "6px",
                            borderRadius: "3px",
                            background: isCancelled ? "#dc3545" : (isActive ? "#28a745" : "#ddd"),
                          }}
                        />
                      );
                    })}
                  </div>

                  {/* Action buttons */}
                  {nextAction && !isSimulating && (
                    <div style={{ display: "flex", gap: "10px" }}>
                      <button
                        onClick={() => simulate(order.orderId, nextAction.action, nextAction.nextStatus)}
                        style={{
                          flex: 1,
                          padding: "8px 16px",
                          background: "#28a745",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        {nextAction.label}
                      </button>
                      {nextAction.failAction && nextAction.failStatus && (
                        <button
                          onClick={() => simulate(order.orderId, nextAction.failAction!, nextAction.failStatus!)}
                          style={{
                            padding: "8px 16px",
                            background: "#dc3545",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                        >
                          {nextAction.failLabel}
                        </button>
                      )}
                    </div>
                  )}

                  {isSimulating && (
                    <div style={{ textAlign: "center", color: "#666" }}>
                      Processing...
                    </div>
                  )}

                  {order.status === "shipped" && (
                    <div style={{ textAlign: "center", color: "#28a745", fontWeight: "bold" }}>
                      Order Complete!
                    </div>
                  )}

                  {order.status === "cancelled" && (
                    <div style={{ textAlign: "center", color: "#dc3545", fontWeight: "bold" }}>
                      Order Cancelled
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
