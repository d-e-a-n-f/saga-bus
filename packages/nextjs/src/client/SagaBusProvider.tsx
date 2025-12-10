"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Client-side saga bus configuration.
 */
export interface SagaBusClientConfig {
  /**
   * API endpoint for saga operations.
   * @default "/api/saga"
   */
  apiEndpoint: string;
}

const SagaBusContext = createContext<SagaBusClientConfig>({
  apiEndpoint: "/api/saga",
});

/**
 * Provider for saga bus client configuration.
 *
 * @example
 * ```tsx
 * // app/layout.tsx
 * import { SagaBusProvider } from "@saga-bus/nextjs/client";
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <SagaBusProvider apiEndpoint="/api/saga">
 *           {children}
 *         </SagaBusProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export function SagaBusProvider({
  children,
  apiEndpoint = "/api/saga",
}: {
  children: ReactNode;
  apiEndpoint?: string;
}): ReactNode {
  return (
    <SagaBusContext.Provider value={{ apiEndpoint }}>
      {children}
    </SagaBusContext.Provider>
  );
}

export function useSagaBusConfig(): SagaBusClientConfig {
  return useContext(SagaBusContext);
}
