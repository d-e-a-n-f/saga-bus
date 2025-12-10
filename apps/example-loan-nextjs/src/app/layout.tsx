import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Loan Application - Saga Bus Demo",
  description: "Complex multi-state saga workflow demonstration",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          margin: 0,
          padding: "20px",
          backgroundColor: "#f5f5f5",
          minHeight: "100vh",
        }}
      >
        <header
          style={{
            maxWidth: "1400px",
            margin: "0 auto 20px",
            padding: "20px",
            backgroundColor: "#1a365d",
            borderRadius: "8px",
            color: "white",
          }}
        >
          <h1 style={{ margin: 0 }}>Loan Application Portal</h1>
          <p style={{ margin: "8px 0 0", opacity: 0.8 }}>
            Saga Bus - Complex Multi-State Workflow Demo
          </p>
        </header>
        <main style={{ maxWidth: "1400px", margin: "0 auto" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
