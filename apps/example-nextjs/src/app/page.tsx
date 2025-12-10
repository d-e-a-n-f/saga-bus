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

export default function HomePage() {
  const [formData, setFormData] = useState<OrderFormData>({
    customerId: "customer-123",
    items: [{ sku: "WIDGET-001", quantity: 2, price: 29.99 }],
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; orderId?: string; error?: string } | null>(null);

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
    setResult(null);

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
        setResult({ success: true, orderId: data.orderId });
      } else {
        setResult({ success: false, error: data.error || "Failed to submit order" });
      }
    } catch (error) {
      setResult({ success: false, error: String(error) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: "600px" }}>
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
                  Remove
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

      {result && (
        <div
          style={{
            marginTop: "20px",
            padding: "15px",
            borderRadius: "4px",
            background: result.success ? "#d4edda" : "#f8d7da",
            color: result.success ? "#155724" : "#721c24",
          }}
        >
          {result.success ? (
            <>
              <strong>Order submitted successfully!</strong>
              <br />
              Order ID: <code>{result.orderId}</code>
            </>
          ) : (
            <>
              <strong>Error:</strong> {result.error}
            </>
          )}
        </div>
      )}

      <div style={{ marginTop: "30px", padding: "15px", background: "#e9ecef", borderRadius: "4px" }}>
        <h3 style={{ margin: "0 0 10px 0" }}>How it works</h3>
        <ol style={{ margin: 0, paddingLeft: "20px" }}>
          <li>Submit an order using the form above</li>
          <li>Order is published to RabbitMQ as <code>OrderSubmitted</code></li>
          <li>The worker processes the saga, publishing <code>PaymentRequested</code></li>
          <li>External services respond with <code>PaymentCaptured</code>, <code>InventoryReserved</code>, etc.</li>
          <li>Saga completes when <code>ShipmentCreated</code> is received</li>
        </ol>
      </div>
    </div>
  );
}
