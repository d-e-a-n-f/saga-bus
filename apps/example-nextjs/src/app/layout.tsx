import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Saga Bus - Order Demo",
  description: "Submit orders using saga-bus with RabbitMQ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: "20px" }}>
        <header style={{ marginBottom: "20px", borderBottom: "1px solid #ccc", paddingBottom: "10px" }}>
          <h1 style={{ margin: 0 }}>Saga Bus - Order Demo</h1>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
